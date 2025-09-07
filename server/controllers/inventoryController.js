// inventoryController.js
const pool = require("../db");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const multer = require("multer"); // npm install multer
const { v4: uuidv4 } = require("uuid"); 

/*
 * Inventory Controller
 * ------------------------------------------------------------
 * Groups: Dulimbay / Budjong / Kayam / Others (DB allows all).
 * Category is NOT auto-forced; client sends 'costume' or 'instrument'.
 * Supports per-size quantities: qty_small, qty_medium, qty_large.
 * Supports dance_type (costume).
 */

/* -------------------------------------------------------------- */
/* Helpers                                                        */
/* -------------------------------------------------------------- */
function nullIfEmpty(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function parseIntOrZero(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}
const VALID_GROUPS = ["dulimbay", "budjong", "kayam", "others"];
function normalizeGroup(g) {
  if (g == null) return null;
  const s = String(g).trim().toLowerCase();
  return VALID_GROUPS.includes(s) ? s : null;
}

/* -------------------------------------------------------------- */
/* File Upload Setup                                               */
/* -------------------------------------------------------------- */
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});

// File filter: allow only images
function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, and PNG files are allowed!"));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter,
});

/* -------------------------------------------------------------- */
/* Column list (raw)                                               */
/* -------------------------------------------------------------- */
const rawColumns = `
  id, name, category, collection_group, quantity, description,
  qr_code_url, qr_code_text,
  cultural_group, garment_type, accessory_type, gender, size, cleaning_status,
  color, condition, date_acquired,
  instrument_classification, instrument_type, material, age, usage,
  created_by, created_at,
  qty_small, qty_medium, qty_large,
  dance_type,
  image_url
`;

/* -------------------------------------------------------------- */
/* Row -> response mapper                                          */
/* -------------------------------------------------------------- */
function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    garment_type: row.garment_type,
    collection_group: row.collection_group,
    description: row.description,
    qty_small: row.qty_small,
    qty_medium: row.qty_medium,
    qty_large: row.qty_large,
    image_url: row.image_url,
    available_units: Number(row.available_units),
    is_accessory: row.garment_type?.toLowerCase() === "accessory"
  };
}


