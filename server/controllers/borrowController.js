// server/controllers/borrowController.js
const pool = require("../db");
const { get } = require("../routes/imageRecognitionRoutes");
const sendEmail = require("../utils/email");
const { v4: uuidv4, validate: isUuid } = require("uuid");
const { notifications } = require("../utils/notifications");
const notificationController = require("../controllers/notificationController");
const path = require("path");
const fs = require("fs");

// ✅ Backend server URL (set in .env, defaults to port 8000 in dev)
// In production, this should be your Render backend URL
const SERVER_URL = process.env.SERVER_URL || "http://localhost:8000";

// Helper: convert relative path to full URL
function toFullUrl(filePath) {
  return filePath ? `${SERVER_URL}${filePath}` : null;
}

// Helper: transform image_url to proper full URL
function transformImageUrl(imageUrl) {
  if (!imageUrl) return null;
  
  if (imageUrl.startsWith('http')) {
    return imageUrl; // Already a full URL
  }
  
  // It's a relative path, ensure it starts with /uploads/ then convert to full URL
  if (!imageUrl.startsWith('/uploads')) {
    imageUrl = `/uploads/${imageUrl}`;
  }
  return toFullUrl(imageUrl);
}

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
  const { borrower_id, items, request_id } = req.body;

  if (!borrower_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing borrower_id or items." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Try to find an existing reserved request for this borrower and reuse it.
    // This allows multiple add-to-cart actions to accumulate into one reserved request
    // so that a single submitBorrowRequest will convert all items at once.
    let requestId_fromDb = request_id; // Use provided request_id first

    if (!requestId_fromDb) {
      const reservedRes = await client.query(
        `SELECT id FROM borrowing_requests WHERE borrower_id = $1 AND status = 'reserved' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [borrower_id]
      );

      if (reservedRes.rowCount > 0) {
        requestId_fromDb = reservedRes.rows[0].id;
        console.log(`🔄 Using existing reserved request: ${requestId_fromDb}`);
      } else {
        const insertRequest = await client.query(
          `INSERT INTO borrowing_requests (borrower_id, status, request_date, created_at)
           VALUES ($1, 'reserved', NOW(), NOW())
           RETURNING id`,
          [borrower_id]
        );
        requestId_fromDb = insertRequest.rows[0].id;
        console.log(`✨ Created new reserved request: ${requestId_fromDb}`);
      }
    }

    const cartItems = [];
    const failedItems = [];

    // 🟢 Loop through items
    for (const item of items) {
      const { unit_id, item_id, quantity } = item;
      const q = Number(quantity) || 1;

      if ((!unit_id && !item_id) || !Number.isInteger(q) || q <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid unit_id/item_id or quantity." });
      }

      // Case 1: Specific unit (QR-based or AI-detected)
      if (unit_id) {
        try {
          const unitResult = await client.query(
            `SELECT iu.id, iu.status, iu.unit_number, iu.size, ii.id AS item_id, ii.name, ii.category, ii.garment_type, ii.image_url
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
            
            console.warn(`⚠️ Unit ${unit_id} not available for adding. Status: ${checkUnit.rows[0]?.status || 'not found'}`);
            failedItems.push({
              unit_id,
              error: checkUnit.rowCount === 0 ? `Unit not found` : `Unit is ${checkUnit.rows[0].status}`,
            });
            continue; // Skip this unit, continue with others
          }

          const unit = unitResult.rows[0];

          // Reserve unit
          await client.query(
            `UPDATE inventory_units SET status = 'reserved' WHERE id = $1 AND status = 'available'`,
            [unit_id]
          );

          // Link the reserved unit to the borrowing request
          await client.query(
            `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
             VALUES ($1, $2)`,
            [requestId_fromDb, unit_id]
          );

          console.log(`✅ Added unit ${unit_id} (${unit.name}) to request ${requestId_fromDb}`);

          cartItems.push({
            unit_id: unit.id,
            item_id: unit.item_id,
            name: unit.name,
            category: unit.category,
            garment_type: unit.garment_type,
            image_url: transformImageUrl(unit.image_url),
            size: unit.size || "nosize",
            unit_number: unit.unit_number,
            quantity: 1,
          });
        } catch (err) {
          console.error(`❌ Error adding unit ${unit_id}:`, err.message);
          failedItems.push({
            unit_id,
            error: err.message,
          });
          // Continue with other units instead of failing entire request
        }
      }

      // Case 2: Quantity-based items (accessories)
      else if (item_id) {
        const availableUnits = await client.query(
          `SELECT iu.id, iu.status, iu.unit_number, iu.size, ii.id AS item_id, ii.name, ii.category, ii.garment_type, ii.image_url
           FROM inventory_units iu
           JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
           WHERE ii.id = $1::int AND iu.status = 'available'
           ORDER BY iu.id
           LIMIT $2 FOR UPDATE SKIP LOCKED`,
          [item_id, q]
        );

        if (availableUnits.rowCount === 0) {
          console.warn(`⚠️ No available units for item ${item_id}`);
          failedItems.push({
            item_id,
            error: `No available stock`,
          });
          continue; // Skip this item, continue with others
        }

        for (const unit of availableUnits.rows) {
          await client.query(
            `UPDATE inventory_units SET status = 'reserved' WHERE id = $1`,
            [unit.id]
          );

          // Link the reserved unit to the borrowing request
          await client.query(
            `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
             VALUES ($1, $2)`,
            [requestId_fromDb, unit.id]
          );

          console.log(`✅ Added unit ${unit.id} (${unit.name}) to request ${requestId_fromDb}`);

          cartItems.push({
            unit_id: unit.id,
            item_id: unit.item_id,
            name: unit.name,
            category: unit.category,
            garment_type: unit.garment_type,
            image_url: transformImageUrl(unit.image_url),
            size: unit.size || "nosize",
            unit_number: unit.unit_number,
            quantity: 1,
          });
        }
      }
    }

    // ✅ NEW: Check if we added at least something
    if (cartItems.length === 0 && failedItems.length > 0) {
      await client.query("ROLLBACK");
      console.error(`❌ All items failed to add:`, failedItems);
      return res.status(400).json({ 
        error: "Failed to add all items",
        failed_items: failedItems,
      });
    }

    await client.query("COMMIT");

    console.log(`✅ Added ${cartItems.length} items to cart (request: ${requestId_fromDb})`);
    if (failedItems.length > 0) {
      console.warn(`⚠️ ${failedItems.length} items failed:`, failedItems);
    }

    return res.status(200).json({
      success: true,
      message: `${cartItems.length} item${cartItems.length !== 1 ? 's' : ''} added to cart${failedItems.length > 0 ? ` (${failedItems.length} failed)` : ''}`,
      request_id: requestId_fromDb,
      items: cartItems,
      failed_items: failedItems.length > 0 ? failedItems : undefined,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error in addToCart:", err.message);
    return res.status(500).json({ error: "Failed to reserve and add to cart." });
  } finally {
    client.release();
  }
};

