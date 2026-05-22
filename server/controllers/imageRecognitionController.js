// server/controllers/imageRecognitionController.js
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const FormData = require("form-data");

/* -------------------------------------------------------------- */
/* File Upload Setup                                               */
/* -------------------------------------------------------------- */
const uploadDir = path.join(__dirname, "../uploads/image_recognition");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

/* -------------------------------------------------------------- */
/* AI Image Recognition Service (FastAPI Backend)                 */
/* -------------------------------------------------------------- */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

/**
 * Apply confidence boost for specific instruments with known confusion patterns
 * - agung: +20% boost (common confusion with similar percussion)
 * - gangsa: +10% boost (confusion with similar gong-like instruments)
 */
const applyConfidenceBoost = (prediction) => {
  const boostFactors = {
    agung: 0.20,      // +20% accuracy boost
    gangsa: 0.10,     // +10% accuracy boost
  };

  const boost = boostFactors[prediction.class_name] || 0;
  const boostedConfidence = Math.min(prediction.confidence + boost, 1.0); // Cap at 100%

  if (boost > 0) {
    console.log(
      `🔧 Confidence boost applied: ${prediction.class_name} ${(prediction.confidence * 100).toFixed(2)}% → ${(boostedConfidence * 100).toFixed(2)}%`
    );
  }

  return {
    ...prediction,
    confidence: boostedConfidence,
    confidence_boosted: boost > 0,
    original_confidence: prediction.confidence,
    boost_percentage: boost,
  };
};

/**
 * Scan image using FastAPI YOLO service
 * Returns predictions for musical instruments
 */
const scanImageWithAI = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const userId = req.user?.id; // From auth middleware
    const imagePath = req.file.path;

    console.log(`📸 Processing image: ${req.file.filename}`);

    // Prepare multipart form data for FastAPI
    const formData = new FormData();
    const fileStream = fs.createReadStream(imagePath);
    formData.append("file", fileStream, req.file.filename);

    // Call FastAPI /predict endpoint
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });

    const { predictions, count } = aiResponse.data;

    console.log(`✅ AI detected ${count} instruments in image`);
    console.log(`📐 Image dimensions:`, { width: aiResponse.data.image_width, height: aiResponse.data.image_height });

    // Apply confidence boost for specific instruments
    const boostedPredictions = predictions.map(applyConfidenceBoost);

    // Filter predictions: only keep those with 60% accuracy or higher
    const filteredPredictions = boostedPredictions.filter(p => p.confidence >= 0.60);
    const filteredCount = filteredPredictions.length;

    console.log(`🔍 After 60% accuracy filter: ${filteredCount} instruments`);

    if (filteredCount === 0) {
      // Don't save recognition attempts with no detections
      fs.unlinkSync(imagePath); // cleanup
      return res.json({
        type: "no_items",
        message: "No musical instruments detected with 60% or higher accuracy",
        predictions: [],
        count: 0,
      });
    }

    // Process predictions and match with inventory
    const matchedResults = [];
    const assignedUnitIds = []; // ✅ NEW: Track assigned units to avoid duplicates

    for (const prediction of filteredPredictions) {
      const matchedItem = await matchInventoryItem(prediction.class_name);
      
      // Log matched item name
      if (matchedItem?.name) {
        console.log(`✅ Matched: ${matchedItem.name} (${prediction.class_name}) - Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      } else {
        console.log(`⚠️ No match: ${prediction.class_name} - Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      }

      // ✅ DEBUG: Log bbox structure to understand format
      console.log(`📦 Prediction ${prediction.class_name} bbox:`, JSON.stringify(prediction.bbox));

      // ✅ FIXED: Get DIFFERENT available units for each detection (not same unit)
      let availableUnit = null;
      if (matchedItem?.uuid) {
        try {
          // ✅ CRITICAL FIX: Query by UUID, not ID
          // Get available units excluding already-assigned ones in this batch
          let query = `SELECT iu.id FROM inventory_units iu
             WHERE iu.inventory_item_id = $1 AND iu.status = 'available'`;
          
          const params = [matchedItem.uuid];
          
          // Add exclusion clause if we've already assigned units
          if (assignedUnitIds.length > 0) {
            const placeholders = assignedUnitIds.map((_, i) => `$${i + 2}`).join(',');
            query += ` AND iu.id NOT IN (${placeholders})`;
            params.push(...assignedUnitIds);
          }
          
          query += ` ORDER BY iu.id LIMIT 1`;
          
          const unitRes = await pool.query(query, params);
          
          if (unitRes.rows.length > 0) {
            availableUnit = unitRes.rows[0].id;
            assignedUnitIds.push(availableUnit); // ✅ Mark as assigned for this batch
            console.log(`🔗 Assigned unit ${availableUnit} to ${matchedItem.name}`);
          } else {
            console.warn(`⚠️ No available units found for ${matchedItem.name}`);
          }
        } catch (err) {
          console.error("Error fetching available unit:", err.message);
        }
      }

      const result = {
        class_name: prediction.class_name,
        confidence: prediction.confidence,
        bbox: prediction.bbox, // ✅ Pass through bbox as-is from FastAPI
        matched_item_id: matchedItem?.id || null,
        matched_unit_id: availableUnit || null,
        matched_item_name: matchedItem?.name || null,
      };

      matchedResults.push(result);

      // Save to database
      if (userId) {
        await saveRecognitionData(
          userId,
          req.file.filename,
          prediction.class_name,
          prediction.confidence,
          matchedItem?.id || null,
          availableUnit || null,
          matchedItem?.name || null  // Pass item name for logging
        );
      }
    }

    fs.unlinkSync(imagePath); // cleanup

    console.log(`✅ Sending ${matchedResults.length} matched predictions to frontend`);
    matchedResults.forEach((r, idx) => {
      console.log(`  ${idx}: ${r.class_name} bbox=${JSON.stringify(r.bbox)}`);
    });

    res.json({
      type: "success",
      message: `Detected ${filteredCount} instrument(s) with 40%+ accuracy`,
      predictions: matchedResults,
      count: filteredCount,
      image_width: aiResponse.data.image_width || 1280,
      image_height: aiResponse.data.image_height || 720,
    });
  } catch (err) {
    console.error("❌ AI scan error:", err.message);

    // Cleanup uploaded file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn("Failed to cleanup temp file:", e.message);
      }
    }

    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "AI service unavailable. Is the FastAPI server running? (http://127.0.0.1:8000)",
        service_url: AI_SERVICE_URL,
      });
    }

    res.status(500).json({
      error: "Failed to process image with AI service",
      details: err.message,
    });
  }
};