/* -------------------------------------------------------------- */
/* GET: all inventory                                              */
/* -------------------------------------------------------------- */
const getAllInventory = async (req, res) => {
  try {
    // Get all inventory items
    const inventoryQuery = `
      SELECT * 
      FROM inventory_items 
      ORDER BY created_at DESC
    `;
    const { rows: inventoryItems } = await pool.query(inventoryQuery);

    // Get all units
    const unitQuery = `
      SELECT * 
      FROM inventory_units
      ORDER BY created_at DESC
    `;
    const { rows: allUnits } = await pool.query(unitQuery);

    // Match units to items — use UUID for FK match
    const itemsWithUnits = inventoryItems.map(item => {
      const matchingUnits = allUnits.filter(
        unit => String(unit.inventory_item_id) === String(item.uuid)
      );
      return {
        ...item,
        units: matchingUnits
      };
    });

    res.status(200).json(itemsWithUnits);
  } catch (err) {
    console.error("❌ getAllInventory error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};


/* -------------------------------------------------------------- */
/* GET: available inventory items (with > 0 available units)       */
/* -------------------------------------------------------------- */
const getAvailableInventory = async (req, res) => {
  try {
    const { group, category } = req.query;
    const values = [];
    let filters = [];

    if (group) {
      values.push(group.toLowerCase());
      filters.push(`LOWER(i.collection_group) = $${values.length}`);
    }
    if (category) {
      values.push(category.toLowerCase());
      filters.push(`LOWER(i.category) = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const query = `
      SELECT 
        i.uuid AS item_uuid,
        i.name,
        i.description,
        i.image_url,
        i.category,
        i.garment_type,
        i.collection_group,
        i.accessory_type,
        i.instrument_type,
        u.id AS unit_id,
        u.size,
        u.status
      FROM inventory_items i
      LEFT JOIN inventory_units u
        ON u.inventory_item_id = i.uuid
      ${whereClause}
      ORDER BY i.name ASC, u.id ASC
    `;

    const result = await pool.query(query, values);
    const itemsMap = {};

    result.rows.forEach((row) => {
      if (!itemsMap[row.item_uuid]) {
        itemsMap[row.item_uuid] = {
          uuid: row.item_uuid,
          name: row.name,
          description: row.description,
          image_url: row.image_url,
          category: row.category,
          garment_type: row.garment_type,
          collection_group: row.collection_group,
          accessory_type: row.accessory_type,
          instrument_type: row.instrument_type,
          sizes: {},              // for costumes
          total_available: 0,     // for instruments/accessories
          available_unit_ids: [], // all available units
        };
      }

      const garmentType = row.garment_type?.toLowerCase();
      const isInstrument = row.category?.toLowerCase() === "instrument";
      const isAccessory = row.category?.toLowerCase() === "accessory";

      if (row.unit_id && row.status === "available") {
        // Always track available units
        itemsMap[row.item_uuid].available_unit_ids.push(row.unit_id);

        if (garmentType === "costume" && row.size) {
          // Costumes → per size counts
          const sizeKey = row.size.toLowerCase();
          if (!itemsMap[row.item_uuid].sizes[sizeKey]) {
            itemsMap[row.item_uuid].sizes[sizeKey] = { count: 0, unit_ids: [] };
          }
          itemsMap[row.item_uuid].sizes[sizeKey].count += 1;
          itemsMap[row.item_uuid].sizes[sizeKey].unit_ids.push(row.unit_id);
        } else if (isInstrument || isAccessory) {
          // Instruments & accessories → flat count
          itemsMap[row.item_uuid].total_available += 1;
        }
      }
    });

    res.json(Object.values(itemsMap));
  } catch (err) {
    console.error("❌ Error fetching available inventory:", err.message);
    res.status(500).json({ error: "Failed to fetch available inventory" });
  }
};


/* -------------------------------------------------------------- */
/* GET: by QR code text                                            */
/* -------------------------------------------------------------- */
const getItemByQRCode = async (req, res) => {
  const { qr } = req.params;
  try {
    const result = await pool.query(
      `SELECT ${rawColumns} FROM inventory_items WHERE LOWER(qr_code_text) = LOWER($1)`,
      [qr.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error("❌ QR Scan error:", err.message);
    res.status(500).json({ error: "Failed to scan item" });
  }
};


/* -------------------------------------------------------------- */
/* POST: upload image                                              */
/* -------------------------------------------------------------- */
const uploadImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const protocol = req.protocol;
    const host = req.get("host"); // e.g., localhost:8000
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    res.json({ imageUrl: fileUrl });
  } catch (err) {
    console.error("❌ Image upload error:", err.message);
    res.status(500).json({ error: "Image upload failed" });
  }
};


/* -------------------------------------------------------------- */
/* POST: add inventory item                                        */
/* -------------------------------------------------------------- */
const addInventoryItem = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      group,
      collection_group,
      category,
      name,
      quantity,
      description,
      cultural_group,
      dance_type,
      garment_type,
      gender,
      size,
      color,
      date_acquired,
      instrument_classification,
      instrument_type,
      material,
      age,
      usage,
      qty_small,
      qty_medium,
      qty_large,
      accessory_type,
    } = req.body;

    const gInput = group ?? collection_group;
    const gNorm = normalizeGroup(gInput) || null;
    const catNorm = category ? String(category).trim().toLowerCase() : null;

    if (!name || !catNorm || quantity == null) {
      return res
        .status(400)
        .json({ error: "Name, category, and quantity are required." });
    }

    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 0) {
      return res
        .status(400)
        .json({ error: "Quantity must be a non-negative integer." });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
    }

    await client.query("BEGIN");

    const smallCount = parseIntOrZero(qty_small);
    const mediumCount = parseIntOrZero(qty_medium);
    const largeCount = parseIntOrZero(qty_large);
    const totalSizedCount = smallCount + mediumCount + largeCount;

    const itemUuid = uuidv4();

    // Insert inventory item
    const insertText = `
      INSERT INTO inventory_items (
        name, category, quantity, description,
        created_by, created_at,
        cultural_group, garment_type, gender, size, color,
        date_acquired, instrument_classification, instrument_type,
        material, age, usage, collection_group, accessory_type,
        qty_small, qty_medium, qty_large, dance_type,
        image_url, uuid
      )
      VALUES (
        $1, $2, $3, $4,
        $5, NOW(),
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24
      )
      RETURNING uuid
    `;

    const insertVals = [
      name.trim(),
      catNorm,
      q,
      description || "",
      req.user?.id || null,
      nullIfEmpty(cultural_group),
      nullIfEmpty(garment_type),
      nullIfEmpty(gender),
      nullIfEmpty(size),
      nullIfEmpty(color),
      date_acquired || null,
      nullIfEmpty(instrument_classification),
      nullIfEmpty(instrument_type),
      nullIfEmpty(material),
      nullIfEmpty(age),
      nullIfEmpty(usage),
      gNorm,
      nullIfEmpty(accessory_type),
      smallCount,
      mediumCount,
      largeCount,
      nullIfEmpty(dance_type),
      imageUrl,
      itemUuid,
    ];

    const result = await client.query(insertText, insertVals);
    const itemUuidDb = result.rows[0].uuid;

    // Item-level QR
    const qrText = `ITEM-${itemUuidDb}`;
    const qrCodeUrl = await QRCode.toDataURL(qrText);
    await client.query(
      `UPDATE inventory_items SET qr_code_text = $1, qr_code_url = $2 WHERE uuid = $3`,
      [qrText, qrCodeUrl, itemUuidDb]
    );

    const qrDir = path.join(__dirname, "..", "public", "qr_codes");
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    // Helper to insert unit
    const insertUnit = async (sizeLabel, count) => {
      for (let i = 0; i < count; i++) {
        const label = sizeLabel?.toLowerCase() || "nosize"; // ✅ default "nosize"
        const unitId = uuidv4();
        const unitQrText = `UNIT-${itemUuidDb}-${label}-${i + 1}`;
        const qrCodeFileName = `${unitId}.png`;
        const qrCodePath = `qr_codes/${qrCodeFileName}`;
        const qrCodeUrlFile = `${req.protocol}://${req.get("host")}/${qrCodePath}`;

        await QRCode.toFile(path.join(qrDir, qrCodeFileName), unitQrText);

        await client.query(
          `INSERT INTO inventory_units (id, inventory_item_id, size, status, qr_code_url, qr_code_text, created_at)
           VALUES ($1, $2, $3, 'available', $4, $5, NOW())`,
          [unitId, itemUuidDb, label, qrCodeUrlFile, unitQrText]
        );
      }
    };

    // ✅ Create units
    if (catNorm === "costume" && totalSizedCount > 0) {
      if (smallCount > 0) await insertUnit("small", smallCount);
      if (mediumCount > 0) await insertUnit("medium", mediumCount);
      if (largeCount > 0) await insertUnit("large", largeCount);
    } else {
      if (q > 0) await insertUnit(null, q); // Instruments & Accessories → "nosize"
    }

    await client.query("COMMIT");

    res.status(201).json({
      newItemId: itemUuidDb,
      qr_code_url: qrCodeUrl,
      qr_code_text: qrText,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error adding inventory item:", err.message);
    res.status(500).json({ error: "Failed to add inventory item" });
  } finally {
    client.release();
  }
};


/* -------------------------------------------------------------- */
/* PUT: update inventory item                                     */
/* -------------------------------------------------------------- */
const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const {
    group,
    collection_group,
    category,
    name,
    quantity,
    description,
    cultural_group,
    dance_type,
    garment_type,
    gender,
    size,
    color,
    date_acquired,
    instrument_classification,
    instrument_type,
    material,
    age,
    usage,
    qty_small,
    qty_medium,
    qty_large,
    image_url,
  } = req.body;

  const gInput = group ?? collection_group;
  const gNorm = normalizeGroup(gInput) || null;
  const catNorm = category ? String(category).trim().toLowerCase() : null;

  if (!name || !catNorm || quantity == null) {
    return res
      .status(400)
      .json({ error: "Name, category, and quantity are required." });
  }

  const q = Number(quantity);
  if (!Number.isInteger(q) || q < 0) {
    return res
      .status(400)
      .json({ error: "Quantity must be a non‑negative integer." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE inventory_items
      SET name = $1,
          category = $2,
          collection_group = $3,
          quantity = $4,
          description = $5,
          cultural_group = $6,
          dance_type = $7,
          garment_type = $8,
          gender = $9,
          size = $10,
          color = $11,
          date_acquired = $12,
          instrument_classification = $13,
          instrument_type = $14,
          material = $15,
          age = $16,
          usage = $17,
          qty_small = $18,
          qty_medium = $19,
          qty_large = $20,
          image_url = $21
      WHERE id = $22
      RETURNING ${rawColumns}
      `,
      [
        name.trim(),
        catNorm,
        gNorm,
        q,
        description || "",
        nullIfEmpty(cultural_group),
        nullIfEmpty(dance_type),
        nullIfEmpty(garment_type),
        nullIfEmpty(gender),
        nullIfEmpty(size),
        nullIfEmpty(color),
        date_acquired || null,
        nullIfEmpty(instrument_classification),
        nullIfEmpty(instrument_type),
        nullIfEmpty(material),
        nullIfEmpty(age),
        nullIfEmpty(usage),
        parseIntOrZero(qty_small),
        parseIntOrZero(qty_medium),
        parseIntOrZero(qty_large),
        image_url || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ success: true, updatedItem: mapRow(result.rows[0]) });
  } catch (err) {
    console.error("❌ Error updating inventory:", err.message);
    res.status(500).json({ error: "Failed to update item" });
  }
};


/* -------------------------------------------------------------- */
/* DELETE                                                          */
/* -------------------------------------------------------------- */
const deleteInventoryItem = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM inventory_items WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting inventory:", err.message);
    res.status(500).json({ error: "Failed to delete item" });
  }
};


/* -------------------------------------------------------------- */
/* Borrowing endpoints                                             */
/* -------------------------------------------------------------- */
// ✅ Updated addToBorrowCart (UUID + per-unit tracking)
// ✅ Submit a borrow cart request
const addToBorrowCart = async (req, res) => {
  const { borrower_id, items } = req.body;
  if (!borrower_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1️⃣ Create borrowing request
    const requestResult = await client.query(
      `INSERT INTO borrowing_requests (borrower_id, status, request_date, created_at)
       VALUES ($1, 'pending', NOW(), NOW())
       RETURNING id`,
      [borrower_id]
    );
    const requestId = requestResult.rows[0].id;

    // 2️⃣ Process each item/unit in the cart
    for (const item of items) {
      const { itemId, unitId } = item;

      if (!itemId || !unitId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Each cart item must include itemId and unitId" });
      }

      // Check that the unit belongs to the item and is available
      const unitCheck = await client.query(
        `SELECT id FROM inventory_units
         WHERE id = $1 AND inventory_item_id = $2 AND status = 'available'`,
        [unitId, itemId]
      );

      if (unitCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Unit ${unitId} is not available for item ${itemId}`,
        });
      }

      // Reserve the unit
      await client.query(
        `UPDATE inventory_units
         SET status = 'reserved'
         WHERE id = $1`,
        [unitId]
      );

      // Record in borrowing_items (always per-unit now)
      await client.query(
        `INSERT INTO borrowing_items (borrowing_id, inventory_item_id, inventory_unit_id, quantity, returned_quantity)
         VALUES ($1, $2, $3, 1, 0)`,
        [requestId, itemId, unitId]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, request_id: requestId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error submitting borrow cart:", err.message);
    res.status(500).json({ error: "Failed to process borrow request" });
  } finally {
    client.release();
  }
};


// ✅ Check item availability (real-time)
const updateInventoryQuantity = async (req, res) => {
  const { item_id, quantity } = req.body;

  if (!item_id || quantity == null) {
    return res
      .status(400)
      .json({ error: "Item ID and quantity are required" });
  }

  const q = Number(quantity);
  if (!Number.isInteger(q) || q <= 0) {
    return res
      .status(400)
      .json({ error: "Quantity must be a positive integer." });
  }

  try {
    // Fetch the base item
    const itemResult = await pool.query(
      `SELECT id, name, garment_type, category
       FROM inventory_items
       WHERE id = $1`,
      [item_id]
    );

    if (itemResult.rowCount === 0) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const item = itemResult.rows[0];

    // Count available + reserved units directly from inventory_units
    const availableResult = await pool.query(
      `SELECT COUNT(*) AS available_units
       FROM inventory_units
       WHERE inventory_item_id = $1 AND status = 'available'`,
      [item.id]
    );

    const reservedResult = await pool.query(
      `SELECT COUNT(*) AS reserved_units
       FROM inventory_units
       WHERE inventory_item_id = $1 AND status = 'reserved'`,
      [item.id]
    );

    const availableUnits = parseInt(availableResult.rows[0].available_units, 10);
    const reservedUnits = parseInt(reservedResult.rows[0].reserved_units, 10);
    const totalUnits = availableUnits + reservedUnits;

    return res.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        category: item.category,
        garment_type: item.garment_type,
        total_units: totalUnits,
        reserved_units: reservedUnits,
        available_units: availableUnits,
        can_fulfill: availableUnits >= q,
      },
    });
  } catch (err) {
    console.error("❌ Error checking inventory quantity:", err.message);
    res.status(500).json({ error: "Failed to check inventory quantity" });
  }
};


// ✅ Restore stock (on decline or return)
const restoreInventoryQuantity = async (req, res) => {
  const { item_id, quantity, size } = req.body; 

  if (!item_id || quantity == null) {
    return res.status(400).json({ error: "Item ID and quantity are required" });
  }

  const q = Number(quantity);
  if (!Number.isInteger(q) || q <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive integer." });
  }

  try {
    const itemResult = await pool.query(
      `SELECT id, name, garment_type, category 
       FROM inventory_items 
       WHERE id = $1`,
      [item_id]
    );

    if (itemResult.rowCount === 0) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const item = itemResult.rows[0];

    // 🔑 Restore any type of item by flipping units back to available
    // If size is given, only restore that size (costume case)
    const unitResult = await pool.query(
      `
      WITH cte AS (
        SELECT id
        FROM inventory_units
        WHERE inventory_item_id = $1
          AND status IN ('reserved', 'borrowed')
          ${size ? "AND size = $2" : ""}
        LIMIT $3
      )
      UPDATE inventory_units u
      SET status = 'available'
      FROM cte
      WHERE u.id = cte.id
      RETURNING u.id, u.size, u.status;
      `,
      size ? [item_id, size, q] : [item_id, q]
    );

    return res.json({
      success: true,
      restored: unitResult.rowCount,
      units: unitResult.rows,
    });
  } catch (err) {
    console.error("❌ Error restoring inventory quantity:", err.message);
    res.status(500).json({ error: "Failed to restore inventory quantity" });
  }
};


const deleteUnit = async (req, res) => {
  const { unitId } = req.params;

  if (!unitId) {
    return res.status(400).json({ error: "Unit ID is required" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM inventory_units WHERE id = $1 RETURNING *",
      [unitId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    res.json({ success: true, deletedUnit: result.rows[0] });
  } catch (err) {
    console.error("❌ Error deleting unit:", err.message);
    res.status(500).json({ error: "Failed to delete unit" });
  }
};


const updateUnit = async (req, res) => {
  const { unitId } = req.params;
  const { size } = req.body;

  if (!unitId || !size) {
    return res.status(400).json({ error: "Unit ID and size are required" });
  }

  try {
    const result = await pool.query(
      "UPDATE inventory_units SET size = $1 WHERE id = $2 RETURNING *",
      [size, unitId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    res.json({ success: true, updatedUnit: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating unit:", err.message);
    res.status(500).json({ error: "Failed to update unit" });
  }
};


const getAllInventoryItemsWithCounts = async () => {
  try {
    const inventoryItemsRes = await pool.query("SELECT * FROM inventory_items");
    const items = inventoryItemsRes.rows;

    if (items.length === 0) return [];

    const unitCountsRes = await pool.query(`
      SELECT
        inventory_item_id,
        size,
        COUNT(*) as count
      FROM inventory_units
      GROUP BY inventory_item_id, size
    `);

    const unitCountsMap = {};
    unitCountsRes.rows.forEach(({ inventory_item_id, size, count }) => {
      if (!unitCountsMap[inventory_item_id]) unitCountsMap[inventory_item_id] = {};
      unitCountsMap[inventory_item_id][`qty_${size?.toLowerCase()}`] = parseInt(count, 10);
    });

    return items.map((item) => ({
      ...item,
      qty_small: unitCountsMap[item.id]?.qty_small || 0,
      qty_medium: unitCountsMap[item.id]?.qty_medium || 0,
      qty_large: unitCountsMap[item.id]?.qty_large || 0,
    }));
  } catch (error) {
    console.error("❌ Error in getAllInventoryItemsWithCounts:", error.message);
    throw error;
  }
};

// ✅ Scan by exact QR code text (unit or item)
const scanByQrCode = async (req, res) => {
  const { qrCodeText } = req.params;

  try {
    const trimmedQr = qrCodeText.trim();

    // 1️⃣ Check in inventory_units first — match by qr_code_text
    const unitQuery = `
      SELECT
        iu.id AS unit_id,
        iu.qr_code_text,
        iu.qr_code_url,
        iu.size,
        iu.status,
        iu.condition,
        ii.id AS item_id,          -- numeric DB id
        ii.uuid AS item_uuid,      -- UUID
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_units iu
      JOIN inventory_items ii 
        ON iu.inventory_item_id = ii.uuid   -- ✅ UUID match
      WHERE iu.qr_code_text::text = $1
      LIMIT 1;
    `;
    const unitResult = await pool.query(unitQuery, [trimmedQr]);

    if (unitResult.rows.length > 0) {
      return res.status(200).json({ type: "unit", data: unitResult.rows[0] });
    }

    // 2️⃣ If not found, check inventory_items directly
    const itemQuery = `
      SELECT
        NULL AS unit_id,
        NULL AS size,
        NULL AS status,
        NULL AS condition,
        ii.id AS item_id,          -- numeric DB id
        ii.uuid AS item_uuid,      -- UUID
        ii.qr_code_text,
        ii.qr_code_url,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_items ii
      WHERE ii.qr_code_text::text = $1
      LIMIT 1;
    `;
    const itemResult = await pool.query(itemQuery, [trimmedQr]);

    if (itemResult.rows.length > 0) {
      return res.status(200).json({ type: "item", data: itemResult.rows[0] });
    }

    // 3️⃣ Nothing found
    return res.status(404).json({ error: "QR code not found in items or units." });
  } catch (error) {
    console.error("❌ Error scanning QR code:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// ✅ Flexible scan (works with QR text or full URL, checks items & units)
const scanQRCode = async (req, res) => {
  let { qr } = req.params;
  try {
    qr = decodeURIComponent(qr).trim();

    // 1️⃣ Try exact match in inventory_units
    const unitExactQuery = `
      SELECT
        iu.id AS unit_id,
        iu.qr_code_text,
        iu.qr_code_url,
        iu.size,
        iu.status,
        iu.condition,
        ii.id AS item_id,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_units iu
      JOIN inventory_items ii 
        ON iu.inventory_item_id = ii.id
      WHERE iu.qr_code_text = $1
      LIMIT 1;
    `;
    const unitExactResult = await pool.query(unitExactQuery, [qr]);
    if (unitExactResult.rows.length > 0) {
      return res.status(200).json({ type: "unit", data: unitExactResult.rows[0] });
    }

    // 2️⃣ Try exact match in inventory_items
    const itemExactQuery = `
      SELECT
        NULL AS unit_id,
        NULL AS size,
        NULL AS status,
        NULL AS condition,
        ii.id AS item_id,
        ii.qr_code_text,
        ii.qr_code_url,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_items ii
      WHERE ii.qr_code_text = $1
      LIMIT 1;
    `;
    const itemExactResult = await pool.query(itemExactQuery, [qr]);
    if (itemExactResult.rows.length > 0) {
      return res.status(200).json({ type: "item", data: itemExactResult.rows[0] });
    }

    // 3️⃣ Try partial match for units
    const unitPartialQuery = `
      SELECT
        iu.id AS unit_id,
        iu.qr_code_text,
        iu.qr_code_url,
        iu.size,
        iu.status,
        iu.condition,
        ii.id AS item_id,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_units iu
      JOIN inventory_items ii 
        ON iu.inventory_item_id = ii.id
      WHERE $1 ILIKE '%' || iu.qr_code_text || '%'
      LIMIT 1;
    `;
    const unitPartialResult = await pool.query(unitPartialQuery, [qr]);
    if (unitPartialResult.rows.length > 0) {
      return res.status(200).json({ type: "unit", data: unitPartialResult.rows[0] });
    }

    // 4️⃣ Try partial match for items
    const itemPartialQuery = `
      SELECT
        NULL AS unit_id,
        NULL AS size,
        NULL AS status,
        NULL AS condition,
        ii.id AS item_id,
        ii.qr_code_text,
        ii.qr_code_url,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.cultural_group,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_items ii
      WHERE $1 ILIKE '%' || ii.qr_code_text || '%'
      LIMIT 1;
    `;
    const itemPartialResult = await pool.query(itemPartialQuery, [qr]);
    if (itemPartialResult.rows.length > 0) {
      return res.status(200).json({ type: "item", data: itemPartialResult.rows[0] });
    }

    // ❌ Nothing found
    return res.status(404).json({ error: "QR code not found" });
  } catch (error) {
    console.error("❌ Error scanning QR:", error);
    return res.status(500).json({ error: "Server error during QR scan" });
  }
};


// ✅ Generate units (integer ID version)
const generateUnitsForItem = async (req, res) => {
  try {
    let itemId = req.params.id; // always UUID now
    const { newQty, garment_type } = req.body;

    // ✅ enforce UUID only
    const isUUID = /^[0-9a-fA-F-]{36}$/.test(itemId);
    if (!isUUID) {
      return res.status(400).json({ error: "Invalid item ID format (must be UUID)" });
    }

    const qrDir = path.join(__dirname, "../public/qr_codes");
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    let unitsToGenerate = [];
    let totalQty = 0;

    // ✅ fetch current item quantities
    const itemRes = await pool.query(
      `SELECT qty_small, qty_medium, qty_large, quantity 
       FROM inventory_items 
       WHERE uuid = $1`,
      [itemId]
    );
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const { qty_small = 0, qty_medium = 0, qty_large = 0, quantity = 0 } =
      itemRes.rows[0];

    // ✅ costumes use size breakdown, others use total
    if (garment_type && garment_type.toLowerCase() === "costume") {
      totalQty = qty_small + qty_medium + qty_large;
    } else {
      totalQty = newQty && newQty > 0 ? newQty : quantity;
    }

    if (totalQty <= 0) {
      return res.status(400).json({ error: "No units to generate" });
    }

    // ✅ check existing units count
    const existingRes = await pool.query(
      `SELECT COUNT(*) FROM inventory_units WHERE inventory_item_id = $1`,
      [itemId]
    );
    const existingCount = parseInt(existingRes.rows[0].count, 10);
    let generateCount = Math.max(totalQty - existingCount, 0);

    if (generateCount <= 0) {
      return res.status(200).json({ message: "No new units to generate" });
    }

    // ✅ helper to make unit with high-quality QR
    const createQrAndPush = async (sizeLabel, forceNoSize = false) => {
      const unitId = uuidv4();
      const qrCodeId = uuidv4();
      const qrPath = path.join(qrDir, `${qrCodeId}.png`);

      // 🔥 Generate high-quality QR (500x500 px, error correction H)
      await QRCode.toFile(qrPath, qrCodeId, {
        errorCorrectionLevel: "H",
        type: "png",
        width: 500,
        margin: 2, // small margin for readability
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      });

      const qrUrl = `/qr_codes/${qrCodeId}.png`;

      unitsToGenerate.push({
        id: unitId,
        inventory_item_id: itemId,
        qr_code_text: qrCodeId,
        qr_code_url: qrUrl,
        // ✅ Always insert "nosize" for instruments/accessories
        size: forceNoSize ? "nosize" : (sizeLabel ? sizeLabel.toLowerCase() : "nosize"),
      });
    };

    // ✅ generate units
    if (garment_type && garment_type.toLowerCase() === "costume") {
      for (let i = 0; i < qty_small; i++) await createQrAndPush("small");
      for (let i = 0; i < qty_medium; i++) await createQrAndPush("medium");
      for (let i = 0; i < qty_large; i++) await createQrAndPush("large");
    } else {
      for (let i = 0; i < generateCount; i++) {
        await createQrAndPush(null, true); // force nosize for non-costumes
      }
    }

    // ✅ insert all generated units
    for (const unit of unitsToGenerate) {
      await pool.query(
        `INSERT INTO inventory_units 
         (id, inventory_item_id, qr_code_text, qr_code_url, size, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, 'available', NOW())`,
        [unit.id, unit.inventory_item_id, unit.qr_code_text, unit.qr_code_url, unit.size]
      );
    }

    res.status(200).json({
      message: `Generated ${unitsToGenerate.length} new units successfully`,
      generatedUnits: unitsToGenerate, // ✅ return units for frontend use
    });
  } catch (err) {
    console.error("Error generating units:", err);
    res.status(500).json({ error: "Failed to generate inventory units" });
  }
};


const getUnitsForItem = async (req, res) => {
  try {
    const itemId = req.params.id;

    // Step 1: Check the item category and garment_type first
    const itemResult = await pool.query(
      `SELECT category, garment_type, quantity 
       FROM inventory_items 
       WHERE id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const { category, garment_type, quantity } = itemResult.rows[0];

    // Step 2: Handle instruments & accessories (no units, only quantity)
    if (category === "instrument" || garment_type === "accessory") {
      return res.json({
        message: "Units not applicable for this item",
        category,
        garment_type,
        quantity,
      });
    }

    // Step 3: Handle garments with sizes (fetch units)
    const result = await pool.query(
      `SELECT * FROM inventory_units WHERE inventory_item_id = $1 ORDER BY size`,
      [itemId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching units:", error);
    res.status(500).json({ error: "Failed to fetch units" });
  }
};

// Reserve a specific inventory unit before adding to cart
const reserveInventoryUnit = async (req, res) => {
  const client = await pool.connect();
  try {
    let { unitId, id, borrowing_id } = req.body;
    const finalUnitId = unitId || id;

    if (!finalUnitId) {
      return res.status(400).json({ error: "Unit ID is required." });
    }

    if (!borrowing_id) {
      return res.status(400).json({ error: "Borrowing ID is required." });
    }

    // Validate UUID format
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalUnitId);

    if (!isUUID) {
      return res
        .status(400)
        .json({ error: "Invalid Unit ID format. Must be UUID." });
    }

    await client.query("BEGIN");

    // Try to reserve atomically: only update if available
    const updateUnit = await client.query(
      `UPDATE inventory_units
       SET status = 'reserved'
       WHERE id = $1 AND status = 'available'
       RETURNING id, status`,
      [finalUnitId]
    );

    if (updateUnit.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Unit is already reserved or borrowed. Please choose another.",
      });
    }

    // Insert into borrowing_items to link this unit with the borrowing request
    const insertBorrowItem = await client.query(
      `INSERT INTO borrowing_items (borrowing_id, inventory_unit_id)
       VALUES ($1, $2)
       RETURNING id, borrowing_id, inventory_unit_id`,
      [borrowing_id, finalUnitId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Unit reserved successfully.",
      unit: updateUnit.rows[0],
      borrowing_item: insertBorrowItem.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error reserving inventory unit:", err);
    return res
      .status(500)
      .json({ error: "Server error while reserving inventory unit." });
  } finally {
    client.release();
  }
};




const releaseInventoryUnit = async (req, res) => {
  try {
    const { unitId } = req.body;

    if (!unitId) {
      return res.status(400).json({ error: "Unit ID is required." });
    }

    // Validate UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        unitId
      );

    if (!isUUID) {
      return res
        .status(400)
        .json({ error: "Invalid Unit ID format. Must be UUID." });
    }

    // Fetch the unit
    const unitCheck = await pool.query(
      `SELECT id, status 
       FROM inventory_units 
       WHERE id = $1`,
      [unitId]
    );

    if (unitCheck.rowCount === 0) {
      return res.status(404).json({ error: "Unit not found." });
    }

    const unit = unitCheck.rows[0];

    // Allow releasing if unit is reserved or borrowed
    if (unit.status !== "reserved" && unit.status !== "borrowed") {
      return res.status(400).json({
        error: `Unit cannot be released, current status: ${unit.status}`,
      });
    }

    // Update status back to available
    const updateResult = await pool.query(
      `UPDATE inventory_units
       SET status = 'available'
       WHERE id = $1
       RETURNING id, status`,
      [unitId]
    );

    return res.json({
      message: `Unit released successfully from status '${unit.status}'.`,
      unit: updateResult.rows[0],
    });
  } catch (err) {
    console.error("Error releasing inventory unit:", err);
    return res
      .status(500)
      .json({ error: "Server error while releasing inventory unit." });
  }
};

// ✅ Update reserved quantity for a borrowing cart item
const updateBorrowQuantity = async (req, res) => {
  const { unitId, action } = req.body; // 'borrow' or 'return'

  if (!unitId || !action) {
    return res.status(400).json({ error: "Unit ID and action are required" });
  }

  try {
    // Always treat unitId as UUID (inventory_units)
    const unitResult = await pool.query(
      `SELECT id, status FROM inventory_units WHERE id = $1`,
      [unitId]
    );

    if (unitResult.rowCount === 0) {
      return res.status(404).json({ error: "Inventory unit not found" });
    }

    const unit = unitResult.rows[0];
    let newStatus;

    if (action === "borrow") {
      if (unit.status !== "available") {
        return res.status(400).json({ error: "Unit is not available for borrowing" });
      }
      newStatus = "borrowed";
    } else if (action === "return") {
      newStatus = "available";
    } else {
      return res.status(400).json({ error: "Invalid action. Must be 'borrow' or 'return'" });
    }

    const updated = await pool.query(
      `UPDATE inventory_units 
       SET status = $1 
       WHERE id = $2 
       RETURNING *`,
      [newStatus, unitId]
    );

    return res.json({
      success: true,
      type: "unit",
      updatedUnit: updated.rows[0],
    });
  } catch (err) {
    console.error("❌ Error updating borrow status:", err);
    return res.status(500).json({ error: "Failed to update borrow status" });
  }
};

module.exports = {
  getAllInventory,
  getAvailableInventory,
  getItemByQRCode,
  scanByQrCode, // ✅ ADD THIS
  uploadImage,
  upload, // for multer middleware
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addToBorrowCart,
  updateInventoryQuantity,
  restoreInventoryQuantity,
  deleteUnit,
  updateUnit,
  getAllInventoryItemsWithCounts,
  scanQRCode,
  generateUnitsForItem,
  getUnitsForItem,
  reserveInventoryUnit,
  releaseInventoryUnit,
  updateBorrowQuantity,
};
