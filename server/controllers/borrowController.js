// server/controllers/borrowController.js
const pool = require("../db");
const sendEmail = require("../utils/email");

/*
 * ------------------------------------------------------------
 * BORROW CONTROLLER
 * ------------------------------------------------------------
 * Current model: borrowing_requests (group) + borrowing_items (line items)
 * Inventory is tracked in inventory_items.quantity (aggregate count) and inventory_units for unit-specific tracking.
 *
 * Status lifecycle (current DB enum extended to include pending_return):
 *   pending -> approved -> pending_return -> returned
 *              \-> declined
 *
 * Partial returns: borrowing_items.returned_quantity accumulates.
 * Request becomes:
 *   pending_return  if ANY line still outstanding
 *   returned        if ALL lines fully returned
 */

const addToCart = async (req, res) => {
  const { borrower_id, items } = req.body;
  if (!borrower_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing borrower_id or items." });
  }
  return res.status(200).json({ message: "Cart item received." });
};

const submitBorrowRequest = async (req, res) => {
  const { borrower_id, items } = req.body;

  if (!borrower_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing borrower_id or items." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertRequestQuery = `
      INSERT INTO borrowing_requests (borrower_id, status, request_date, created_at)
      VALUES ($1, 'pending', NOW(), NOW())
      RETURNING id
    `;
    const requestResult = await client.query(insertRequestQuery, [borrower_id]);
    const borrowingId = requestResult.rows[0].id;

    for (const item of items) {
      const { item_id, unit_id, quantity } = item;

      if ((!item_id && !unit_id) || quantity <= 0) {
        throw new Error(`Invalid item entry: ${JSON.stringify(item)}`);
      }

      // If a specific unit is borrowed
      if (unit_id) {
        await client.query(
          `
          INSERT INTO borrowing_items (borrowing_id, inventory_item_id, inventory_unit_id, quantity, returned_quantity)
          VALUES ($1, (SELECT inventory_item_id FROM inventory_units WHERE id = $2), $2, 1, 0)
          `,
          [borrowingId, unit_id]
        );

        await client.query(
          `UPDATE inventory_units SET status = 'borrowed' WHERE id = $1 AND status = 'reserved'`,
          [unit_id]
        );
      } else {
        // Borrow by item quantity (aggregate path)
        await client.query(
          `
          INSERT INTO borrowing_items (borrowing_id, inventory_item_id, quantity, returned_quantity)
          VALUES ($1, $2, $3, 0)
          `,
          [borrowingId, item_id, quantity]
        );

        const result = await client.query(
          `
          UPDATE inventory_items
          SET quantity = quantity - $1
          WHERE id = $2 AND quantity >= $1
          `,
          [quantity, item_id]
        );

        if (result.rowCount === 0) {
          throw new Error(
            `Insufficient stock or invalid item ID for item_id=${item_id}`
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      message: "Borrow request submitted successfully.",
      id: borrowingId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Borrow request error:", err.stack || err.message);
    res.status(500).json({
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  } finally {
    client.release();
  }
};

// ✅ Updated getBorrowHistory to handle UUIDs correctly
const getBorrowHistory = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "Missing borrower ID" });
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return res
      .status(400)
      .json({ error: "Invalid borrower ID format. Must be UUID." });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        br.id AS request_id,
        u.name AS borrower_name,
        br.status,
        br.due_date,
        br.returned_date,
        br.request_date,
        br.created_at,
        json_agg(
          json_build_object(
            'unit_id', iu.id,
            'item_id', ii.id,
            'item_name', ii.name,
            'quantity_borrowed', bi.quantity,
            'returned_quantity', bi.returned_quantity,
            'qr_code_url', iu.qr_code_url
          )
        ) AS items
      FROM borrowing_requests br
      JOIN users u ON u.id = br.borrower_id
      JOIN borrowing_items bi ON bi.borrowing_id = br.id
      LEFT JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
      JOIN inventory_items ii ON ii.id = bi.inventory_item_id
      WHERE br.borrower_id = $1
      GROUP BY br.id, u.name
      ORDER BY br.created_at DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("📦 Fetch borrow history error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllBorrowRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT br.id,
             br.borrower_id,
             u.name  AS borrower_name,
             u.email AS borrower_email,
             br.status,
             br.request_date,
             br.due_date,
             json_agg(
               json_build_object(
                 'item_name',         ii.name,
                 'item_id',           ii.id,
                 'quantity',          bi.quantity,
                 'returned_quantity', bi.returned_quantity
               )
             ) AS items
      FROM borrowing_requests br
      JOIN users u         ON u.id  = br.borrower_id
      JOIN borrowing_items bi ON bi.borrowing_id = br.id
      JOIN inventory_items ii ON ii.id = bi.inventory_item_id
      GROUP BY br.id, u.name, u.email
      ORDER BY br.request_date DESC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch all requests error:", err.message);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
};

const approveBorrowRequest = async (req, res) => {
  const { id } = req.params;
  const { staff_id, due_date } = req.body;

  if (!staff_id || !due_date) {
    return res.status(400).json({ error: "Staff ID and due date required" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE borrowing_requests
      SET status = 'approved', staff_id = $1, due_date = $2
      WHERE id = $3
      RETURNING borrower_id
      `,
      [staff_id, due_date, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const borrowerId = result.rows[0].borrower_id;
    const borrowerRes = await pool.query(
      `SELECT email, name FROM users WHERE id = $1`,
      [borrowerId]
    );
    const borrowerEmail = borrowerRes.rows[0].email;
    const borrowerName = borrowerRes.rows[0].name;

    await sendEmail(
      borrowerEmail,
      "Borrow Request Approved",
      `Hello ${borrowerName},\n\nYour borrow request (ID: ${id}) has been approved.\nDue date: ${due_date}.\n\nThank you!`
    );

    res.json({ success: true, message: "Request approved and email sent" });
  } catch (err) {
    console.error("❌ Approve request error:", err.message);
    res.status(500).json({ error: "Failed to approve request" });
  }
};

const declineBorrowRequest = async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemsRes = await client.query(
      `SELECT inventory_item_id, quantity, inventory_unit_id FROM borrowing_items WHERE borrowing_id = $1`,
      [id]
    );
    if (itemsRes.rows.length === 0) {
      throw new Error("Request not found or no items");
    }

    for (const item of itemsRes.rows) {
      if (item.inventory_unit_id) {
        await client.query(
          `UPDATE inventory_units SET status = 'available' WHERE id = $1`,
          [item.inventory_unit_id]
        );
      } else {
        await client.query(
          `UPDATE inventory_items SET quantity = quantity + $1 WHERE id = $2`,
          [item.quantity, item.inventory_item_id]
        );
      }
    }

    const updateRes = await client.query(
      `UPDATE borrowing_requests SET status = 'declined' WHERE id = $1 RETURNING borrower_id`,
      [id]
    );

    const borrowerId = updateRes.rows[0].borrower_id;
    const borrowerEmailRes = await client.query(
      `SELECT email, name FROM users WHERE id = $1`,
      [borrowerId]
    );

    await sendEmail(
      borrowerEmailRes.rows[0].email,
      "Borrow Request Declined",
      `Hello ${borrowerEmailRes.rows[0].name},\n\nYour borrow request (ID: ${id}) was declined.\n\nPlease contact support for more details.`
    );

    await client.query("COMMIT");
    res.json({
      success: true,
      message: "Request declined, stock restored, and email sent",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Decline request error:", err.message);
    res.status(500).json({ error: "Failed to decline request" });
  } finally {
    client.release();
  }
};

const returnBorrowedItems = async (req, res) => {
  const { request_id, items } = req.body;

  if (!request_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing request_id or items" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const item of items) {
      const { item_id, unit_id, quantity } = item;

      if (!item_id && !unit_id) {
        throw new Error("Invalid return item.");
      }

      if (unit_id) {
        await client.query(
          `
          UPDATE borrowing_items
          SET returned_quantity = 1
          WHERE borrowing_id = $1 AND inventory_unit_id = $2
          `,
          [request_id, unit_id]
        );

        await client.query(
          `UPDATE inventory_units SET status = 'available' WHERE id = $1`,
          [unit_id]
        );
      } else {
        const checkRes = await client.query(
          `
          SELECT quantity, returned_quantity
          FROM borrowing_items
          WHERE borrowing_id = $1 AND inventory_item_id = $2
          FOR UPDATE
          `,
          [request_id, item_id]
        );

        if (checkRes.rows.length === 0) {
          throw new Error("Item not found in borrow request");
        }

        const {
          quantity: borrowedQty,
          returned_quantity: alreadyReturned,
        } = checkRes.rows[0];
        const remaining = borrowedQty - alreadyReturned;
        if (quantity > remaining) {
          throw new Error("Return quantity exceeds remaining borrowed items");
        }

        await client.query(
          `
          UPDATE borrowing_items
          SET returned_quantity = returned_quantity + $1
          WHERE borrowing_id = $2 AND inventory_item_id = $3
          `,
          [quantity, request_id, item_id]
        );

        await client.query(
          `UPDATE inventory_items SET quantity = quantity + $1 WHERE id = $2`,
          [quantity, item_id]
        );
      }
    }

    const pendingCheck = await client.query(
      `
      SELECT COUNT(*) AS not_full
      FROM borrowing_items
      WHERE borrowing_id = $1 AND returned_quantity < quantity
      `,
      [request_id]
    );
    const notFull = Number(pendingCheck.rows[0].not_full);

    if (notFull === 0) {
      await client.query(
        `
        UPDATE borrowing_requests
        SET status = 'returned', returned_date = NOW()
        WHERE id = $1
        `,
        [request_id]
      );
    } else {
      await client.query(
        `
        UPDATE borrowing_requests
        SET status = 'pending_return'
        WHERE id = $1 AND status <> 'returned'
        `,
        [request_id]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Items successfully returned" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Return items error:", err.message);
    res.status(500).json({ error: err.message || "Failed to return items" });
  } finally {
    client.release();
  }
};

/* ------------------------------------------------------------------ */
/*  NEW: Quantity adjustors used by BorrowCart (+ / -)                 */
/*  Reserve (update-quantity) grabs N AVAILABLE units for the item     */
/*  Release (restore-quantity) frees N RESERVED units for the item     */
/*  Optional: filter by size if provided                               */
/* ------------------------------------------------------------------ */

const updateInventoryQuantity = async (req, res) => {
  // Reserve MORE units for an item (diff > 0 in UI)
  const { item_id, quantity, size } = req.body;

  const qty = Number(quantity);
  if (!item_id || !Number.isInteger(qty) || qty <= 0) {
    return res
      .status(400)
      .json({ error: "item_id and positive integer quantity are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find available units for this item (optionally by size)
    const params = [item_id, qty];
    const sizeClause = size ? "AND iu.size = $3" : "";
    if (size) params.push(size);

    const selectSql = `
      SELECT iu.id
      FROM inventory_units iu
      WHERE iu.inventory_item_id = $1
        AND iu.status = 'available'
        ${sizeClause}
      ORDER BY iu.id
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `;

    const avail = await client.query(selectSql, params);

    if (avail.rowCount < qty) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Not enough available units" });
    }

    const unitIds = avail.rows.map((r) => r.id);

    // Mark them as reserved
    await client.query(
      `UPDATE inventory_units SET status = 'reserved' WHERE id = ANY($1)`,
      [unitIds]
    );

    await client.query("COMMIT");
    return res.json({
      success: true,
      reserved_count: unitIds.length,
      unit_ids: unitIds,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ updateInventoryQuantity error:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to update inventory quantity" });
  } finally {
    client.release();
  }
};

const restoreInventoryQuantity = async (req, res) => {
  // Release (unreserve) some units for an item (diff < 0 path in UI)
  const { item_id, quantity, size } = req.body;

  const qty = Number(quantity);
  if (!item_id || !Number.isInteger(qty) || qty <= 0) {
    return res
      .status(400)
      .json({ error: "item_id and positive integer quantity are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pick currently RESERVED units for this item (optionally by size)
    const params = [item_id, qty];
    const sizeClause = size ? "AND iu.size = $3" : "";
    if (size) params.push(size);

    const selectSql = `
      SELECT iu.id
      FROM inventory_units iu
      WHERE iu.inventory_item_id = $1
        AND iu.status = 'reserved'
        ${sizeClause}
      ORDER BY iu.id
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `;

    const reserved = await client.query(selectSql, params);

    if (reserved.rowCount < qty) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Not enough reserved units to release" });
    }

    const unitIds = reserved.rows.map((r) => r.id);

    // Mark them back to available
    await client.query(
      `UPDATE inventory_units SET status = 'available' WHERE id = ANY($1)`,
      [unitIds]
    );

    await client.query("COMMIT");
    return res.json({
      success: true,
      released_count: unitIds.length,
      unit_ids: unitIds,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ restoreInventoryQuantity error:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to restore inventory quantity" });
  } finally {
    client.release();
  }
};

/* ------------------------------------------------------------------ */
/*  NEW: Get Inventory Unit by QR Code Text for Borrowing             */
/* ------------------------------------------------------------------ */
const getInventoryUnitByQrText = async (req, res) => {
  const { qrCodeText } = req.params;

  try {
    if (!qrCodeText || !qrCodeText.trim()) {
      return res.status(400).json({ error: "QR code text is required" });
    }

    const qrClean = qrCodeText.trim();

    // 1️⃣ First try: Match against inventory_units table (per-unit QR codes)
    let result = await pool.query(
      `
      SELECT
        iu.id AS inventory_unit_id,
        iu.size,
        iu.status,
        iu.qr_code_text,
        iu.qr_code_url,
        ii.id AS item_id,
        ii.uuid AS item_uuid,
        ii.name AS item_name,
        ii.category,
        ii.garment_type,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group,
        'unit' AS type
      FROM inventory_units iu
      JOIN inventory_items ii
        ON iu.inventory_item_id = ii.id
      WHERE TRIM(iu.qr_code_text) = $1
      LIMIT 1;
      `,
      [qrClean]
    );

    // 2️⃣ Second try: Match against inventory_items table (whole-item QR codes)
    if (result.rows.length === 0) {
      result = await pool.query(
        `
        SELECT
          NULL AS inventory_unit_id,
          NULL AS size,
          NULL AS status,
          ii.qr_code_text,
          ii.qr_code_url,
          ii.id AS item_id,
          ii.uuid AS item_uuid,
          ii.name AS item_name,
          ii.category,
          ii.garment_type,
          ii.description,
          ii.image_url,
          ii.gender,
          ii.cultural_group,
          ii.accessory_type,
          ii.instrument_type,
          ii.instrument_classification,
          ii.collection_group,
          'item' AS type
        FROM inventory_items ii
        WHERE TRIM(ii.qr_code_text) = $1
        LIMIT 1;
        `,
        [qrClean]
      );
    }

    // 3️⃣ Not found
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "QR code not found" });
    }

    // ✅ Success
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ QR code scan error:", err);
    return res.status(500).json({ error: "Failed to fetch QR code data" });
  }
};

// -----------------------
// 🛒 Update Borrow Cart Quantity (Reserve/Release Units)
// -----------------------
const updateBorrowCartQuantity = async (req, res) => {
  const { qrCodeText, action } = req.body;

  if (!qrCodeText || !action) {
    return res.status(400).json({ error: "QR code and action are required" });
  }

  try {
    // Find the inventory unit by QR code
    const unitResult = await pool.query(
      "SELECT id, status FROM inventory_units WHERE qr_code_text = $1",
      [qrCodeText]
    );

    if (unitResult.rows.length === 0) {
      return res.status(404).json({ error: "Inventory unit not found" });
    }

    const unit = unitResult.rows[0];

    if (action === "reserve") {
      if (unit.status !== "available") {
        return res.status(400).json({ error: "Unit is not available" });
      }

      await pool.query(
        "UPDATE inventory_units SET status = 'reserved' WHERE id = $1",
        [unit.id]
      );

      return res.json({ message: "Unit reserved successfully" });
    }

    if (action === "release") {
      if (unit.status !== "reserved") {
        return res.status(400).json({ error: "Unit is not reserved" });
      }

      await pool.query(
        "UPDATE inventory_units SET status = 'available' WHERE id = $1",
        [unit.id]
      );

      return res.json({ message: "Unit released successfully" });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error("Error updating borrow cart quantity:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


module.exports = {
  addToCart,
  submitBorrowRequest,
  getBorrowHistory,
  getAllBorrowRequests,
  approveBorrowRequest,
  declineBorrowRequest,
  returnBorrowedItems,
  getInventoryUnitByQrText,
  // NEW exports used by BorrowCart.jsx
  updateInventoryQuantity,
  restoreInventoryQuantity,
  updateBorrowCartQuantity, // ✅ Add this line
};