/**
 * Match AI prediction with inventory item by name similarity
 * ✅ CRITICAL FIX: Return both id AND uuid for proper database linking
 */
const matchInventoryItem = async (predictedClassName) => {
  try {
    const query = `
      SELECT id, uuid, name, category, qr_code_text, instrument_type
      FROM inventory_items
      WHERE category = 'instrument'
      AND (
        LOWER(name) LIKE LOWER($1) 
        OR LOWER(instrument_type) LIKE LOWER($2)
        OR LOWER(qr_code_text) LIKE LOWER($3)
      )
      LIMIT 1
    `;

    const searchTerm = `%${predictedClassName}%`;
    const result = await pool.query(query, [searchTerm, searchTerm, searchTerm]);

    return result.rows[0] || null;
  } catch (err) {
    console.error("Error matching inventory item:", err);
    return null;
  }
};

/**
 * Save recognition data to database
 */
const saveRecognitionData = async (
  userId,
  imageFilename,
  predictedItem,
  confidence,
  matchedItemId,
  matchedItemUuid,
  matchedItemName
) => {
  try {
    const imageUrl = `/uploads/image_recognition/${imageFilename}`;

    const query = `
      INSERT INTO image_recognition_data 
      (user_id, image_url, predicted_item, confidence, matched_item_id, matched_item_uuid, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;

    const result = await pool.query(query, [
      userId || null,
      imageUrl,
      predictedItem || null,
      confidence || null,
      matchedItemId || null,
      matchedItemUuid || null,
    ]);

    console.log(`✅ Saved recognition data: ID ${result.rows[0].id} - Item: ${matchedItemName || 'Unknown'}`);
    return result.rows[0].id;
  } catch (err) {
    console.error("❌ Error saving recognition data:", err);
    throw err;
  }
};

/**
 * Get recognition history for a user
 */
const getRecognitionHistory = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const query = `
      SELECT 
        id, user_id, image_url, predicted_item, confidence, 
        quantity_suggested, matched_item_id, created_at, matched_item_uuid
      FROM image_recognition_data
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      count: result.rows.length,
      history: result.rows,
    });
  } catch (err) {
    console.error("Error fetching recognition history:", err);
    res.status(500).json({ error: "Failed to fetch recognition history" });
  }
};

