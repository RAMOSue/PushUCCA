// inventoryController.js
const pool = require("../db");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const multer = require("multer"); // npm install multer
const { v4: uuidv4 } = require("uuid");

// Backend base URL (set in .env, defaults to port 8000 in dev)
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";

// Helper: convert relative path to full URL
function toFullUrl(filePath) {
  return filePath ? `${BASE_URL}${filePath}` : null;
}

function buildPublicUrl(req, relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto
    ? String(forwardedProto).split(",")[0].trim()
    : req.protocol || "http";

  const host = req.get("host") || "localhost:8000";
  const normalizedPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;

  return `${protocol}://${host}${normalizedPath}`;
}

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
  indigenous_group, garment_type, accessory_type, gender, size, cleaning_status,
  color, condition, date_acquired,
  instrument_classification, instrument_type, material, age, usage,
  created_by, created_at,
  qty_small, qty_medium, qty_large,
  indigenous_dance, region,
  image_url
`;

/* -------------------------------------------------------------- */
/* Row -> response mapper                                          */
/* -------------------------------------------------------------- */
function mapRow(row) {
  // Transform image_url to proper full URL
  let imageUrl = row.image_url;
  if (imageUrl && !imageUrl.startsWith('http')) {
    // If it's a relative path, ensure it starts with /uploads/
    if (!imageUrl.startsWith('/uploads')) {
      imageUrl = `/uploads/${imageUrl}`;
    }
    // Convert relative path to full URL
    imageUrl = toFullUrl(imageUrl);
  }
  
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
    image_url: imageUrl || null,  // Return null if no image, frontend will handle placeholder
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

    // Get all units sorted by size and unit_number
    const unitQuery = `
      SELECT * 
      FROM inventory_units
      ORDER BY 
        CASE 
          WHEN size = 'small' THEN 1
          WHEN size = 'medium' THEN 2
          WHEN size = 'large' THEN 3
          ELSE 4
        END,
        unit_number ASC,
        created_at ASC
    `;
    const { rows: allUnits } = await pool.query(unitQuery);

    // Match units to items — use UUID for FK match and transform image URLs
    const itemsWithUnits = inventoryItems.map(item => {
      const matchingUnits = allUnits.filter(
        unit => String(unit.inventory_item_id) === String(item.uuid)
      );
      
      // Transform image_url to proper full URL
      let imageUrl = item.image_url;
      if (imageUrl && !imageUrl.startsWith('http')) {
        if (!imageUrl.startsWith('/uploads')) {
          imageUrl = `/uploads/${imageUrl}`;
        }
        // Convert relative path to full URL
        imageUrl = toFullUrl(imageUrl);
      }
      
      return {
        ...item,
        image_url: imageUrl || null,
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
        i.id AS item_id,
        i.uuid AS item_uuid,
        i.name,
        i.description,
        i.image_url,
        i.category,
        i.garment_type,
        i.collection_group,
        i.accessory_type,
        i.instrument_type,
        i.qty_small,
        i.qty_medium,
        i.qty_large,
        u.id AS unit_id,
        u.unit_number,
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
        // Transform image_url to proper full URL
        let imageUrl = row.image_url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          if (!imageUrl.startsWith('/uploads')) {
            imageUrl = `/uploads/${imageUrl}`;
          }
          // Convert relative path to full URL
          imageUrl = toFullUrl(imageUrl);
        }
        
        itemsMap[row.item_uuid] = {
          uuid: row.item_uuid,
          id: row.item_id, // ✅ FIX: Use actual integer ID instead of UUID
          name: row.name,
          description: row.description,
          image_url: imageUrl || null,
          category: row.category,
          garment_type: row.garment_type,
          collection_group: row.collection_group,
          accessory_type: row.accessory_type,
          instrument_type: row.instrument_type,
          qty_small: row.qty_small || 0,      // ✅ NEW: Size breakdown
          qty_medium: row.qty_medium || 0,    // ✅ NEW: Size breakdown
          qty_large: row.qty_large || 0,      // ✅ NEW: Size breakdown
          sizes: {},              // for costumes
          total_available: 0,     // for instruments/accessories
          available_unit_ids: [], // all available units
          // ✅ NEW: Include individual units array for granular selection
          units: []
        };
      }

      const garmentType = row.garment_type?.toLowerCase();
      const isInstrument = row.category?.toLowerCase() === "instrument";
      const isAccessory = row.category?.toLowerCase() === "accessory";

      if (row.unit_id && row.status === "available") {
        // Always track available units
        itemsMap[row.item_uuid].available_unit_ids.push(row.unit_id);

        // ✅ NEW: Add individual unit with full details
        itemsMap[row.item_uuid].units.push({
          id: row.unit_id,
          unit_number: row.unit_number,
          size: row.size,
          status: row.status,
          size_category: row.size // for consistency with AvailableItems
        });

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
    const fileUrl = buildPublicUrl(req, `/uploads/${req.file.filename}`);
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
  try {
    const {
      name,
      category,
      quantity,
      indigenous_group,
      indigenous_dance,
      region,
      collection_group,
      garment_type,
      gender,
      color,
      date_acquired,
      image_url,
      instrument_classification,
      instrument_type,
      qty_small,
      qty_medium,
      qty_large,
      description // ✅ ADDED: Accept description from request
    } = req.body;

    // ✅ NEW: Sanitize and validate data - convert empty strings to null
    const sanitizedDateAcquired = date_acquired?.trim() ? date_acquired.trim() : null;
    const sanitizedDescription = description?.trim() ? description.trim() : null;
    const sanitizedIndigenousGroup = indigenous_group?.trim() ? indigenous_group.trim() : null;
    const sanitizedIndigenousDance = indigenous_dance?.trim() ? indigenous_dance.trim() : null;
    const sanitizedRegion = region?.trim() ? region.trim() : null;
    const sanitizedClassification = instrument_classification?.trim() ? instrument_classification.trim() : null;
    const sanitizedInstrumentType = instrument_type?.trim() ? instrument_type.trim() : null;
    const sanitizedColor = color?.trim() ? color.trim() : null;
    const sanitizedGender = gender?.trim() ? gender.trim() : null;
    const sanitizedGarmentType = garment_type?.trim() ? garment_type.trim() : null; // ✅ ADDED
    // ✅ FIX: Don't set collection_group to null - keep original if trim fails
    const sanitizedCollectionGroup = collection_group?.trim() ? collection_group.trim() : collection_group;

    // ✅ NEW: Validate quantities are numbers (not strings)
    const safeQuantity = Number.isFinite(quantity) ? quantity : (parseInt(quantity) || 0);
    const safeQtySmall = Number.isFinite(qty_small) ? qty_small : (parseInt(qty_small) || 0);
    const safeQtyMedium = Number.isFinite(qty_medium) ? qty_medium : (parseInt(qty_medium) || 0);
    const safeQtyLarge = Number.isFinite(qty_large) ? qty_large : (parseInt(qty_large) || 0);

    // ✅ UPDATED: Include description in INSERT query
    const result = await pool.query(
      `INSERT INTO inventory_items (
        name, category, quantity, indigenous_group, indigenous_dance, region,
        collection_group, garment_type, gender, color, date_acquired, image_url,
        instrument_classification, instrument_type,
        qty_small, qty_medium, qty_large, description, uuid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, gen_random_uuid())
      RETURNING *`,
      [
        name, category.toLowerCase(), safeQuantity, sanitizedIndigenousGroup, sanitizedIndigenousDance, sanitizedRegion,
        sanitizedCollectionGroup, sanitizedGarmentType, sanitizedGender, sanitizedColor, sanitizedDateAcquired, image_url,
        sanitizedClassification, sanitizedInstrumentType,
        safeQtySmall, safeQtyMedium, safeQtyLarge, sanitizedDescription
      ]
    );

    const newItem = result.rows[0];
    
    // Item-level QR
    const qrText = `ITEM-${newItem.uuid}`;
    const qrCodeUrl = await QRCode.toDataURL(qrText);
    await pool.query(
      `UPDATE inventory_items SET qr_code_text = $1, qr_code_url = $2 WHERE uuid = $3`,
      [qrText, qrCodeUrl, newItem.uuid]
    );

    const qrDir = path.join(__dirname, "..", "public", "qr_codes");
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    // Helper to insert unit
    const insertUnit = async (sizeLabel, count) => {
      for (let i = 0; i < count; i++) {
        const label = sizeLabel?.toLowerCase() || "nosize"; // ✅ default "nosize"
        const unitId = uuidv4();
        const unitQrText = `UNIT-${newItem.uuid}-${label}-${i + 1}`;
        const qrCodeFileName = `${unitId}.png`;
        const qrCodePath = `qr_codes/${qrCodeFileName}`;
        const qrCodeUrlFile = buildPublicUrl(req, `/${qrCodePath}`);

        await QRCode.toFile(path.join(qrDir, qrCodeFileName), unitQrText);

        // ✅ Generate unit_number in format: "ItemName-Size-Number" (e.g., "Suyam-S-1")
        let sizeAbbrev = "";
        if (label === "small") {
          sizeAbbrev = "S";
        } else if (label === "medium") {
          sizeAbbrev = "M";
        } else if (label === "large") {
          sizeAbbrev = "L";
        }
        
        // Calculate position within this size group (or overall for nosize)
        const posInGroup = i + 1;
        const generatedUnitNumber = sizeAbbrev 
          ? `${name.trim()}-${sizeAbbrev}-${posInGroup}` 
          : `${name.trim()}-${posInGroup}`;

        await pool.query(
          `INSERT INTO inventory_units (id, inventory_item_id, size, status, qr_code_url, qr_code_text, unit_number, created_at)
           VALUES ($1, $2, $3, 'available', $4, $5, $6, NOW())`,
          [unitId, newItem.uuid, label, qrCodeUrlFile, unitQrText, generatedUnitNumber]
        );
      }
    };

    // ✅ Create units
    if (category.toLowerCase() === "costume" && (safeQtySmall + safeQtyMedium + safeQtyLarge) > 0) {
      if (safeQtySmall > 0) await insertUnit("small", safeQtySmall);
      if (safeQtyMedium > 0) await insertUnit("medium", safeQtyMedium);
      if (safeQtyLarge > 0) await insertUnit("large", safeQtyLarge);
    } else {
      if (safeQuantity > 0) await insertUnit(null, safeQuantity); // Instruments & Accessories → "nosize"
    }

    res.status(201).json({
      success: true,
      message: 'Item added successfully',
      newItemId: newItem.uuid,
      item: newItem
    });
  } catch (error) {
    console.error('❌ Error adding inventory item:', error.message);
    
    // ✅ Professional error handling
    let statusCode = 500;
    let errorMessage = 'Failed to add inventory item';
    
    if (error.message.includes('invalid input syntax for type date')) {
      statusCode = 400;
      errorMessage = 'Invalid date format. Please use YYYY-MM-DD format.';
    } else if (error.message.includes('duplicate')) {
      statusCode = 409;
      errorMessage = 'An item with this name already exists in this group.';
    } else if (error.message.includes('unique constraint')) {
      statusCode = 409;
      errorMessage = 'This item already exists. Please use a different name.';
    } else if (error.message.includes('foreign key')) {
      statusCode = 400;
      errorMessage = 'Invalid category or group selected.';
    }
    
    res.status(statusCode).json({ error: errorMessage });
  }
};


/* -------------------------------------------------------------- */
/* PUT: update inventory item                                     */
/* -------------------------------------------------------------- */
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      quantity,
      indigenous_group,
      indigenous_dance,
      region,
      collection_group,
      garment_type,
      gender,
      color,
      date_acquired,
      image_url,
      instrument_classification,
      instrument_type,
      qty_small,
      qty_medium,
      qty_large,
      description // ✅ ADDED: Accept description from request
    } = req.body;

    // ✅ DEBUG: Log what we received
    console.log("🔍 DEBUG - updateInventoryItem received:", {
      id,
      name,
      category,
      collection_group,
      garment_type,
      quantity,
      qty_small,
      qty_medium,
      qty_large
    });

    // ✅ Validate required fields and category value
    if (!id || !name || !category) {
      console.warn("⚠️ Missing required fields in update request");
      return res.status(400).json({ error: 'Missing required fields: id, name, or category' });
    }

    // ✅ Validate category is one of the expected values
    const validCategories = ['costume', 'instrument', 'accessories'];
    if (!validCategories.includes(category?.toLowerCase())) {
      console.warn(`⚠️ Invalid category: "${category}". Must be one of: ${validCategories.join(', ')}`);
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    // ✅ NEW: Sanitize and validate data - convert empty strings to null
    const sanitizedDateAcquired = date_acquired?.trim() ? date_acquired.trim() : null;
    const sanitizedDescription = description?.trim() ? description.trim() : null;
    const sanitizedIndigenousGroup = indigenous_group?.trim() ? indigenous_group.trim() : null;
    const sanitizedIndigenousDance = indigenous_dance?.trim() ? indigenous_dance.trim() : null;
    const sanitizedRegion = region?.trim() ? region.trim() : null;
    const sanitizedClassification = instrument_classification?.trim() ? instrument_classification.trim() : null;
    const sanitizedInstrumentType = instrument_type?.trim() ? instrument_type.trim() : null;
    const sanitizedColor = color?.trim() ? color.trim() : null;
    const sanitizedGender = gender?.trim() ? gender.trim() : null;
    const sanitizedGarmentType = garment_type?.trim() ? garment_type.trim() : null;
    // ✅ FIX: Don't set collection_group to null - keep original if trim fails
    const sanitizedCollectionGroup = collection_group?.trim() ? collection_group.trim() : collection_group;
    const sanitizedImageUrl = image_url?.trim() ? image_url.trim() : null;

    // ✅ Ensure quantities are numbers
    const safeQuantity = Number.isFinite(quantity) ? quantity : (parseInt(quantity) || 0);
    const safeQtySmall = Number.isFinite(qty_small) ? qty_small : (parseInt(qty_small) || 0);
    const safeQtyMedium = Number.isFinite(qty_medium) ? qty_medium : (parseInt(qty_medium) || 0);
    const safeQtyLarge = Number.isFinite(qty_large) ? qty_large : (parseInt(qty_large) || 0);

    // ✅ UPDATED: Include all sanitized fields in UPDATE query
    console.log("📝 UPDATE Query parameters:", {
      $1: name,
      $2: category.toLowerCase(),
      $3: safeQuantity,
      $4: sanitizedIndigenousGroup,
      $5: sanitizedIndigenousDance,
      $6: sanitizedRegion,
      $7: sanitizedCollectionGroup,
      $8: sanitizedGarmentType,
      $9: sanitizedGender,
      $10: sanitizedColor,
      $11: sanitizedDateAcquired,
      $12: sanitizedImageUrl,
      $13: sanitizedClassification,
      $14: sanitizedInstrumentType,
      $15: safeQtySmall,
      $16: safeQtyMedium,
      $17: safeQtyLarge,
      $18: sanitizedDescription,
      $19: id
    });

    const result = await pool.query(
      `UPDATE inventory_items SET
        name = $1, category = $2, quantity = $3, indigenous_group = $4, indigenous_dance = $5,
        region = $6, collection_group = $7, garment_type = $8, gender = $9, color = $10,
        date_acquired = $11, image_url = $12, instrument_classification = $13,
        instrument_type = $14, qty_small = $15, qty_medium = $16, qty_large = $17,
        description = $18
      WHERE uuid::text = $19 OR id::text = $19
      RETURNING *`,
      [
        name, category.toLowerCase(), safeQuantity, sanitizedIndigenousGroup, sanitizedIndigenousDance, sanitizedRegion,
        sanitizedCollectionGroup, sanitizedGarmentType, sanitizedGender, sanitizedColor, sanitizedDateAcquired, 
        sanitizedImageUrl, sanitizedClassification, sanitizedInstrumentType,
        safeQtySmall, safeQtyMedium, safeQtyLarge, sanitizedDescription, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('❌ Error updating inventory item:', error.message);
    console.error('❌ Full PostgreSQL error:', {
      message: error.message,
      code: error.code,
      detail: error.detail || 'No detail provided',
      hint: error.hint || 'No hint provided',
      severity: error.severity || 'Unknown',
      position: error.position || 'Unknown',
      internalPosition: error.internalPosition || 'Unknown',
      routine: error.routine || 'Unknown',
      file: error.file || 'Unknown'
    });
    
    // ✅ Professional error handling
    let statusCode = 500;
    let errorMessage = `Failed to update inventory item: ${error.message}`;
    
    if (error.message.includes('invalid input syntax for type date')) {
      statusCode = 400;
      errorMessage = 'Invalid date format. Please use YYYY-MM-DD format.';
    } else if (error.message.includes('duplicate')) {
      statusCode = 409;
      errorMessage = 'An item with this name already exists in this group.';
    } else if (error.message.includes('unique constraint')) {
      statusCode = 409;
      errorMessage = 'This item already exists. Please use a different name.';
    } else if (error.message.includes('foreign key')) {
      statusCode = 400;
      errorMessage = 'Invalid category or group selected.';
    } else if (error.code === '42883') {
      statusCode = 400;
      errorMessage = `Database type mismatch: ${error.message}`;
    }
    
    res.status(statusCode).json({ error: errorMessage });
  }
};


/* -------------------------------------------------------------- */
/* DELETE                                                          */
/* -------------------------------------------------------------- */
const deleteInventoryItem = async (req, res) => {
  const { id } = req.params;
  try {
    // Determine if id is UUID format or integer
    const isUUID = /^[0-9a-fA-F\-]{36}$/.test(id);
    const parsedId = isUUID ? id : parseInt(id);

    console.log(`🗑️ deleteInventoryItem: id=${id}, isUUID=${isUUID}, parsedId=${parsedId}`);

    // Get the item
    const itemRes = await pool.query(
      isUUID 
        ? `SELECT uuid, id, name FROM inventory_items WHERE uuid = $1`
        : `SELECT uuid, id, name FROM inventory_items WHERE id = $1`,
      [parsedId]
    );

    if (itemRes.rows.length === 0) {
      console.error(`❌ Item not found: ${id}`);
      return res.status(404).json({ error: "Item not found" });
    }

    const { uuid: itemUuid, name: itemName } = itemRes.rows[0];
    console.log(`✅ Found item: ${itemName} (UUID: ${itemUuid})`);

    // ✅ CRITICAL: Delete all units associated with this item FIRST
    const unitsDeleteRes = await pool.query(
      `DELETE FROM inventory_units WHERE inventory_item_id = $1`,
      [itemUuid]
    );
    console.log(`✅ Deleted ${unitsDeleteRes.rowCount} units for item ${itemName}`);

    // ✅ Then delete the item itself
    const result = await pool.query(
      `DELETE FROM inventory_items WHERE uuid = $1 RETURNING uuid, name`,
      [itemUuid]
    );

    if (result.rows.length === 0) {
      console.error(`❌ Failed to delete item: ${itemName}`);
      return res.status(404).json({ error: "Item not found" });
    }

    console.log(`✅ Successfully deleted item: ${itemName} and ${unitsDeleteRes.rowCount} units`);
    res.json({ 
      success: true, 
      message: `Item "${itemName}" and ${unitsDeleteRes.rowCount} associated units deleted successfully`
    });
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
  const { borrower_id } = req.body;

  if (!borrower_id) {
    return res.status(400).json({ error: "Missing borrower_id." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 🔍 Find an existing reserved request for this borrower
    const reservedResult = await client.query(
      `SELECT id FROM borrowing_requests WHERE borrower_id = $1 AND status = 'reserved' LIMIT 1`,
      [borrower_id]
    );

    if (reservedResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No reserved cart found for this borrower." });
    }

    const requestId = reservedResult.rows[0].id;

    // 🟢 Update request to pending
    await client.query(
      `UPDATE borrowing_requests
       SET status = 'pending', due_date = NOW() + INTERVAL '3 days'
       WHERE id = $1`,
      [requestId]
    );

    await client.query("COMMIT");
    return res.json({ success: true, message: "Borrow request submitted successfully.", request_id: requestId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error submitting borrow request:", err.message);
    return res.status(500).json({ error: "Failed to submit borrow request." });
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
        ii.indigenous_group,
        ii.indigenous_dance,
        ii.region,
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
        ii.indigenous_group,
        ii.indigenous_dance,
        ii.region,
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
        ii.uuid AS item_uuid,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.indigenous_group,
        ii.indigenous_dance,
        ii.region,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_units iu
      JOIN inventory_items ii 
        ON iu.inventory_item_id = ii.uuid
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
        ii.indigenous_group,
        ii.indigenous_dance,
        ii.region,
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
        ii.uuid AS item_uuid,
        ii.name,
        ii.category,
        ii.description,
        ii.image_url,
        ii.gender,
        ii.indigenous_group,
        ii.indigenous_dance,
        ii.region,
        ii.garment_type,
        ii.accessory_type,
        ii.instrument_type,
        ii.instrument_classification,
        ii.collection_group
      FROM inventory_units iu
      JOIN inventory_items ii 
        ON iu.inventory_item_id = ii.uuid
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
        ii.indigenous_group,
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
// IMPORTANT: This is called ONLY when EDITING items or updating quantities
// For NEW items: addInventoryItem already creates all units, so this is not called
// This function creates ONLY DELTA units (additional units needed beyond existing)
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

    // ✅ fetch current item quantities, category, AND name for unit naming
    const itemRes = await pool.query(
      `SELECT name, category, qty_small, qty_medium, qty_large, quantity 
       FROM inventory_items 
       WHERE uuid = $1`,
      [itemId]
    );
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const { name: itemName, category: itemCategory, qty_small = 0, qty_medium = 0, qty_large = 0, quantity = 0 } =
      itemRes.rows[0];

    // ✅ costumes use size breakdown, others use total
    if (itemCategory && itemCategory.toLowerCase() === "costume") {
      totalQty = qty_small + qty_medium + qty_large;
    } else {
      totalQty = newQty && newQty > 0 ? newQty : quantity;
    }

    if (totalQty <= 0) {
      return res.status(400).json({ error: "No units to generate" });
    }

    // ✅ Fetch EXISTING units and get their sizes for proper numbering
    const existingUnitsRes = await pool.query(
      `SELECT id, size, unit_number FROM inventory_units 
       WHERE inventory_item_id = $1 
       ORDER BY created_at ASC`,
      [itemId]
    );
    const existingUnits = existingUnitsRes.rows;
    const existingCount = existingUnits.length;

    // ✅ Regenerate unit_numbers if item name changed (update prefix, keep sequence)
    if (existingCount > 0) {
      for (const unit of existingUnits) {
        if (unit.unit_number) {
          // Extract the sequence part from existing unit_number
          // Format: "OldName-Size-Number" → extract "-Size-Number" part (everything after first hyphen)
          const firstHyphenIndex = unit.unit_number.indexOf('-');
          if (firstHyphenIndex !== -1) {
            const sequencePart = unit.unit_number.substring(firstHyphenIndex);
            
            // Regenerate with new item name
            const newUnitNumber = `${itemName}${sequencePart}`;
            
            // Only update if it actually changed
            if (newUnitNumber !== unit.unit_number) {
              await pool.query(
                `UPDATE inventory_units SET unit_number = $1 WHERE id = $2`,
                [newUnitNumber, unit.id]
              );
            }
          }
        }
      }
    }

    // ✅ Calculate how many new units need to be created
    let generateCount = Math.max(totalQty - existingCount, 0);

    // ✅ Track counters for each size (start from existing unit counts)
    let sizeCounters = { small: 0, medium: 0, large: 0, nosize: 0 };
    
    // ✅ Count existing units by size to know where to start numbering new ones
    existingUnits.forEach(unit => {
      const sizeKey = unit.size || 'nosize';
      if (sizeKey === 'small') sizeCounters.small++;
      else if (sizeKey === 'medium') sizeCounters.medium++;
      else if (sizeKey === 'large') sizeCounters.large++;
      else sizeCounters.nosize++;
    });

    // ✅ Update existing units that don't have unit_number yet
    for (const unit of existingUnits) {
      if (!unit.unit_number) {
        const sizeKey = unit.size || 'nosize';
        let sizeAbbrev = '';
        let counter = 0;
        
        if (sizeKey === 'small') {
          sizeAbbrev = 'S';
          counter = sizeCounters.small--;
        } else if (sizeKey === 'medium') {
          sizeAbbrev = 'M';
          counter = sizeCounters.medium--;
        } else if (sizeKey === 'large') {
          sizeAbbrev = 'L';
          counter = sizeCounters.large--;
        } else {
          counter = sizeCounters.nosize--;
        }
        
        // ✅ Regenerate the correct order - count position within size group
        const sizeGroupUnits = existingUnits.filter(u => (u.size || 'nosize') === sizeKey);
        const posInGroup = sizeGroupUnits.indexOf(unit) + 1;
        
        const generatedUnitNumber = sizeAbbrev 
          ? `${itemName}-${sizeAbbrev}-${posInGroup}` 
          : `${itemName}-${posInGroup}`;
        
        await pool.query(
          `UPDATE inventory_units SET unit_number = $1 WHERE id = $2`,
          [generatedUnitNumber, unit.id]
        );
      }
    }
    
    // ✅ Reset counters for new units - count current max per size
    sizeCounters = { small: 0, medium: 0, large: 0, nosize: 0 };
    existingUnits.forEach(unit => {
      const sizeKey = unit.size || 'nosize';
      if (sizeKey === 'small') sizeCounters.small++;
      else if (sizeKey === 'medium') sizeCounters.medium++;
      else if (sizeKey === 'large') sizeCounters.large++;
      else sizeCounters.nosize++;
    });

    // ✅ helper to make unit with high-quality QR and unit name
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

      const qrUrl = buildPublicUrl(req, `/qr_codes/${qrCodeId}.png`);
      const size = forceNoSize ? "nosize" : (sizeLabel ? sizeLabel.toLowerCase() : "nosize");
      
      // ✅ Generate unit name: "ItemName-Size-Number" (e.g., "Suyam-S-1")
      let sizeAbbrev = "";
      let counter = 0;
      if (size === "small") {
        sizeAbbrev = "S";
        counter = ++sizeCounters.small;
      } else if (size === "medium") {
        sizeAbbrev = "M";
        counter = ++sizeCounters.medium;
      } else if (size === "large") {
        sizeAbbrev = "L";
        counter = ++sizeCounters.large;
      } else {
        counter = ++sizeCounters.nosize;
      }
      
      // ✅ Generate unit name: "ItemName-Size-Number" format (e.g., "Suyam-S-1")
      const unitNumber = sizeAbbrev 
        ? `${itemName}-${sizeAbbrev}-${counter}` 
        : `${itemName}-${counter}`;

      unitsToGenerate.push({
        id: unitId,
        inventory_item_id: itemId,
        qr_code_text: qrCodeId,
        qr_code_url: qrUrl,
        size: size,
        unit_number: unitNumber, // ✅ Add unit name
      });
    };

    // ✅ generate units - ONLY CREATE DELTA (new units needed, not all)
    if (itemCategory && itemCategory.toLowerCase() === "costume") {
      // For costumes: only generate ADDITIONAL units needed beyond existing count
      const smallExisting = existingUnits.filter(u => u.size === 'small').length;
      const mediumExisting = existingUnits.filter(u => u.size === 'medium').length;
      const largeExisting = existingUnits.filter(u => u.size === 'large').length;
      
      const smallToCreate = Math.max(qty_small - smallExisting, 0);
      const mediumToCreate = Math.max(qty_medium - mediumExisting, 0);
      const largeToCreate = Math.max(qty_large - largeExisting, 0);
      
      for (let i = 0; i < smallToCreate; i++) await createQrAndPush("small");
      for (let i = 0; i < mediumToCreate; i++) await createQrAndPush("medium");
      for (let i = 0; i < largeToCreate; i++) await createQrAndPush("large");
    } else {
      // For instruments/accessories: only generate DELTA
      const accessoryExisting = existingUnits.filter(u => u.size === 'nosize' || !u.size).length;
      const accessoryToCreate = Math.max(generateCount, 0);
      
      for (let i = 0; i < accessoryToCreate; i++) {
        await createQrAndPush(null, true); // force nosize for non-costumes
      }
    }

    // ✅ insert all generated units with unit_number
    for (const unit of unitsToGenerate) {
      await pool.query(
        `INSERT INTO inventory_units 
         (id, inventory_item_id, qr_code_text, qr_code_url, size, unit_number, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, 'available', NOW())`,
        [unit.id, unit.inventory_item_id, unit.qr_code_text, unit.qr_code_url, unit.size, unit.unit_number]
      );
    }

    // ✅ Fetch all units (both updated existing and newly created) and return them sorted
    const allUnitsRes = await pool.query(
      `SELECT id, inventory_item_id, size, qr_code_url, qr_code_text, unit_number, status, created_at
       FROM inventory_units 
       WHERE inventory_item_id = $1
       ORDER BY 
         CASE 
           WHEN size = 'small' THEN 1
           WHEN size = 'medium' THEN 2
           WHEN size = 'large' THEN 3
           ELSE 4
         END,
         unit_number ASC`,
      [itemId]
    );

    res.status(200).json({
      message: `Generated ${unitsToGenerate.length} new units successfully, updated ${existingUnits.length} existing units`,
      allUnits: allUnitsRes.rows, // ✅ return ALL units (both updated and new) for frontend use
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

    // Step 3: Handle garments with sizes (fetch units with unit_number)
    const result = await pool.query(
      `SELECT id, inventory_item_id, size, qr_code_url, qr_code_text, unit_number, status, created_at 
       FROM inventory_units 
       WHERE inventory_item_id = $1 
       ORDER BY 
         CASE 
           WHEN size = 'small' THEN 1
           WHEN size = 'medium' THEN 2
           WHEN size = 'large' THEN 3
           ELSE 4
         END,
         unit_number`,
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

// 🧠 Internal helper to reuse QR scan logic programmatically
async function scanByQrCodeInternal(qrText) {
  try {
    const result = await pool.query(
      `
      SELECT 
        iu.id AS unit_id,
        ii.name,
        ii.category,
        ii.garment_type,
        iu.size,
        iu.status
      FROM inventory_units iu
      JOIN inventory_items ii ON iu.item_id = ii.id
      WHERE iu.qr_code = $1
      `,
      [qrText]
    );

    if (result.rows.length === 0) {
      return { type: "error", message: "Item not found for scanned QR." };
    }

    const item = result.rows[0];
    return {
      type: "inventory_unit",
      data: {
        id: item.unit_id,
        name: item.name,
        category: item.category,
        garment_type: item.garment_type,
        size: item.size,
        status: item.status,
      },
    };
  } catch (err) {
    console.error("❌ scanByQrCodeInternal error:", err);
    return { type: "error", message: "Internal database error." };
  }
}

// ======================================================
// 🧩 NEW FUNCTION: AI Fallback Scan using Image
// ======================================================
const scanImageFallback = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const imagePath = path.resolve(req.file.path);

    // ✅ Call Python script for inference
    const pythonProcess = spawn("python", [
      path.join(__dirname, "../ml/infer_qr.py"),
      imagePath,
    ]);

    let outputData = "";
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    let errorData = "";
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0 || !outputData.trim()) {
        console.error("❌ Python error:", errorData);
        fs.unlinkSync(imagePath); // cleanup uploaded image
        return res
          .status(500)
          .json({ error: "AI scan failed to recognize QR code." });
      }

      const qrText = outputData.trim();
      console.log("✅ Predicted QR text:", qrText);

      // ✅ Use internal QR handler to fetch item details
      const scanResult = await scanByQrCodeInternal(qrText);

      fs.unlinkSync(imagePath); // cleanup temp image

      if (scanResult.type === "error") {
        return res.status(404).json({ error: scanResult.message });
      }

      res.json(scanResult);
    });
  } catch (err) {
    console.error("❌ scanImageFallback error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ✅ NEW ENDPOINT: Get available inventory units for a specific item
// Used by frontend to resolve temporary unitIds to real available units
// GET /api/inventory-units/available/:itemId?quantity=5
const getAvailableUnits = async (req, res) => {
  const { itemId } = req.params;
  const { quantity = 1 } = req.query;

  try {
    const quantityNum = parseInt(quantity) || 1;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        error: 'Missing itemId parameter'
      });
    }

    console.log(`📦 Getting available units - itemId: ${itemId}, quantity: ${quantityNum}`);

    // Query available units for this item, ordered by created_at (FIFO)
    const result = await pool.query(
      `SELECT 
        id, 
        unit_id, 
        inventory_item_id as item_id, 
        status,
        created_at
       FROM inventory_units 
       WHERE inventory_item_id = $1 
         AND status = 'available'
       ORDER BY created_at ASC
       LIMIT $2`,
      [itemId, quantityNum]
    );

    console.log(`✅ Found ${result.rows.length} available units for itemId: ${itemId}`);

    // Return units in simplified format
    return res.json({
      success: true,
      count: result.rows.length,
      units: result.rows.map(u => ({
        id: u.id,
        unit_id: u.unit_id,
        item_id: u.item_id,
        status: u.status
      })),
      requested_quantity: quantityNum
    });

  } catch (error) {
    console.error('❌ Error fetching available units:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch available units: ' + error.message
    });
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
  scanImageFallback,
  scanByQrCodeInternal,
  getAvailableUnits, // ✅ NEW EXPORT
};
