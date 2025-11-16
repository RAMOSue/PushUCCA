// server/controllers/borrowController.js
const pool = require("../db");
const { get } = require("../routes/imageRecognitionRoutes");
const sendEmail = require("../utils/email");
const { v4: uuidv4, validate: isUuid } = require("uuid");
const { notifications } = require("../utils/notifications");

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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Always create a NEW reserved request for this add-to-cart action
    const insertRequest = await client.query(
      `INSERT INTO borrowing_requests (borrower_id, status, request_date, created_at)
       VALUES ($1, 'reserved', NOW(), NOW())
       RETURNING id`,
      [borrower_id]
    );
    const requestId = insertRequest.rows[0].id;

    const cartItems = [];

    // 🟢 Loop through items
    for (const item of items) {
      const { unit_id, item_id, quantity } = item;
      const q = Number(quantity) || 1;

      if ((!unit_id && !item_id) || !Number.isInteger(q) || q <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid unit_id/item_id or quantity." });
      }

      // Case 1: Specific unit (QR-based)
      if (unit_id) {
        const unitResult = await client.query(
          `SELECT iu.id, iu.status, ii.id AS item_id, ii.name, ii.category, ii.garment_type, ii.image_url
           FROM inventory_units iu
           JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
           WHERE iu.id = $1::uuid 
           AND iu.status = 'available'
           FOR UPDATE SKIP LOCKED`,
          [unit_id]
        );

        if (unitResult.rowCount === 0) {
          // Check if unit exists but is not available
          const checkUnit = await client.query(
            `SELECT status FROM inventory_units WHERE id = $1::uuid`,
            [unit_id]
          );
          
          await client.query("ROLLBACK");
          
          if (checkUnit.rowCount === 0) {
            return res.status(404).json({ error: `Unit ${unit_id} not found.` });
          } else {
            return res.status(400).json({ 
              error: `Unit ${unit_id} is not available (current status: ${checkUnit.rows[0].status}).` 
            });
          }
        }

        const unit = unitResult.rows[0];

        // Reserve unit
        await client.query(
          `UPDATE inventory_units SET status = 'reserved' WHERE id = $1 AND status = 'available'`,
          [unit_id]
        );

        // Link the reserved unit to the newly created borrowing request
        await client.query(
          `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
           VALUES ($1, $2)`,
          [requestId, unit_id]
        );

        cartItems.push({
          unit_id: unit.id,
          item_id: unit.item_id,
          name: unit.name,
          category: unit.category,
          garment_type: unit.garment_type,
          image_url: unit.image_url,
          quantity: 1,
        });
      }

      // Case 2: Quantity-based items (accessories)
      else if (item_id) {
        const availableUnits = await client.query(
          `SELECT iu.id, iu.status, ii.id AS item_id, ii.name, ii.category, ii.garment_type, ii.image_url
           FROM inventory_units iu
           JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
           WHERE ii.id = $1::int AND iu.status = 'available'
           ORDER BY iu.id
           LIMIT $2 FOR UPDATE SKIP LOCKED`,
          [item_id, q]
        );

        if (availableUnits.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: `No available stock for item ${item_id}.` });
        }

        for (const unit of availableUnits.rows) {
          await client.query(
            `UPDATE inventory_units SET status = 'reserved' WHERE id = $1`,
            [unit.id]
          );

          // Link reserved unit to this borrowing request
          await client.query(
            `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
             VALUES ($1, $2)`,
            [requestId, unit.id]
          );

          cartItems.push({
            unit_id: unit.id,
            item_id: unit.item_id,
            name: unit.name,
            category: unit.category,
            garment_type: unit.garment_type,
            image_url: unit.image_url,
            quantity: 1,
          });
        }
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Items reserved and added to cart.",
      request_id: requestId,
      items: cartItems,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error in addToCart:", err.message);
    return res.status(500).json({ error: "Failed to reserve and add to cart." });
  } finally {
    client.release();
  }
};





const submitBorrowRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const { borrower_id, items, request_id } = req.body;

    // If request_id was provided, simply flip that reserved request to pending
    if (request_id) {
      await client.query('BEGIN');

      const check = await client.query(
        `SELECT id, status FROM borrowing_requests WHERE id = $1 AND borrower_id = $2 FOR UPDATE LIMIT 1`,
        [request_id, borrower_id]
      );
      if (check.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Request not found' });
      }
      if (check.rows[0].status !== 'reserved') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Request is not in reserved state' });
      }

      await client.query(
        `UPDATE borrowing_requests SET status = 'pending', request_date = NOW() WHERE id = $1`,
        [request_id]
      );

      await client.query('COMMIT');

      // After committing, notify all staff about this submitted reserved request
      try {
        const staffResult = await pool.query(`SELECT id FROM users WHERE role = 'staff'`);

        const requestDetails = await pool.query(
          `SELECT 
            u.name as borrower_name,
            COALESCE(json_agg(
              json_build_object(
                'id', ii.uuid,
                'name', ii.name
              )
            ) FILTER (WHERE ii.uuid IS NOT NULL), '[]'::json) as items
           FROM borrowing_items bi
           JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
           JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
           JOIN users u ON u.id = $1
           WHERE bi.borrowing_id = $2
           GROUP BY u.name`,
          [borrower_id, request_id]
        );

        if (requestDetails.rows.length > 0) {
          const { borrower_name, items } = requestDetails.rows[0];
          const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
          for (const staff of staffResult.rows) {
            // fire-and-forget notifications; do not block the response if they fail
            notifications.sendBorrowRequest(borrower_id, staff.id, itemsArray, borrower_name, request_id).catch((e) => {
              console.warn('⚠️ notify staff failed for request_id', request_id, e && e.message ? e.message : e);
            });
          }
        }
      } catch (notifyErr) {
        console.warn('⚠️ Failed to notify staff for submitted request_id:', request_id, notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
      }

      return res.status(200).json({ success: true, message: 'Request submitted', request_id });
    }

    // Prefer to update an existing RESERVED request for this borrower to PENDING
    // This prevents creating duplicate rows (reserved + pending) when the frontend
    // submits an already-reserved request. If no reserved request exists and the
    // caller provided explicit items, fall back to legacy create-new behavior.

    if (!borrower_id) {
      return res.status(400).json({ success: false, error: 'Missing borrower_id' });
    }

    // Look for the most recent reserved request for this borrower
    const reservedRes = await client.query(
      `SELECT id, status FROM borrowing_requests WHERE borrower_id = $1 AND status = 'reserved' ORDER BY created_at DESC LIMIT 1`,
      [borrower_id]
    );

    if (reservedRes.rowCount > 0) {
      const reservedId = reservedRes.rows[0].id;
      await client.query('BEGIN');
      await client.query(`UPDATE borrowing_requests SET status = 'pending', request_date = NOW() WHERE id = $1`, [reservedId]);
      
      // Get staff users and borrower details for notification
      const staffResult = await client.query(
        `SELECT id FROM users WHERE role = 'staff'`
      );

      // Get borrower name and item details
      const requestDetails = await client.query(
        `SELECT 
          u.name as borrower_name,
          json_agg(
            json_build_object(
              'id', ii.uuid,
              'name', ii.name
            )
          ) as items
         FROM borrowing_items bi
         JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         JOIN users u ON u.id = $1
         WHERE bi.borrowing_id = $2
         GROUP BY u.name`,
        [borrower_id, reservedId]
      );

      await client.query('COMMIT');

      // Send notifications to all staff members
      if (requestDetails.rows.length > 0) {
        const { borrower_name, items } = requestDetails.rows[0];
        const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
        for (const staff of staffResult.rows) {
          // Pass the related request id so notification records can be correlated to the request
          await notifications.sendBorrowRequest(borrower_id, staff.id, itemsArray, borrower_name, reservedId);
        }
      }

      return res.status(200).json({ success: true, message: 'Reserved request submitted', request_id: reservedId });
    }

    // No reserved request found for borrower. If items were not provided, we
    // cannot create a new request automatically.
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No reserved request found and no items provided to create a new request' });
    }

    // Fallback legacy behavior: create a new pending request and attach items
    await client.query('BEGIN');

    const insertBorrowRequestQuery = `
      INSERT INTO borrowing_requests (borrower_id, status, request_date, due_date)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '3 days')
      RETURNING id, borrower_id, status, request_date, due_date;
    `;
    const borrowRequestResult = await client.query(insertBorrowRequestQuery, [borrower_id, 'pending']);
    const borrowRequestId = borrowRequestResult.rows[0].id;

    // Process items (same as legacy behavior)
    for (const item of items) {
      if (item.unitId) {
        await client.query(`INSERT INTO borrowing_items (borrowing_id, inventory_unit_id) VALUES ($1, $2)`, [borrowRequestId, item.unitId]);
        await client.query(`UPDATE inventory_units SET status = 'reserved' WHERE id = $1`, [item.unitId]);
      } else if (item.itemId && item.quantity) {
        let unitQuery = `SELECT id FROM inventory_units WHERE inventory_item_id = $1 AND status = 'available'`;
        const params = [item.itemId];
        if (item.size) { unitQuery += ` AND size = $2`; params.push(item.size); }
        unitQuery += ` LIMIT ${item.quantity};`;
        const availableUnits = await client.query(unitQuery, params);
        if (availableUnits.rows.length < item.quantity) throw new Error(`Not enough available units for item ID ${item.itemId}`);
        for (const unit of availableUnits.rows) {
          await client.query(`INSERT INTO borrowing_items (borrowing_id, inventory_unit_id) VALUES ($1, $2)`, [borrowRequestId, unit.id]);
          await client.query(`UPDATE inventory_units SET status = 'reserved' WHERE id = $1`, [unit.id]);
        }
        await client.query(`UPDATE inventory_items SET quantity = GREATEST(quantity - $1, 0) WHERE id = $2`, [item.quantity, item.itemId]);
      }
    }

    await client.query('COMMIT');

    // Notify all staff about this new borrow request (fallback legacy path)
    try {
      const staffResult2 = await pool.query(
        `SELECT id FROM users WHERE role = 'staff'`
      );

      const requestDetails2 = await pool.query(
        `SELECT br.borrower_id, 
                COALESCE(json_agg(json_build_object(
                  'id', ii.uuid,
                  'name', ii.name
                )) FILTER (WHERE ii.uuid IS NOT NULL), '[]'::json) as items,
               u.name as borrower_name
         FROM borrowing_requests br
         LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
         LEFT JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         LEFT JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         JOIN users u ON u.id = br.borrower_id
         WHERE br.id = $1
         GROUP BY br.id, br.borrower_id, u.name`,
        [borrowRequestId]
      );

      if (requestDetails2.rows.length > 0) {
        const { borrower_name, items } = requestDetails2.rows[0];
        const itemsArray2 = typeof items === 'string' ? JSON.parse(items) : items;
        for (const staff of staffResult2.rows) {
          await notifications.sendBorrowRequest(borrower_id, staff.id, itemsArray2, borrower_name, borrowRequestId);
        }
      }
    } catch (notifyErr) {
      console.warn('⚠️ Failed to notify staff for fallback borrow request:', notifyErr.message || notifyErr);
    }

    return res.status(200).json({ success: true, message: 'Borrow request submitted successfully.', borrowRequest: borrowRequestResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Borrow request error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
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
    // ✅ Query all borrowing requests for this user, including items in one go
    const historyRes = await pool.query(
      `
      SELECT 
        br.id AS request_id,
        br.status,
        br.request_date,
        br.due_date,
        br.returned_date,
        u.name AS borrower_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'item_name', ii.name,
              'garment_type', ii.garment_type,
              'category', ii.category,
              'size', iu.size,
              'condition', iu.condition
            )
          ) FILTER (WHERE ii.name IS NOT NULL),
          '[]'
        ) AS items
      FROM borrowing_requests br
      JOIN users u ON u.id = br.borrower_id
      LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
      LEFT JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
      LEFT JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
      WHERE br.borrower_id = $1
      GROUP BY br.id, u.name
      ORDER BY br.created_at DESC;
      `,
      [userId]
    );

    const requests = historyRes.rows.map(req => ({
      ...req,
      items: req.items || [],
    }));

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

    // Get borrower and item details for notification
    const requestDetails = await client.query(
      `SELECT br.borrower_id, 
              COALESCE(json_agg(json_build_object(
                'id', ii.uuid,
                'name', ii.name
              )) FILTER (WHERE ii.uuid IS NOT NULL), '[]'::json) as items
       FROM borrowing_requests br
       LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
       LEFT JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       LEFT JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE br.id = $1
       GROUP BY br.id, br.borrower_id`,
      [id]
    );

    await client.query("COMMIT");

    // Send notification to borrower
    if (requestDetails.rows.length > 0) {
      const { borrower_id, items } = requestDetails.rows[0];
      const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
      // pass related request id so UI can deep-link to their approved request
      await notifications.sendBorrowApproved(borrower_id, itemsArray, id);
    }

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
    // Restore quantity for inventory items associated with this request
    // Add back the number of units that were reserved/borrowed for each inventory item
    await client.query(
      `
      WITH counts AS (
        SELECT u.inventory_item_id::uuid AS item_uuid, COUNT(*) AS cnt
        FROM borrowing_items bi
        JOIN inventory_units u ON bi.inventory_unit_id = u.id
        WHERE bi.borrowing_id = $1::int
        GROUP BY u.inventory_item_id
      )
      UPDATE inventory_items ii
      SET quantity = ii.quantity + counts.cnt
      FROM counts
      WHERE ii.uuid = counts.item_uuid
      `,
      [id]
    );

    // Mark request as declined
    await client.query(
      `UPDATE borrowing_requests SET status = 'declined' WHERE id = $1::int`,
      [id]
    );

    // Get borrower and item details for notification
    const requestDetails = await client.query(
      `SELECT br.borrower_id, 
              COALESCE(json_agg(json_build_object(
                'id', ii.uuid,
                'name', ii.name
              )) FILTER (WHERE ii.uuid IS NOT NULL), '[]'::json) as items
       FROM borrowing_requests br
       LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
       LEFT JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       LEFT JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE br.id = $1
       GROUP BY br.id, br.borrower_id`,
      [id]
    );

    await client.query("COMMIT");

    // Send notification to borrower
    if (requestDetails.rows.length > 0) {
      const { borrower_id, items } = requestDetails.rows[0];
      const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
      // pass related request id so UI can deep-link
      await notifications.sendBorrowDeclined(borrower_id, itemsArray, req.body?.reason || 'No reason provided', id);
    }

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
    // After successful return, notify borrower and staff about the return
    try {
      // Get borrower and item details for notification
      const requestDetails = await client.query(
        `SELECT br.borrower_id, 
                COALESCE(json_agg(json_build_object(
                  'id', ii.uuid,
                  'name', ii.name
                )) FILTER (WHERE ii.uuid IS NOT NULL), '[]'::json) as items
         FROM borrowing_requests br
         LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
         LEFT JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         LEFT JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         WHERE br.id = $1
         GROUP BY br.id, br.borrower_id`,
        [request_id]
      );

      if (requestDetails.rows.length > 0) {
        const { borrower_id, items } = requestDetails.rows[0];
        const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;

        // Notify borrower that their return was processed/approved
        await notifications.sendReturnApproved(borrower_id, itemsArray);

        // Notify all staff about the returned items
        try {
          const staffResult = await pool.query(`SELECT id FROM users WHERE role = 'staff'`);
          for (const staff of staffResult.rows) {
            await notifications.sendReturnRequest(borrower_id, staff.id, itemsArray);
          }
        } catch (staffErr) {
          console.warn('⚠️ Failed to notify staff about return:', staffErr.message || staffErr);
        }
      }
    } catch (notifyErr) {
      console.warn('⚠️ Return notification error:', notifyErr.message || notifyErr);
    }

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

    // If the user already has a reserved request, return it (avoid creating duplicates)
    const reservedRes = await client.query(
      `SELECT id, borrower_id, status, request_date, created_at
       FROM borrowing_requests
       WHERE borrower_id = $1 AND status = 'reserved'
       ORDER BY request_date DESC
       LIMIT 1 FOR UPDATE`,
      [borrower_id]
    );

    if (reservedRes.rowCount > 0) {
      const borrowing = reservedRes.rows[0];
      await client.query("COMMIT");
      return res.status(200).json({
        success: true,
        message: "Existing reserved borrowing session returned",
        borrowingId: borrowing.id,
        borrowing,
      });
    }

    // Fallback: if there's an existing pending request, return that instead of creating another
    const pendingRes = await client.query(
      `SELECT id, borrower_id, status, request_date, created_at
       FROM borrowing_requests
       WHERE borrower_id = $1 AND status = 'pending'
       ORDER BY request_date DESC
       LIMIT 1 FOR UPDATE`,
      [borrower_id]
    );

    if (pendingRes.rowCount > 0) {
      const borrowing = pendingRes.rows[0];
      await client.query("COMMIT");
      return res.status(200).json({
        success: true,
        message: "Existing pending borrowing session returned",
        borrowingId: borrowing.id,
        borrowing,
      });
    }

    // No existing reserved/pending request — create a new RESERVED request (not pending)
    const insertSql = `
      INSERT INTO borrowing_requests (borrower_id, status, request_date, created_at)
      VALUES ($1, 'reserved', NOW(), NOW())
      RETURNING id, borrower_id, status, request_date, created_at;
    `;

    const result = await client.query(insertSql, [borrower_id]);
    const borrowing = result.rows[0];

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Borrowing session started (reserved)",
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

// GET reserved request for a user
const getReservedRequest = async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();

  try {
    // 1️⃣ Find all reserved requests for this user (we now create one request per add)
    const requestsRes = await client.query(
      `SELECT id FROM borrowing_requests
       WHERE borrower_id = $1 AND status = 'reserved'
       ORDER BY request_date DESC`,
      [userId]
    );

    if (requestsRes.rowCount === 0) {
      // No reserved request at all — return 200 with empty items to avoid 404 client errors
      return res.status(200).json({ success: true, request_id: null, request_ids: [], items: [] });
    }

    const requestIds = requestsRes.rows.map((r) => r.id);

    // 2️⃣ Fetch all reserved units linked to these borrowing requests via borrowing_items
    const unitsResult = await client.query(
      `SELECT 
         bi.borrowing_id AS request_id,
         iu.id AS unit_id,
         ii.id AS item_id,
         ii.name,
         ii.category,
         ii.garment_type,
         ii.image_url,
         iu.size,
         iu.status
       FROM borrowing_items bi
       JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
       JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
       WHERE bi.borrowing_id = ANY($1::int[])
       ORDER BY bi.borrowing_id DESC, iu.id`,
      [requestIds]
    );

    // 3️⃣ Return aggregated response (request_id = most recent)
    return res.status(200).json({
      success: true,
      request_id: requestIds[0] || null,
      request_ids: requestIds,
      items: unitsResult.rows || [],
    });
  } catch (err) {
    console.error("❌ Failed to fetch reserved request:", err);
    return res.status(500).json({ error: "Failed to fetch reserved request." });
  } finally {
    client.release();
  }
};

// -----------------------
// Remove a unit or one quantity from reserved cart
// Body: { borrower_id, unit_id?, item_id? }
// If unit_id provided, unlink that unit from its borrowing_items row and restore unit status.
// If item_id provided, unlink one reserved unit for that item belonging to this borrower.
const removeFromCart = async (req, res) => {
  const { borrower_id, unit_id, item_id } = req.body;
  if (!borrower_id || (!unit_id && !item_id)) {
    return res.status(400).json({ error: 'Missing borrower_id or unit_id/item_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find the borrowing_items row and its borrowing_request for this borrower
    let biRes;
    if (unit_id) {
      biRes = await client.query(
        `SELECT bi.borrowing_id, bi.inventory_unit_id
         FROM borrowing_items bi
         JOIN borrowing_requests br ON br.id = bi.borrowing_id
         WHERE bi.inventory_unit_id = $1 AND br.borrower_id = $2 AND br.status = 'reserved'
         LIMIT 1 FOR UPDATE`,
        [unit_id, borrower_id]
      );
    } else {
      // item_id path: find any reserved unit for this item for this borrower
      biRes = await client.query(
        `SELECT bi.borrowing_id, bi.inventory_unit_id
         FROM borrowing_items bi
         JOIN borrowing_requests br ON br.id = bi.borrowing_id
         JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
         JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
         WHERE ii.id = $1 AND br.borrower_id = $2 AND br.status = 'reserved'
         ORDER BY bi.borrowing_id DESC, bi.id DESC
         LIMIT 1 FOR UPDATE`,
        [item_id, borrower_id]
      );
    }

    if (biRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserved unit not found for this borrower' });
    }

    const { borrowing_id, inventory_unit_id } = biRes.rows[0];

    // Delete the borrowing_items row
    await client.query(
      `DELETE FROM borrowing_items WHERE borrowing_id = $1 AND inventory_unit_id = $2`,
      [borrowing_id, inventory_unit_id]
    );

    // Restore unit status to available
    await client.query(
      `UPDATE inventory_units SET status = 'available' WHERE id = $1`,
      [inventory_unit_id]
    );

    // If this borrowing_request has no more items, remove it
    const remaining = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM borrowing_items WHERE borrowing_id = $1`,
      [borrowing_id]
    );
    if (Number(remaining.rows[0].cnt) === 0) {
      await client.query(`DELETE FROM borrowing_requests WHERE id = $1`, [borrowing_id]);
    }

    await client.query('COMMIT');

    return res.json({ success: true, message: 'Removed from cart', borrowing_id, unit_id: inventory_unit_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ removeFromCart error:', err.message || err);
    return res.status(500).json({ error: 'Failed to remove from cart' });
  } finally {
    client.release();
  }
};





module.exports = {
  addToCart,
  removeFromCart,
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
  getReservedRequest,
};