/**
 * Get health status of AI service
 */
const checkAIServiceHealth = async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, {
      timeout: 5000,
    });

    res.status(200).json({
      status: "healthy",
      ai_service: {
        url: AI_SERVICE_URL,
        status: response.data.status,
        model_loaded: response.data.model_loaded,
        classes: response.data.model_classes,
      },
    });
  } catch (err) {
    // Return 200 with unhealthy status instead of 503 to avoid console errors
    res.status(200).json({
      status: "unhealthy",
      ai_service: {
        url: AI_SERVICE_URL,
        error: "AI service is not responding",
        details: err.message,
      },
    });
  }
};

/**
 * Batch process multiple images
 */
const scanMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    const userId = req.user?.id;
    const results = [];

    for (const file of req.files) {
      try {
        const formData = new FormData();
        const fileStream = fs.createReadStream(file.path);
        formData.append("file", fileStream, file.filename);

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, formData, {
          headers: formData.getHeaders(),
          timeout: 30000,
        });

        const { predictions, count } = aiResponse.data;

        results.push({
          filename: file.filename,
          success: true,
          count,
          predictions,
        });

        // Apply confidence boost and save each prediction
        const boostedPredictions = predictions.map(applyConfidenceBoost);
        for (const prediction of boostedPredictions) {
          const matchedItem = await matchInventoryItem(prediction.class_name);
          if (userId) {
            await saveRecognitionData(
              userId,
              file.filename,
              prediction.class_name,
              prediction.confidence,
              matchedItem?.id || null,
              matchedItem?.id ? uuidv4() : null
            );
          }
        }

        fs.unlinkSync(file.path);
      } catch (err) {
        results.push({
          filename: file.filename,
          success: false,
          error: err.message,
        });
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }

    res.json({
      status: "completed",
      total_files: req.files.length,
      results,
    });
  } catch (err) {
    console.error("Batch scan error:", err);
    res.status(500).json({ error: "Batch processing failed" });
  }
};

/**
 * ✅ NEW: Get detection accuracy metrics by instrument
 * Shows % accuracy for each instrument detected
 */
const getDetectionAccuracy = async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(predicted_item, 'Unknown') as instrument,
        COUNT(*) as total_detections,
        COUNT(CASE WHEN matched_item_id IS NOT NULL THEN 1 END) as correct_detections,
        ROUND(COUNT(CASE WHEN matched_item_id IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as accuracy_percent,
        ROUND(AVG(confidence)::numeric, 3) as avg_confidence,
        MIN(confidence)::numeric as min_confidence,
        MAX(confidence)::numeric as max_confidence,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as last_detection
      FROM image_recognition_data
      GROUP BY predicted_item
      ORDER BY total_detections DESC, accuracy_percent DESC
    `;

    const result = await pool.query(query);

    // Calculate overall stats
    const totalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_scans,
        COUNT(DISTINCT predicted_item) as unique_instruments,
        COUNT(DISTINCT user_id) as total_users,
        ROUND(COUNT(CASE WHEN matched_item_id IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as overall_accuracy,
        ROUND(AVG(confidence)::numeric, 3) as avg_confidence
      FROM image_recognition_data
      WHERE confidence > 0
    `);

    console.log("📊 Accuracy metrics fetched:");
    result.rows.forEach(row => {
      console.log(`  ${row.instrument}: ${row.accuracy_percent}% (${row.correct_detections}/${row.total_detections})`);
    });

    res.json({
      success: true,
      overall: totalStats.rows[0],
      by_instrument: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Error fetching accuracy metrics:", err);
    res.status(500).json({ error: "Failed to fetch accuracy metrics" });
  }
};

module.exports = {
  scanImageWithAI,
  getRecognitionHistory,
  checkAIServiceHealth,
  scanMultipleImages,
  upload,
  getDetectionAccuracy,
};