/**
 * ✅ NEW BATCH ENDPOINT: Add multiple items in ONE transaction
 * Fixes race condition by batching all units -> one requestId -> one FK check
 */
const batchAddToCart = async (req, res) => {
  const { borrower_id, items } = req.body;

  if (!borrower_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing borrower_id or items." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find or create ONE reserved request for all items
    const reservedRes = await client.query(
      `SELECT id FROM borrowing_requests WHERE borrower_id = $1 AND status = 'reserved' 
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [borrower_id]
    );

    let requestId;
    if (reservedRes.rowCount > 0) {
      requestId = reservedRes.rows[0].id;
      console.log(`🔄 Using existing request: ${requestId}`);
    } else {
      const insertRes = await client.query(
        `INSERT INTO borrowing_requests (borrower_id, status, request_date, created_at)
         VALUES ($1, 'reserved', NOW(), NOW())
         RETURNING id`,
        [borrower_id]
      );
      requestId = insertRes.rows[0].id;
      console.log(`✨ Created new request: ${requestId}`);
    }

    const cartItems = [];
    const failedItems = [];

    // Add ALL items in single transaction
    for (const item of items) {
      const { unit_id, item_id, quantity } = item;
      const q = Number(quantity) || 1;

      if ((!unit_id && !item_id) || !Number.isInteger(q) || q <= 0) {
        failedItems.push({ unit_id, item_id, error: "Invalid data" });
        continue;
      }

      // Case 1: Specific unit (AI-detected)
      if (unit_id) {
        try {
          const unitRes = await client.query(
            `SELECT iu.id, iu.status, ii.id AS item_id, ii.name FROM inventory_units iu
             JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
             WHERE iu.id = $1::uuid AND iu.status = 'available' FOR UPDATE SKIP LOCKED`,
            [unit_id]
          );

          if (unitRes.rowCount === 0) {
            failedItems.push({ unit_id, error: "Not available" });
            continue;
          }

          const unit = unitRes.rows[0];

          // Reserve unit
          await client.query(`UPDATE inventory_units SET status = 'reserved' WHERE id = $1`, [unit_id]);

          // Add to borrowing_items - requestId IS GUARANTEED TO EXIST
          await client.query(
            `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id) VALUES ($1, $2)`,
            [requestId, unit_id]
          );

          cartItems.push({ unit_id: unit.id, item_id: unit.item_id, name: unit.name });
          console.log(`✅ Added unit ${unit_id} to request ${requestId}`);
        } catch (err) {
          console.error(`❌ Unit error:`, err.message);
          failedItems.push({ unit_id, error: err.message });
        }
      }
      // Case 2: Quantity-based
      else if (item_id) {
        try {
          const unitsRes = await client.query(
            `SELECT iu.id, ii.id AS item_id, ii.name FROM inventory_units iu
             JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
             WHERE ii.id = $1::int AND iu.status = 'available'
             LIMIT $2 FOR UPDATE SKIP LOCKED`,
            [item_id, q]
          );

          if (unitsRes.rowCount === 0) {
            failedItems.push({ item_id, error: "No stock" });
            continue;
          }

          for (const unit of unitsRes.rows) {
            await client.query(`UPDATE inventory_units SET status = 'reserved' WHERE id = $1`, [unit.id]);
            await client.query(
              `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id) VALUES ($1, $2)`,
              [requestId, unit.id]
            );
            cartItems.push({ unit_id: unit.id, item_id: unit.item_id, name: unit.name });
          }
        } catch (err) {
          failedItems.push({ item_id, error: err.message });
        }
      }
    }

    if (cartItems.length === 0 && failedItems.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Failed to add items", failed_items: failedItems });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      request_id: requestId,
      items: cartItems,
      failed_items: failedItems.length > 0 ? failedItems : undefined,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ batchAddToCart error:", err.message);
    return res.status(500).json({ error: "Failed to add items" });
  } finally {
    client.release();
  }
};




const submitBorrowRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const { borrower_id, items, request_id, quantity, finalQuantity, item_count } = req.body;

    // ✅ CRITICAL: Extract quantity parameter (new field or fallback to finalQuantity)
    const finalQuantityValue = quantity || finalQuantity || (items ? items.length : 0);
    const itemCountValue = item_count || (items ? items.length : 0);

    console.log(`📋 submitBorrowRequest - Quantity Info:`, {
      providedQuantity: quantity,
      providedFinalQuantity: finalQuantity,
      providedItemCount: item_count,
      calculatedFinalQuantity: finalQuantityValue,
      calculatedItemCount: itemCountValue,
      itemsLength: items ? items.length : 0
    });

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

      // ✅ CRITICAL: Update with quantity and submitted_at columns
      await client.query(
        `UPDATE borrowing_requests 
         SET status = 'pending', 
             request_date = NOW(), 
             quantity = $1,
             item_count = $2,
             submitted_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [finalQuantityValue, itemCountValue, request_id]
      );

      await client.query('COMMIT');
      
      console.log(`✅ Updated borrowing_requests - quantity: ${finalQuantityValue}, item_count: ${itemCountValue}`);

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

      // Send notifications to all staff members
      if (requestDetails.rows.length > 0) {
        const { borrower_name, items } = requestDetails.rows[0];
        const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
        
        // ✅ Get borrower's role to prevent self-notification for staff
        const borrowerInfo = await client.query(`SELECT role FROM users WHERE id = $1`, [borrower_id]);
        const borrowerRole = borrowerInfo.rows[0]?.role || null;
        
        for (const staff of staffResult.rows) {
          // fire-and-forget notifications; do not block the response if they fail
          notifications.sendBorrowRequest(borrower_id, staff.id, itemsArray, borrower_name, request_id, borrowerRole).catch((e) => {
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
      
      // ✅ CRITICAL: Update with quantity and item_count for reserved request path
      await client.query(
        `UPDATE borrowing_requests 
         SET status = 'pending', 
             request_date = NOW(),
             quantity = $1,
             item_count = $2,
             submitted_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [finalQuantityValue, itemCountValue, reservedId]
      );
      
      console.log(`✅ Updated reserved borrowing_requests - quantity: ${finalQuantityValue}, item_count: ${itemCountValue}`);
      
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
        
        // ✅ Get borrower's role to prevent self-notification for staff
        const borrowerInfo = await db.query(`SELECT role FROM users WHERE id = $1`, [borrower_id]);
        const borrowerRole = borrowerInfo.rows[0]?.role || null;
        
        for (const staff of staffResult.rows) {
          // Pass the related request id so notification records can be correlated to the request
          await notifications.sendBorrowRequest(borrower_id, staff.id, itemsArray, borrower_name, reservedId, borrowerRole);
        }
      }

      return res.status(200).json({ success: true, message: 'Reserved request submitted', request_id: reservedId, quantity: finalQuantityValue, item_count: itemCountValue });
    }

    // No reserved request found for borrower. If items were not provided, we
    // cannot create a new request automatically.
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No reserved request found and no items provided to create a new request' });
    }

    // Fallback legacy behavior: create a new pending request and attach items
    await client.query('BEGIN');

    const insertBorrowRequestQuery = `
      INSERT INTO borrowing_requests (borrower_id, status, request_date, due_date, quantity, item_count, submitted_at)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '3 days', $3, $4, CURRENT_TIMESTAMP)
      RETURNING id, borrower_id, status, request_date, due_date, quantity, item_count;
    `;
    const borrowRequestResult = await client.query(insertBorrowRequestQuery, [borrower_id, 'pending', finalQuantityValue, itemCountValue]);
    const borrowRequestId = borrowRequestResult.rows[0].id;

    console.log(`✅ Created new borrowing_request - id: ${borrowRequestId}, quantity: ${finalQuantityValue}, item_count: ${itemCountValue}`);

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
        
        // ✅ Get borrower's role to prevent self-notification for staff
        const borrowerInfo = await db.query(`SELECT role FROM users WHERE id = $1`, [borrower_id]);
        const borrowerRole = borrowerInfo.rows[0]?.role || null;
        
        for (const staff of staffResult2.rows) {
          await notifications.sendBorrowRequest(borrower_id, staff.id, itemsArray2, borrower_name, borrowRequestId, borrowerRole);
        }
      }
    } catch (notifyErr) {
      console.warn('⚠️ Failed to notify staff for fallback borrow request:', notifyErr.message || notifyErr);
    }

    return res.status(200).json({ success: true, message: 'Borrow request submitted successfully.', borrowRequest: borrowRequestResult.rows[0], quantity: finalQuantityValue, item_count: itemCountValue });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Borrow request error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};


// ✅ Updated getBorrowHistory to handle UUIDs correctly and calculate overdue status
const getBorrowHistory = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "Missing borrower ID" });
  }

  try {
    // ✅ Query all borrowing requests for this user, including items in one go
    // ✅ Fixed: Use returned_at (correct column name) instead of returned_date
    // ✅ Added: Calculate overdue status and days remaining in backend for accuracy
    // ✅ FIXED: Include unit_number in the items JSON response
    // ✅ NEW: Include all timestamp fields (created_at, request_date, approved_at, due_date, returned_at) for timeline visualization
    // ✅ NEW: Include return_decline_reason to show warning when return was declined
    const historyRes = await pool.query(
      `
      SELECT 
        br.id AS request_id,
        br.status,
        br.created_at,
        br.request_date,
        br.approved_at,
        br.due_date,
        br.returned_at,
        br.return_decline_reason,
        br.declined_at,
        CURRENT_DATE AS today,
        CASE 
          WHEN br.status = 'returned' THEN false
          WHEN br.due_date IS NOT NULL AND br.due_date::date < CURRENT_DATE THEN true
          ELSE false
        END AS is_overdue,
        CASE 
          WHEN br.due_date IS NOT NULL THEN br.due_date::date - CURRENT_DATE
          ELSE NULL
        END AS days_until_due,
        u.name AS borrower_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', iu.id,
              'unit_number', iu.unit_number,
              'item_name', ii.name,
              'garment_type', ii.garment_type,
              'category', ii.category,
              'size', iu.size,
              'condition', iu.condition,
              'image_url', ii.image_url
            )
          ) FILTER (WHERE ii.name IS NOT NULL),
          '[]'
        ) AS items
      FROM borrowing_requests br
      JOIN users u ON u.id = br.borrower_id
      LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
      LEFT JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
      LEFT JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
      WHERE br.borrower_id = $1 AND (br.is_deleted = false OR br.is_deleted IS NULL)
      GROUP BY br.id, u.name
      ORDER BY 
        CASE WHEN br.due_date < CURRENT_DATE AND br.status != 'returned' THEN 0 ELSE 1 END,
        br.due_date ASC,
        br.created_at DESC;
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

// ✅ NEW: Delete a borrow request from history
const deleteFromHistory = async (req, res) => {
  const { requestId } = req.params;
  const { borrower_id } = req.query;

  if (!requestId || !borrower_id) {
    return res.status(400).json({ error: "Missing requestId or borrower_id" });
  }

  try {
    // Verify ownership: request belongs to the borrower
    const ownershipRes = await pool.query(
      `SELECT id FROM borrowing_requests WHERE id = $1 AND borrower_id = $2`,
      [requestId, borrower_id]
    );

    if (ownershipRes.rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized: request does not belong to borrower" });
    }

    // Soft delete by setting status to 'deleted' (if you want to keep history)
    // OR hard delete directly. We'll use soft delete for audit trail.
    const updateRes = await pool.query(
      `UPDATE borrowing_requests 
       SET deleted_at = NOW(), is_deleted = true
       WHERE id = $1
       RETURNING id`,
      [requestId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ success: true, message: "Request deleted from history" });
  } catch (err) {
    console.error("❌ Delete from history error:", err.message);
    res.status(500).json({ error: "Failed to delete from history" });
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
         u.division_id,
         d.name AS borrower_division,
         br.status,
         br.created_at AS request_date,
         br.due_date,
         br.returned_at,
         br.quantity,
         br.item_count,
         br.submitted_at,
         br.approved_at,
         br.return_decline_reason,
         br.declined_at
       FROM borrowing_requests br
       JOIN users u ON u.id = br.borrower_id
       LEFT JOIN divisions d ON d.id = u.division_id
       ORDER BY br.created_at DESC`
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
      
      // ✅ Log requests with quantity info
      console.log(`📦 Request ${req.id}: status=${req.status}, quantity=${req.quantity}, items_from_db=${req.items.length}`);
    }

    console.log(`✅ getAllBorrowRequests - Loaded ${requests.length} requests with quantities`);
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

    // Approve request - also set approved_at timestamp for timeline
    await client.query(
      `
      UPDATE borrowing_requests
      SET status = 'approved', staff_id = $1, due_date = $2, approved_at = NOW()
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
      try {
        const sendResult = await notifications.sendBorrowApproved(borrower_id, itemsArray, id, req.user?.id);
        // If initial send failed (no active subscriptions or transient failures), attempt a resend
        if (!sendResult || sendResult.success === false) {
          console.warn(`⚠️ Initial push send to borrower ${borrower_id} failed or queued; attempting resend.`);
          try {
            await notificationController.resendPendingForUser(borrower_id);
          } catch (rrErr) {
            console.error('❌ Resend attempt failed:', rrErr && rrErr.message ? rrErr.message : rrErr);
          }
        }
      } catch (notifyErr) {
        console.error('❌ Error sending borrower notification on approval:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
      }
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
      try {
        const sendResult = await notifications.sendBorrowDeclined(borrower_id, itemsArray, req.body?.reason || 'No reason provided', id, req.user?.id);
        // If initial send failed (no active subscriptions), attempt a resend
        if (!sendResult || sendResult.success === false) {
          console.warn(`⚠️ Initial push send to borrower ${borrower_id} for decline failed or queued; attempting resend.`);
          try {
            await notificationController.resendPendingForUser(borrower_id);
          } catch (rrErr) {
            console.error('❌ Resend attempt failed:', rrErr && rrErr.message ? rrErr.message : rrErr);
          }
        }
      } catch (notifyErr) {
        console.error('❌ Error sending decline notification to borrower:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
      }
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
        `SELECT br.borrower_id, u.role as borrower_role,
                COALESCE(json_agg(json_build_object(
                  'id', ii.uuid,
                  'name', ii.name
                )) FILTER (WHERE ii.uuid IS NOT NULL), '[]'::json) as items
         FROM borrowing_requests br
         LEFT JOIN borrowing_items bi ON bi.borrowing_id = br.id
         LEFT JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         LEFT JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         JOIN users u ON br.borrower_id = u.id
         WHERE br.id = $1
         GROUP BY br.id, br.borrower_id, u.role`,
        [request_id]
      );

      if (requestDetails.rows.length > 0) {
        const { borrower_id, borrower_role, items } = requestDetails.rows[0];
        const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;

        // Notify borrower that their return was processed/approved
        try {
          const sendResult = await notifications.sendReturnApproved(borrower_id, itemsArray, req.user?.id);
          // If initial send failed (no active subscriptions), attempt a resend
          if (!sendResult || sendResult.success === false) {
            console.warn(`⚠️ Initial push send to borrower ${borrower_id} for return approved failed or queued; attempting resend.`);
            try {
              await notificationController.resendPendingForUser(borrower_id);
            } catch (rrErr) {
              console.error('❌ Resend attempt failed:', rrErr && rrErr.message ? rrErr.message : rrErr);
            }
          }
        } catch (notifyErr) {
          console.error('❌ Error sending return approved notification to borrower:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
        }

        // Notify all staff about the returned items (but skip if borrower is staff)
        try {
          const staffResult = await pool.query(`SELECT id FROM users WHERE role = 'staff'`);
          for (const staff of staffResult.rows) {
            await notifications.sendReturnRequest(borrower_id, staff.id, itemsArray, borrower_role);
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
    const data = result.rows[0];
    if (data && data.image_url) {
      data.image_url = transformImageUrl(data.image_url);
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("❌ QR code scan error:", err);
    return res.status(500).json({ error: "Failed to fetch QR code data" });
  }
};

// -----------------------
// 🛒 Update Borrow Cart Quantity (Reserve/Release Units)
// -----------------------
// ✅ NEW: Save cart quantity to borrowing_requests
const saveCartQuantity = async (req, res) => {
  const { borrower_id, quantity, cart } = req.body;

  if (!borrower_id || quantity === undefined || !Array.isArray(cart)) {
    return res.status(400).json({ error: "Missing borrower_id, quantity, or cart array" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ✅ FIXED: Look for EITHER 'reserved' OR 'pending' status
    // 'reserved' = still building cart
    // 'pending' = already submitted but still being edited
    const result = await client.query(
      `SELECT id FROM borrowing_requests 
       WHERE borrower_id = $1 AND status IN ('reserved', 'pending')
       ORDER BY created_at DESC LIMIT 1`,
      [borrower_id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn(`⚠️ saveCartQuantity: No reserved/pending request found for borrower ${borrower_id}`);
      return res.status(404).json({ error: "No active request found for this borrower" });
    }

    const requestId = result.rows[0].id;

    // Update quantity and item_count
    await client.query(
      `UPDATE borrowing_requests 
       SET quantity = $1, item_count = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [quantity, cart.length, requestId]
    );

    await client.query("COMMIT");

    console.log(`✅ Saved cart quantity - request_id: ${requestId}, quantity: ${quantity}, item_count: ${cart.length}`);

    return res.json({
      success: true,
      message: "Cart quantity saved",
      request_id: requestId,
      quantity: quantity,
      item_count: cart.length
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ saveCartQuantity error:", err.message || err);
    res.status(500).json({ error: "Failed to save cart quantity" });
  } finally {
    client.release();
  }
};

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
  // ✅ FIXED: Use authenticated user ID instead of relying on borrower_id from body
  const borrower_id = req.user?.id;

  if (!borrower_id) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ✅ FIXED: Only look for RESERVED requests - don't reuse pending/approved/returned requests
    // This ensures each detection session gets its own cart
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
      console.log(`✅ Reusing existing reserved session for borrower ${borrower_id}: ${borrowing.id}`);
      return res.status(200).json({
        success: true,
        message: "Existing reserved borrowing session returned",
        borrowingId: borrowing.id,
        request_id: borrowing.id,
        borrowing,
      });
    }

    // ✅ FIXED: Don't fall back to pending/approved requests
    // If no reserved request exists, always create a NEW one
    // This prevents attaching new detections to already-submitted requests
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
      request_id: borrowing.id,  // ✅ FIXED: Include request_id for consistency
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
    // 1️⃣ Find the most recent reserved request for this user
    const requestRes = await client.query(
      `SELECT id, quantity FROM borrowing_requests
       WHERE borrower_id = $1 AND status = 'reserved'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (requestRes.rowCount === 0) {
      // No reserved request found
      return res.status(200).json({ success: true, request_id: null, items: [] });
    }

    const requestId = requestRes.rows[0].id;
    const savedQuantity = requestRes.rows[0].quantity || 0;

    console.log(`📦 getReservedRequest - Loading request ${requestId} with saved quantity: ${savedQuantity}`);

    // 2️⃣ Fetch all reserved units linked to this borrowing request
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
         iu.unit_number,
         iu.status
       FROM borrowing_items bi
       JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
       JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
       WHERE bi.borrowing_id = $1
       ORDER BY iu.id`,
      [requestId]
    );

    const baseItems = unitsResult.rows || [];
    let finalItems = [];

    if (savedQuantity > 0 && baseItems.length > 0) {
      // ✅ Use saved quantity to reconstruct the cart
      // If saved quantity is greater than base items, create temporary units for the extra quantity
      const baseItem = baseItems[0]; // Use first item as template
      const extraQuantity = Math.max(0, savedQuantity - baseItems.length);

      // Add all real items first
      finalItems = [...baseItems];

      // Add temporary units for extra quantity
      for (let i = 0; i < extraQuantity; i++) {
        finalItems.push({
          ...baseItem,
          unit_id: `temp-${baseItem.item_id}-${requestId}-${i}`,
          unitId: `temp-${baseItem.item_id}-${requestId}-${i}`,
        });
      }

      console.log(`✅ Reconstructed cart: ${baseItems.length} real units + ${extraQuantity} temporary units = ${finalItems.length} total`);
    } else {
      finalItems = baseItems;
    }

    // 3️⃣ Return response with reconstructed items
    return res.status(200).json({
      success: true,
      request_id: requestId,
      items: finalItems,
      quantity: savedQuantity,
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
      // Unit not found in reserved request - this can happen if already deleted or in different status
      // Return success anyway to allow cleanup
      await client.query('ROLLBACK');
      console.warn(`⚠️ Unit ${unit_id} not found in reserved request for borrower ${borrower_id}. Already removed or in different status.`);
      return res.status(200).json({ success: true, message: 'Unit already removed or not found', already_removed: true });
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
    console.error('❌ removeFromCart error:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      sqlState: err.sqlState,
      stack: err.stack
    });
    return res.status(500).json({ 
      error: 'Failed to remove from cart',
      details: err.message
    });
  } finally {
    client.release();
  }
};





// ============================================================
// 📸 PHOTO UPLOAD CONTROLLERS
// ============================================================

/**
 * Upload a photo for a borrow request
 * POST /api/borrow/photos/:requestId/upload
 */
const uploadBorrowPhoto = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!requestId || !userId) {
      return res.status(401).json({ error: "User not authenticated or requestId missing" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded" });
    }

    const client = await pool.connect();
    try {
      // Verify the request exists and belongs to this user (or they're staff)
      const reqCheck = await client.query(
        `SELECT id, borrower_id FROM borrowing_requests WHERE id = $1`,
        [requestId]
      );

      if (reqCheck.rowCount === 0) {
        return res.status(404).json({ error: "Borrow request not found" });
      }

      const borrowRequest = reqCheck.rows[0];
      const isOwner = borrowRequest.borrower_id === userId;

      // Allow owner to upload - no need for role check from database
      if (!isOwner) {
        // For now, allow any authenticated user (can be restricted later)
        // In production, add role check from req.user if available
      }

      // Insert photo record into database
      const photoResult = await client.query(
        `INSERT INTO borrowing_request_photos 
         (borrowing_request_id, photo_url, photo_type, uploaded_by, storage_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, photo_url, uploaded_at`,
        [
          requestId,
          `/uploads/borrow-photos/${req.file.filename}`,
          req.body.photoType || "item-photo",
          userId,
          req.file.path,
          req.file.size,
          req.file.mimetype,
        ]
      );

      // Update borrowing_requests to mark photos as captured
      await client.query(
        `UPDATE borrowing_requests SET photos_captured = true, photo_capture_date = NOW() WHERE id = $1`,
        [requestId]
      );

      res.json({
        success: true,
        photo: photoResult.rows[0],
        message: "Photo uploaded successfully",
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Photo upload error:", err);
    res.status(500).json({ error: "Failed to upload photo" });
  }
};

/**
 * Get all photos for a borrow request
 * GET /api/borrow/photos/:requestId
 */
const getBorrowPhotos = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const client = await pool.connect();
    try {
      // Fetch all photos for this request
      const photosResult = await client.query(
        `SELECT id, photo_url, photo_type, uploaded_at, uploaded_by FROM borrowing_request_photos
         WHERE borrowing_request_id = $1
         ORDER BY uploaded_at DESC`,
        [requestId]
      );

      // ✅ Use dynamic URL construction based on request origin/host
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
      const baseUrl = `${protocol}://${host}`;

      // ✅ Transform relative paths to full URLs
      const photosWithUrls = photosResult.rows.map((photo) => ({
        ...photo,
        photo_url: `${baseUrl}${photo.photo_url}`,
      }));

      res.json({
        success: true,
        photos: photosWithUrls,
        photoCount: photosResult.rowCount,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Failed to fetch photos:", err);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
};

/**
 * Delete a photo
 * DELETE /api/borrow/photos/:photoId
 */
const deleteBorrowPhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const client = await pool.connect();
    try {
      // Get photo to verify ownership and get file path
      const photoCheck = await client.query(
        `SELECT id, storage_path, borrowing_request_id FROM borrowing_request_photos WHERE id = $1`,
        [photoId]
      );

      if (photoCheck.rowCount === 0) {
        return res.status(404).json({ error: "Photo not found" });
      }

      const photo = photoCheck.rows[0];

      // Verify user can delete this photo (is owner or staff)
      const reqCheck = await client.query(
        `SELECT borrower_id FROM borrowing_requests WHERE id = $1`,
        [photo.borrowing_request_id]
      );

      const isOwner = reqCheck.rows[0]?.borrower_id === userId;
      const isStaff = req.user?.role === "staff" || req.user?.role === "admin";

      if (!isOwner && !isStaff) {
        return res.status(403).json({ error: "Unauthorized to delete this photo" });
      }

      // Delete from database
      await client.query(
        `DELETE FROM borrowing_request_photos WHERE id = $1`,
        [photoId]
      );

      // Delete file from storage
      try {
        const fs = require("fs");
        if (fs.existsSync(photo.storage_path)) {
          fs.unlinkSync(photo.storage_path);
        }
      } catch (fileErr) {
        console.warn("⚠️ Could not delete file:", fileErr.message);
      }

      res.json({ success: true, message: "Photo deleted successfully" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Photo deletion error:", err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
};

// ============================================================
// 📸 RETURN PHOTO FUNCTIONS
// ============================================================

const initiateReturn = async (req, res) => {
  const { borrowing_request_id, returned_unit_ids = [], notes = "" } = req.body;

  if (!borrowing_request_id || returned_unit_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing borrowing_request_id or returned_unit_ids",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify request exists and is in approvable state
    const reqCheck = await client.query(
      `SELECT id, borrower_id, status FROM borrowing_requests WHERE id = $1`,
      [borrowing_request_id]
    );

    if (reqCheck.rows.length === 0) {
      throw new Error("Borrowing request not found");
    }

    const borrowRequest = reqCheck.rows[0];
    if (!["approved", "pending_return"].includes(borrowRequest.status)) {
      throw new Error("Request is not in a returnable state");
    }

    // Create return request entry
    const returnReqResult = await client.query(
      `INSERT INTO return_requests (borrowing_request_id, borrower_id, notes, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [borrowing_request_id, borrowRequest.borrower_id, notes, "pending"]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      return_request_id: returnReqResult.rows[0].id,
      message: "Return initiated. Proceed to capture photos.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Initiate return error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

const uploadReturnPhoto = async (req, res) => {
  const { requestId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }

  const client = await pool.connect();
  try {
    // Verify request exists
    const reqCheck = await client.query(
      `SELECT id FROM borrowing_requests WHERE id = $1`,
      [requestId]
    );

    if (reqCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    const photoUrl = `/uploads/return-photos/${req.file.filename}`;

    const result = await client.query(
      `INSERT INTO return_request_photos (borrowing_request_id, photo_url, photo_type, uploaded_by, storage_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, photo_url, uploaded_at, storage_path, file_size, mime_type`,
      [
        requestId,
        photoUrl,
        "return-photo",
        req.user.id,
        req.file.path,
        req.file.size,
        req.file.mimetype,
      ]
    );

    // ✅ Use dynamic URL construction for the response
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
    const baseUrl = `${protocol}://${host}`;

    res.json({
      success: true,
      photo: {
        ...result.rows[0],
        photo_url: `${baseUrl}${result.rows[0].photo_url}`
      },
      message: "Return photo uploaded successfully",
    });
  } catch (err) {
    console.error("Upload return photo error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

const getReturnPhotos = async (req, res) => {
  const { requestId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, photo_url, photo_type, uploaded_by, uploaded_at, mime_type, storage_path, file_size
       FROM return_request_photos
       WHERE borrowing_request_id = $1
       ORDER BY uploaded_at DESC`,
      [requestId]
    );

    // ✅ Use dynamic URL construction based on request origin/host
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
    const baseUrl = `${protocol}://${host}`;

    const photosWithUrls = result.rows.map(photo => ({
      ...photo,
      // Ensure photo_url is a full URL path that the frontend can load
      photo_url: photo.photo_url.startsWith('http') ? photo.photo_url : `${baseUrl}${photo.photo_url}`,
      // Ensure storage_path is available for fallback
      storage_path: photo.storage_path,
      // Include file_size for display
      file_size: photo.file_size,
      // Add mimetype for image validation
      mime_type: photo.mime_type || 'image/jpeg'
    }));

    res.json({
      success: true,
      photos: photosWithUrls,
    });
  } catch (err) {
    console.error("Get return photos error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

const deleteReturnPhoto = async (req, res) => {
  const { photoId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  const client = await pool.connect();
  try {
    const photoResult = await client.query(
      `SELECT storage_path FROM return_request_photos WHERE id = $1`,
      [photoId]
    );

    if (photoResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Photo not found" });
    }

    // Delete from database
    await client.query(`DELETE FROM return_request_photos WHERE id = $1`, [photoId]);

    // Delete file
    const fs = require("fs");
    if (photoResult.rows[0].storage_path && fs.existsSync(photoResult.rows[0].storage_path)) {
      fs.unlinkSync(photoResult.rows[0].storage_path);
    }

    res.json({
      success: true,
      message: "Return photo deleted",
    });
  } catch (err) {
    console.error("Delete return photo error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

const submitReturn = async (req, res) => {
  const { return_request_id, borrowing_request_id, photos_count } = req.body;

  if (!return_request_id || !borrowing_request_id) {
    return res.status(400).json({
      success: false,
      error: "Missing return_request_id or borrowing_request_id",
    });
  }

  if (photos_count === 0) {
    return res.status(400).json({
      success: false,
      error: "No photos to submit",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get borrower name, id, and role before updating
    const borrowerRes = await client.query(
      `SELECT u.name, u.id as borrower_id, u.role FROM borrowing_requests br
       JOIN users u ON br.borrower_id = u.id
       WHERE br.id = $1`,
      [borrowing_request_id]
    );
    const borrowerName = borrowerRes.rows[0]?.name || "Borrower";
    const borrowerRole = borrowerRes.rows[0]?.role || null;

    // Get items being returned
    const itemsRes = await client.query(
      `SELECT DISTINCT ii.id, ii.name FROM borrowing_items bi
       JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE bi.borrowing_id = $1`,
      [borrowing_request_id]
    );
    const items = itemsRes.rows;

    // Update return request status to "submitted" (awaiting staff review)
    await client.query(
      `UPDATE return_requests SET status = $1, updated_at = NOW() WHERE id = $2`,
      ["submitted", return_request_id]
    );

    // Mark return photos as captured and change status to pending_return
    // pending_return = awaiting staff verification of returned items
    await client.query(
      `UPDATE borrowing_requests 
       SET return_photos_captured = true, 
           return_photo_capture_date = NOW(),
           status = $1
       WHERE id = $2`,
      ["pending_return", borrowing_request_id]
    );

    await client.query("COMMIT");

    // Send notification to all staff that return was submitted (but skip if borrower is staff)
    if (notifications && notifications.sendReturnSubmitted) {
      await notifications.sendReturnSubmitted(
        borrowerRes.rows[0]?.borrower_id,
        borrowerName,
        items,
        borrowerRole
      );
    }

    res.json({
      success: true,
      message: "✅ Return submitted! Staff will verify your returned items.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Submit return error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// Staff approves return and marks items as returned
const approveReturn = async (req, res) => {
  const { borrowing_request_id, notes } = req.body;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  if (!borrowing_request_id) {
    return res.status(400).json({
      success: false,
      error: "Missing borrowing_request_id",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify the request is in pending_return status
    const checkRes = await client.query(
      `SELECT id, borrower_id FROM borrowing_requests WHERE id = $1 AND status = $2`,
      [borrowing_request_id, "pending_return"]
    );

    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Return request not found or already processed",
      });
    }

    const borrowerId = checkRes.rows[0].borrower_id;

    // Get items being returned for notification
    const itemsRes = await client.query(
      `SELECT DISTINCT ii.name FROM borrowing_items bi
       JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE bi.borrowing_id = $1`,
      [borrowing_request_id]
    );
    const items = itemsRes.rows; // Keep as objects with .name property

    // Update borrowing request status to "returned" and mark as completed
    await client.query(
      `UPDATE borrowing_requests 
       SET status = $1, returned_at = NOW()
       WHERE id = $2`,
      ["returned", borrowing_request_id]
    );

    // Update return request status to "approved"
    await client.query(
      `UPDATE return_requests 
       SET status = $1, updated_at = NOW()
       WHERE borrowing_request_id = $2`,
      ["approved", borrowing_request_id]
    );

    // Mark all inventory units as available (returned)
    await client.query(
      `UPDATE inventory_units 
       SET status = 'available'
       WHERE id IN (
         SELECT inventory_unit_id FROM borrowing_items 
         WHERE borrowing_id = $1 AND inventory_unit_id IS NOT NULL
       )`,
      [borrowing_request_id]
    );

    await client.query("COMMIT");

    // Send notification to borrower that return was approved ✅ Successfully Returned
    if (notifications && notifications.sendReturnApproved) {
      await notifications.sendReturnApproved(borrowerId, items, req.user?.id);
    }

    res.json({
      success: true,
      message: "✅ Return verified and accepted! Items marked as returned.",
      borrowerId,
      items,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Approve return error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// Decline/Reject return request (staff rejects the return submission)
// Moves request back to "approved" status and allows borrower to resubmit
const declineReturn = async (req, res) => {
  const { borrowing_request_id, reason } = req.body;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  if (!borrowing_request_id) {
    return res.status(400).json({
      success: false,
      error: "Missing borrowing_request_id",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify the request is in pending_return status
    const checkRes = await client.query(
      `SELECT id, borrower_id FROM borrowing_requests WHERE id = $1 AND status = $2`,
      [borrowing_request_id, "pending_return"]
    );

    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Return request not found or already processed",
      });
    }

    const borrowerId = checkRes.rows[0].borrower_id;

    // Get items for notification
    const itemsRes = await client.query(
      `SELECT DISTINCT ii.name FROM borrowing_items bi
       JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE bi.borrowing_id = $1`,
      [borrowing_request_id]
    );
    const items = itemsRes.rows; // Keep as objects with .name property

    // Standard decline message if no reason provided
    const declineMessage = "Item not found please return it in the office";

    // Move request back to "approved" status (borrower can resubmit return)
    // Store the decline reason in return_decline_reason column
    await client.query(
      `UPDATE borrowing_requests 
       SET status = $1, return_decline_reason = $2, declined_at = NOW()
       WHERE id = $3`,
      ["approved", declineMessage, borrowing_request_id]
    );

    // Update return request status to "declined" with notes
    await client.query(
      `UPDATE return_requests 
       SET status = $1, notes = $2, updated_at = NOW()
       WHERE borrowing_request_id = $3`,
      ["rejected", reason || "", borrowing_request_id]
    );

    await client.query("COMMIT");

    // Send notification to borrower that return was declined
    if (notifications && notifications.sendReturnDeclined) {
      await notifications.sendReturnDeclined(borrowerId, items, reason, req.user?.id);
    }

    res.json({
      success: true,
      message: "✅ Return request declined. Borrower can resubmit.",
      borrowerId,
      items,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Decline return error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// Staff manually processes return without borrower submission
// Used when borrower walks in and returns items directly to staff
const staffManualReturn = async (req, res) => {
  const { borrowing_request_id, notes } = req.body;

  if (!borrowing_request_id) {
    return res.status(400).json({ error: "Missing borrowing_request_id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if request exists and status is "approved" (hasn't been submitted yet)
    const checkRes = await client.query(
      `SELECT status, borrower_id FROM borrowing_requests WHERE id = $1`,
      [borrowing_request_id]
    );

    if (checkRes.rows.length === 0) {
      throw new Error("Borrow request not found");
    }

    const { status, borrower_id } = checkRes.rows[0];

    // Allow staff to manually return items that are either:
    // 1. Still "approved" (not submitted by borrower yet)
    // 2. "pending_return" (submitted by borrower but we can override)
    if (!["approved", "pending_return"].includes(status)) {
      throw new Error("Request cannot be manually returned in current status: " + status);
    }

    // Get items being returned for notification
    const itemsRes = await client.query(
      `SELECT DISTINCT ii.name FROM borrowing_items bi
       JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE bi.borrowing_id = $1`,
      [borrowing_request_id]
    );
    const items = itemsRes.rows; // Keep as objects with .name property

    // Mark all inventory units as available (returned)
    await client.query(
      `UPDATE inventory_units 
       SET status = 'available'
       WHERE id IN (
         SELECT inventory_unit_id FROM borrowing_items 
         WHERE borrowing_id = $1 AND inventory_unit_id IS NOT NULL
       )`,
      [borrowing_request_id]
    );

    // Update borrowing request status to "returned"
    await client.query(
      `UPDATE borrowing_requests 
       SET status = $1, returned_at = NOW()
       WHERE id = $2`,
      ["returned", borrowing_request_id]
    );

    // If there was a pending return request, mark it as handled
    await client.query(
      `UPDATE return_requests 
       SET status = 'approved', updated_at = NOW()
       WHERE borrowing_request_id = $1 AND status IN ('pending', 'submitted')`,
      [borrowing_request_id]
    );

    await client.query("COMMIT");

    // Send notification to borrower about manual return (optional)
    if (notifications && notifications.sendReturnApproved) {
      await notifications.sendReturnApproved(borrower_id, items, req.user?.id);
    }

    res.json({
      success: true,
      message: "✅ Items manually received and processed!",
      borrower_id,
      items,
      notes: notes || "",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Staff manual return error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// Staff manual return with photos - captures photos before marking as received
const staffManualReturnWithPhotos = async (req, res) => {
  const { borrowing_request_id } = req.body;
  const files = req.files;
  const staffUserId = req.user?.id;

  if (!borrowing_request_id) {
    return res.status(400).json({ error: "Missing borrowing_request_id" });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No photos provided" });
  }

  if (!staffUserId) {
    return res.status(401).json({ error: "Staff user not authenticated" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if request exists and status is "approved"
    const checkRes = await client.query(
      `SELECT status, borrower_id FROM borrowing_requests WHERE id = $1`,
      [borrowing_request_id]
    );

    if (checkRes.rows.length === 0) {
      throw new Error("Borrow request not found");
    }

    const { status, borrower_id } = checkRes.rows[0];

    if (!["approved", "pending_return"].includes(status)) {
      throw new Error("Request cannot be manually returned in current status: " + status);
    }

    // Create directory for storing photos
    const photoDir = path.join(process.cwd(), "public", "uploads", "return-photos", borrowing_request_id.toString());
    
    if (!fs.existsSync(photoDir)) {
      fs.mkdirSync(photoDir, { recursive: true });
    }

    const photoFilenames = [];
    
    // Save each photo and record in database
    for (const file of files) {
      const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const filepath = path.join(photoDir, filename);
      const relativePath = `return-photos/${borrowing_request_id}/${filename}`;
      
      // Write file to disk
      await fs.promises.writeFile(filepath, file.buffer);
      photoFilenames.push(filename);

      // Insert into return_request_photos table
      await client.query(
        `INSERT INTO return_request_photos 
         (borrowing_request_id, photo_url, photo_type, uploaded_by, storage_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          borrowing_request_id,
          `/${relativePath}`, // photo_url
          'return-photo', // photo_type
          staffUserId, // uploaded_by
          relativePath, // storage_path
          file.size, // file_size
          file.mimetype, // mime_type
        ]
      );
    }

    // Get items being returned for notification
    const itemsRes = await client.query(
      `SELECT DISTINCT ii.name FROM borrowing_items bi
       JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       WHERE bi.borrowing_id = $1`,
      [borrowing_request_id]
    );
    const items = itemsRes.rows;

    // Mark all inventory units as available (returned)
    await client.query(
      `UPDATE inventory_units 
       SET status = 'available'
       WHERE id IN (
         SELECT inventory_unit_id FROM borrowing_items 
         WHERE borrowing_id = $1 AND inventory_unit_id IS NOT NULL
       )`,
      [borrowing_request_id]
    );

    // Update borrowing request status to "returned" with photos captured
    await client.query(
      `UPDATE borrowing_requests 
       SET status = $1, returned_at = NOW(), 
           return_photos_captured = true, 
           return_photo_capture_date = NOW()
       WHERE id = $2`,
      ["returned", borrowing_request_id]
    );

    // If there was a pending return request, mark it as approved
    await client.query(
      `UPDATE return_requests 
       SET status = 'approved', updated_at = NOW()
       WHERE borrowing_request_id = $1 AND status IN ('pending', 'submitted')`,
      [borrowing_request_id]
    );

    await client.query("COMMIT");

    console.log(`✅ Staff manual return with ${photoFilenames.length} photo(s) completed for request ${borrowing_request_id}`);

    res.json({
      success: true,
      message: `✅ ${photoFilenames.length} photo(s) captured and items received!`,
      borrower_id,
      items,
      photoCount: photoFilenames.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Staff manual return with photos error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// Get pending returns for staff review
const getPendingReturns = async (req, res) => {
  const client = await pool.connect();
  try {
    // Query for all requests with status 'pending_return'
    const result = await client.query(
      `SELECT 
        br.id as borrowing_request_id,
        br.borrower_id,
        u.fullname as borrower_name,
        u.email,
        br.request_date,
        br.due_date,
        br.status,
        br.return_photos_captured,
        br.return_photo_capture_date,
        COUNT(rrp.id) as photo_count,
        COALESCE(json_agg(json_build_object(
          'item_id', bi.inventory_unit_id,
          'item_name', ii.name,
          'borrowed_quantity', 1,
          'size', ii.size,
          'condition', iu.status
        )) FILTER (WHERE bi.inventory_unit_id IS NOT NULL), '[]'::json) as items
       FROM borrowing_requests br
       LEFT JOIN users u ON br.borrower_id = u.id
       LEFT JOIN borrowing_items bi ON br.id = bi.borrowing_id
       LEFT JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
       LEFT JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
       LEFT JOIN return_request_photos rrp ON br.id = rrp.borrowing_request_id
       WHERE br.status = $1
       GROUP BY br.id, u.id
       ORDER BY br.return_photo_capture_date DESC`,
      ["pending_return"]
    );

    res.json({
      success: true,
      pending_returns: result.rows,
    });
  } catch (err) {
    console.error("Get pending returns error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// ✅ Add units to existing reserved cart
const addUnitsToCart = async (req, res) => {
  const { borrower_id, request_id, item_id, quantity, size } = req.body;

  if (!borrower_id || !request_id || !item_id || !quantity) {
    return res.status(400).json({ error: "Missing required fields: borrower_id, request_id, item_id, quantity" });
  }

  const q = Number(quantity) || 1;
  if (q <= 0) {
    return res.status(400).json({ error: "Quantity must be greater than 0" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify the request exists and belongs to this borrower
    const reqCheck = await client.query(
      `SELECT id, status FROM borrowing_requests WHERE id = $1 AND borrower_id = $2 FOR UPDATE`,
      [request_id, borrower_id]
    );

    if (reqCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Reserved request not found" });
    }

    if (reqCheck.rows[0].status !== "reserved") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Request is not in reserved state" });
    }

    // Find available units for this item, filtered by size if provided
    // item_id is sent as string from frontend (can be integer ID or UUID)
    // First try to find by integer ID
    let availableUnits = await client.query(
      `SELECT iu.id, iu.size, ii.name, ii.category, ii.garment_type, ii.image_url, ii.id as item_integer_id, ii.uuid
       FROM inventory_units iu
       JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
       WHERE ii.id = $1::int
       AND iu.status = 'available'
       AND (($3::text IS NULL OR $3::text = 'nosize') OR iu.size = $3::text)
       FOR UPDATE SKIP LOCKED
       LIMIT $2`,
      [item_id, q, size]
    );

    // If not found by integer ID, try by UUID
    if (availableUnits.rowCount === 0) {
      availableUnits = await client.query(
        `SELECT iu.id, iu.size, ii.name, ii.category, ii.garment_type, ii.image_url, ii.id as item_integer_id, ii.uuid
         FROM inventory_units iu
         JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
         WHERE ii.uuid = $1::uuid
         AND iu.status = 'available'
         AND (($3::text IS NULL OR $3::text = 'nosize') OR iu.size = $3::text)
         FOR UPDATE SKIP LOCKED
         LIMIT $2`,
        [item_id, q, size]
      );
    }

    if (availableUnits.rowCount === 0) {
      await client.query("ROLLBACK");
      const sizeMsg = size && size !== "nosize" ? ` with size ${size}` : "";
      return res.status(400).json({ error: `No available units found for item ${item_id}${sizeMsg}. Not enough inventory.` });
    }

    if (availableUnits.rowCount < q) {
      await client.query("ROLLBACK");
      const sizeMsg = size && size !== "nosize" ? ` with size ${size}` : "";
      return res.status(400).json({ error: `Only ${availableUnits.rowCount} unit(s)${sizeMsg} available, but ${q} requested.` });
    }

    const unitsAdded = availableUnits.rows.length;
    const cartItems = [];

    // Add each available unit to the borrowing_items
    for (const unit of availableUnits.rows) {
      await client.query(
        `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
         VALUES ($1, $2)`,
        [request_id, unit.id]
      );

      cartItems.push({
        unit_id: unit.id,
        item_id: unit.uuid,
        name: unit.name,
        size: unit.size || "nosize",
        category: unit.category,
        garment_type: unit.garment_type,
        image_url: transformImageUrl(unit.image_url),
      });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Added ${unitsAdded} unit(s) to cart`,
      units_added: unitsAdded,
      items: cartItems,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ addUnitsToCart error:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
      sqlState: err.sqlState,
      stack: err.stack
    });
    return res.status(500).json({ error: "Failed to add units to cart", details: err.message });
  } finally {
    client.release();
  }
};

module.exports = {
  addToCart,
  batchAddToCart,
  removeFromCart,
  submitBorrowRequest,
  getBorrowHistory,
  deleteFromHistory,
  getAllBorrowRequests,
  approveBorrowRequest,
  declineBorrowRequest,
  returnBorrowedItems,
  getInventoryUnitByQrText,
  // NEW exports used by BorrowCart.jsx
  updateInventoryQuantity,
  restoreInventoryQuantity,
  updateBorrowCartQuantity,
  saveCartQuantity,
  startBorrowingSession, 
  getReservedRequest,
  addUnitsToCart,
  uploadBorrowPhoto,
  getBorrowPhotos,
  deleteBorrowPhoto,
  // NEW return photo exports
  initiateReturn,
  uploadReturnPhoto,
  getReturnPhotos,
  deleteReturnPhoto,
  submitReturn,
  approveReturn,
  declineReturn,
  staffManualReturn,
  staffManualReturnWithPhotos,
  getPendingReturns,
};
