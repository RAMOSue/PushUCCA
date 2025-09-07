// server/controllers/borrowController.js
const pool = require("../db");
const sendEmail = require("../utils/email");
const { v4: uuidv4, validate: isUuid } = require("uuid");

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

  try {
    const updatedItems = [];

    for (const item of items) {
      const { unit_id, item_id, quantity } = item;
      const q = Number(quantity) || 1;

      if ((!unit_id && !item_id) || !Number.isInteger(q) || q <= 0) {
        return res.status(400).json({ error: "Invalid unit_id/item_id or quantity." });
      }

      // Case 1: Specific unit (costumes with sizes OR instruments/accessories)
      if (unit_id) {
        const unitResult = await pool.query(
          `SELECT iu.id, iu.status, ii.name, ii.category, ii.garment_type
           FROM inventory_units iu
           JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
           WHERE iu.id = $1::uuid`,
          [unit_id]
        );

        if (unitResult.rowCount === 0) {
          return res.status(404).json({ error: `Unit ${unit_id} not found` });
        }

        const unit = unitResult.rows[0];
        if (unit.status !== "available") {
          return res.status(400).json({ error: `Unit ${unit_id} is not available` });
        }

        await pool.query(
          `UPDATE inventory_units SET status = 'pending' WHERE id = $1::uuid`,
          [unit_id]
        );

        updatedItems.push({ ...unit, reserved: true });

      // Case 2: Reserve by item (instruments/accessories use nosize units)
      } else if (item_id) {
        // Pick q available units for this item (item_id is the numeric PK on inventory_items)
        const availableUnits = await pool.query(
          `SELECT iu.id, iu.status, ii.name, ii.category, ii.garment_type
           FROM inventory_units iu
           JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
           WHERE ii.id = $1::int AND iu.status = 'available'
           LIMIT $2`,
          [item_id, q]
        );

        if (availableUnits.rowCount < q) {
          return res.status(400).json({ error: `Not enough stock for item ${item_id}` });
        }

        const unitIds = availableUnits.rows.map((u) => u.id);

        // ✅ IMPORTANT: UUID array cast
        await pool.query(
          `UPDATE inventory_units SET status = 'pending'
           WHERE id = ANY($1::uuid[])`,
          [unitIds]
        );

        updatedItems.push(...availableUnits.rows.map(u => ({ ...u, reserved: true })));
      }
    }

    return res.status(200).json({
      success: true,
      message: "Items reserved successfully.",
      updatedItems,
    });
  } catch (err) {
    console.error("❌ Error in addToCart:", err.message);
    return res.status(500).json({ error: "Failed to add items to cart" });
  }
};

const submitBorrowRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const { borrower_id, items } = req.body;

    if (!borrower_id || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Missing borrower_id or items" });
    }

    await client.query("BEGIN");

    // Insert main borrow request
    const insertBorrowRequest = `
      INSERT INTO borrowing_requests (borrower_id, status, request_date)
      VALUES ($1, $2, NOW())
      RETURNING id, borrower_id, status, request_date;
    `;
    const borrowRes = await client.query(insertBorrowRequest, [
      borrower_id,
      "pending",
    ]);
    const borrowRequestId = borrowRes.rows[0].id;

    for (const item of items) {
      if (item.unitId) {
        // ✅ Individual unit (costume/instrument with unique QR)
        if (!isUuid(item.unitId)) throw new Error(`Invalid unitId: ${item.unitId}`);

        await client.query(
          `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
           VALUES ($1, $2);`,
          [borrowRequestId, item.unitId]
        );

        await client.query(
          `UPDATE inventory_units SET status = 'reserved' WHERE id = $1;`,
          [item.unitId]
        );
      } else if (item.itemId && item.quantity) {
        // ✅ Accessories or instruments (quantity-based)
        if (!isUuid(item.itemId)) throw new Error(`Invalid itemId: ${item.itemId}`);

        // Select available units
        let unitQuery = `
          SELECT id FROM inventory_units
          WHERE inventory_item_id = $1 AND status = 'available'
        `;
        const params = [item.itemId];

        if (item.size) {
          unitQuery += ` AND size = $2`;
          params.push(item.size);
        }
        unitQuery += ` LIMIT ${item.quantity};`;

        const unitsRes = await client.query(unitQuery, params);
        if (unitsRes.rows.length < item.quantity) {
          throw new Error(`Not enough available units for item ${item.itemId}`);
        }

        // Reserve each unit
        for (const unit of unitsRes.rows) {
          await client.query(
            `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
             VALUES ($1, $2);`,
            [borrowRequestId, unit.id]
          );

          await client.query(
            `UPDATE inventory_units SET status = 'reserved' WHERE id = $1;`,
            [unit.id]
          );
        }

        // ✅ Track reserved quantity in inventory_items (syncs with decline)
        await client.query(
          `UPDATE inventory_items
           SET quantity = GREATEST(quantity - $1, 0)
           WHERE id = $2;`,
          [item.quantity, item.itemId]
        );
      }
    }

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Borrow request submitted successfully",
      borrowRequest: borrowRes.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Borrow request error:", err.message);
    res.status(500).json({ success: false, error: err.message });
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

  try {
    const requestsRes = await pool.query(
      `SELECT 
         br.id AS request_id,
         br.status,
         br.request_date,
         br.due_date,
         br.returned_date,
         br.returned_at,
         u.name AS borrower_name
       FROM borrowing_requests br
       JOIN users u ON u.id = br.borrower_id
       WHERE br.borrower_id = $1
       ORDER BY br.created_at DESC`,
      [userId]
    );

    const requests = requestsRes.rows;

    for (let req of requests) {
      const itemsRes = await pool.query(
        `SELECT 
           ii.uuid AS item_id,
           ii.name AS item_name,
           ii.garment_type,
           ii.category,
           json_agg(json_build_object(
             'unit_id', iu.id,
             'qr_code_url', iu.qr_code_url,
             'unit_status', iu.status,
             'size', iu.size
           ) ORDER BY iu.id) AS unit_ids,
           SUM(CASE WHEN iu.status = 'available' THEN 1 ELSE 0 END) AS returned_quantity,
           COUNT(iu.id) AS borrowed_quantity
         FROM borrowing_items bi
         JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
         JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
         WHERE bi.borrowing_id = $1
         GROUP BY ii.uuid, ii.name, ii.garment_type, ii.category`,
        [req.request_id]
      );

      req.items = itemsRes.rows.map((item) => ({
        ...item,
        borrowed_quantity: Number(item.borrowed_quantity),
        returned_quantity: Number(item.returned_quantity),
      }));
    }

    res.json(requests);
  } catch (err) {
    console.error("📦 Fetch borrow history error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllBorrowRequests = async (req, res) => {
  try {
    const requestsRes = await pool.query(
      `SELECT 
         br.id,
         br.borrower_id,
         u.name AS borrower_name,
         u.email AS borrower_email,
         br.status,
         br.request_date,
         br.due_date,
         br.returned_date,
         br.returned_at
       FROM borrowing_requests br
       JOIN users u ON u.id = br.borrower_id
       ORDER BY br.request_date DESC`
    );

    const requests = requestsRes.rows;

    // For each request, attach items
    for (let req of requests) {
      const itemsRes = await pool.query(
        `SELECT 
           ii.uuid AS item_id,
           ii.name AS item_name,
           ii.garment_type,
           ii.category,
           ii.instrument_classification,
           ii.instrument_type,
           json_agg(json_build_object(
             'unit_id', iu.id,
             'unit_status', iu.status,
             'size', COALESCE(iu.size,'N/A')
           ) ORDER BY iu.id) AS unit_ids,
           SUM(CASE WHEN iu.status = 'available' THEN 1 ELSE 0 END) AS returned_quantity,
           COUNT(iu.id) AS borrowed_quantity
         FROM borrowing_items bi
         JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
         JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
         WHERE bi.borrowing_id = $1
         GROUP BY ii.uuid, ii.name, ii.garment_type, ii.category, ii.instrument_classification, ii.instrument_type`,
        [req.id]
      );

      req.items = itemsRes.rows.map((item) => ({
        ...item,
        borrowed_quantity: Number(item.borrowed_quantity),
        returned_quantity: Number(item.returned_quantity),
      }));
    }

    res.json(requests);
  } catch (err) {
    console.error("❌ Fetch all requests error:", err.stack);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
};

const approveBorrowRequest = async (req, res) => {
  const { id } = req.params;
  const { staff_id, due_date } = req.body;

  if (!staff_id || !due_date) {
    return res.status(400).json({ error: "Staff ID and due date required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure it's still pending
    const check = await client.query(
      `SELECT status FROM borrowing_requests WHERE id = $1::int`,
      [id]
    );
    if (check.rows.length === 0) throw new Error("Request not found");
    if (check.rows[0].status !== "pending") {
      throw new Error("Request is not pending");
    }

    // Approve request
    await client.query(
      `
      UPDATE borrowing_requests
      SET status = 'approved', staff_id = $1, due_date = $2
      WHERE id = $3::int
      `,
      [staff_id, due_date, id]
    );

    // ✅ Only change unit statuses
    await client.query(
      `
      UPDATE inventory_units
      SET status = 'borrowed'
      WHERE id IN (
        SELECT inventory_unit_id FROM borrowing_items WHERE borrowing_id = $1::int
      )
      `,
      [id]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Request approved" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Approve request error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const declineBorrowRequest = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if request exists and is still pending
    const check = await client.query(
      `SELECT status FROM borrowing_requests WHERE id = $1::int`,
      [id]
    );
    if (check.rows.length === 0) throw new Error("Request not found");
    if (check.rows[0].status !== "pending") {
      throw new Error("Request is not pending");
    }

    // Restore inventory_units linked to this request to available
    await client.query(
      `
      UPDATE inventory_units u
      SET status = 'available'
      FROM borrowing_items bi
      WHERE bi.borrowing_id = $1::int
        AND bi.inventory_unit_id = u.id
        AND u.status IN ('reserved', 'borrowed')
      `,
      [id]
    );

    // Restore quantity for instruments & accessories
    await client.query(
      `
      UPDATE inventory_items ii
      SET quantity = quantity + 1
      FROM borrowing_items bi
      JOIN inventory_units u ON bi.inventory_unit_id = u.id
      WHERE bi.borrowing_id = $1::int
        AND u.inventory_item_id = ii.uuid
        AND (
          ii.category = 'instrument'
          OR ii.garment_type = 'accessory'
        )
      `,
      [id]
    );

    // Mark request as declined
    await client.query(
      `UPDATE borrowing_requests SET status = 'declined' WHERE id = $1::int`,
      [id]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Request declined and units restored" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Decline request error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const returnBorrowedItems = async (req, res) => {
  const { request_id, unit_ids = [], quantity_items = [] } = req.body;

  if (!request_id || (unit_ids.length === 0 && quantity_items.length === 0)) {
    return res
      .status(400)
      .json({ error: "Missing request_id or unit_ids/quantity_items" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // -----------------------------
    // Check request status
    // -----------------------------
    const check = await client.query(
      `SELECT status FROM borrowing_requests WHERE id = $1`,
      [request_id]
    );
    if (check.rows.length === 0) throw new Error("Request not found");
    if (!["approved", "pending_return"].includes(check.rows[0].status)) {
      throw new Error("Request is not active for return");
    }

    // -----------------------------
    // Handle individual units
    // -----------------------------
    if (unit_ids.length > 0) {
      await client.query(
        `UPDATE inventory_units
         SET status = 'available'
         WHERE id = ANY($1::uuid[])`,
        [unit_ids]
      );

      // Restore inventory_items.quantity for instruments/accessories
      await client.query(
        `UPDATE inventory_items ii
         SET quantity = quantity + 1
         FROM inventory_units iu
         WHERE iu.id = ANY($1::uuid[])
           AND iu.inventory_item_id = ii.uuid
           AND (ii.category = 'instrument' OR ii.garment_type = 'accessory')`,
        [unit_ids]
      );
    }

    // -----------------------------
    // Handle grouped quantity items
    // -----------------------------
    for (const q of quantity_items) {
      if (q.item_id && q.quantity > 0) {
        await client.query(
          `UPDATE inventory_items
           SET quantity = quantity + $1
           WHERE uuid = $2`,
          [q.quantity, q.item_id]
        );
      }
    }

    // -----------------------------
    // Check if any items are still borrowed
    // -----------------------------
    const stillUnitsRes = await client.query(
      `SELECT COUNT(*) AS still_borrowed
       FROM inventory_units iu
       JOIN borrowing_items bi ON bi.inventory_unit_id = iu.id
       WHERE bi.borrowing_id = $1
         AND iu.status = 'borrowed'`,
      [request_id]
    );

    const stillUnits = Number(stillUnitsRes.rows[0].still_borrowed || 0);

    // -----------------------------
    // Update request status
    // -----------------------------
    if (stillUnits === 0) {
      await client.query(
        `UPDATE borrowing_requests
         SET status = 'returned',
             returned_at = NOW()
         WHERE id = $1`,
        [request_id]
      );
    } else {
      await client.query(
        `UPDATE borrowing_requests
         SET status = 'pending_return'
         WHERE id = $1`,
        [request_id]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Items returned successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Return items error:", err.message);
    res.status(500).json({ error: err.message });
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

    // Get the UUID of the inventory_item
    const itemUuidResult = await client.query(
      `SELECT uuid FROM inventory_items WHERE id = $1`,
      [item_id]
    );
    if (itemUuidResult.rows.length === 0) {
      throw new Error(`Invalid inventory item ID: ${item_id}`);
    }
    const itemUuid = itemUuidResult.rows[0].uuid;

    // Find available units for this item (optionally by size)
    const params = [itemUuid, qty];
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
      .json({ error: process.env.NODE_ENV === "development" ? err.message : "Failed to update inventory quantity" });
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

    // Get the UUID of the inventory_item
    const itemUuidResult = await client.query(
      `SELECT uuid FROM inventory_items WHERE id = $1`,
      [item_id]
    );
    if (itemUuidResult.rows.length === 0) {
      throw new Error(`Invalid inventory item ID: ${item_id}`);
    }
    const itemUuid = itemUuidResult.rows[0].uuid;

    // Pick currently RESERVED units for this item (optionally by size)
    const params = [itemUuid, qty];
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
      .json({ error: process.env.NODE_ENV === "development" ? err.message : "Failed to restore inventory quantity" });
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find the inventory unit by QR code
    const unitResult = await client.query(
      "SELECT id, status, inventory_item_id FROM inventory_units WHERE qr_code_text = $1 FOR UPDATE",
      [qrCodeText]
    );

    if (unitResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Inventory unit not found" });
    }

    const unit = unitResult.rows[0];

    if (action === "reserve") {
      if (unit.status !== "available") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Unit is not available" });
      }

      await client.query(
        "UPDATE inventory_units SET status = 'reserved' WHERE id = $1",
        [unit.id]
      );

      await client.query("COMMIT");
      return res.json({
        message: "Unit reserved successfully",
        unit_id: unit.id,
        inventory_item_id: unit.inventory_item_id,
      });
    }

    if (action === "release") {
      if (unit.status !== "reserved") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Unit is not reserved" });
      }

      await client.query(
        "UPDATE inventory_units SET status = 'available' WHERE id = $1",
        [unit.id]
      );

      await client.query("COMMIT");
      return res.json({
        message: "Unit released successfully",
        unit_id: unit.id,
        inventory_item_id: unit.inventory_item_id,
      });
    }

    await client.query("ROLLBACK");
    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ updateBorrowCartQuantity error:", err.message || err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// -----------------------
// 🟢 Start Borrowing Session
// -----------------------
const startBorrowingSession = async (req, res) => {
  const { borrower_id } = req.body;

  if (!borrower_id) {
    return res.status(400).json({ error: "Missing borrower_id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertSql = `
      INSERT INTO borrowing_requests (borrower_id, status, request_date)
      VALUES ($1, 'pending', NOW())
      RETURNING id, borrower_id, status, request_date;
    `;

    const result = await client.query(insertSql, [borrower_id]);
    const borrowing = result.rows[0];

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Borrowing session started",
      borrowingId: borrowing.id,
      borrowing,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ startBorrowingSession error:", err.message);
    return res.status(500).json({ error: "Failed to start borrowing session" });
  } finally {
    client.release();
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
  startBorrowingSession, 
};
