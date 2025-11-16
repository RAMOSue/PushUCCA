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

    // Filter predictions: only keep those with 40% accuracy or higher
    const filteredPredictions = predictions.filter(p => p.confidence >= 0.40);
    const filteredCount = filteredPredictions.length;

    console.log(`🔍 After 40% accuracy filter: ${filteredCount} instruments`);

    if (filteredCount === 0) {
      // Don't save recognition attempts with no detections
      fs.unlinkSync(imagePath); // cleanup
      return res.json({
        type: "no_items",
        message: "No musical instruments detected with 40% or higher accuracy",
        predictions: [],
        count: 0,
      });
    }

    // Process predictions and match with inventory
    const matchedResults = [];

    for (const prediction of filteredPredictions) {
      const matchedItem = await matchInventoryItem(prediction.class_name);

      // Get an available unit for this item
      let availableUnit = null;
      if (matchedItem?.id) {
        try {
          const unitRes = await pool.query(
            `SELECT iu.id FROM inventory_units iu
             JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
             WHERE ii.id = $1 AND iu.status = 'available'
             LIMIT 1`,
            [matchedItem.id]
          );
          if (unitRes.rows.length > 0) {
            availableUnit = unitRes.rows[0].id;
          }
        } catch (err) {
          console.error("Error fetching available unit:", err.message);
        }
      }

      const result = {
        class_name: prediction.class_name,
        confidence: prediction.confidence,
        bbox: prediction.bbox,
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
          availableUnit || null
        );
      }
    }

    fs.unlinkSync(imagePath); // cleanup

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
 */
const matchInventoryItem = async (predictedClassName) => {
  try {
    const query = `
      SELECT id, name, category, qr_code_text, instrument_type
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
  matchedItemUuid
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

    console.log(`✅ Saved recognition data: ID ${result.rows[0].id}`);
    return result.rows[0];
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

    res.json({
      status: "healthy",
      ai_service: {
        url: AI_SERVICE_URL,
        status: response.data.status,
        model_loaded: response.data.model_loaded,
        classes: response.data.model_classes,
      },
    });
  } catch (err) {
    res.status(503).json({
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

        // Save each prediction
        for (const prediction of predictions) {
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

module.exports = {
  scanImageWithAI,
  getRecognitionHistory,
  checkAIServiceHealth,
  scanMultipleImages,
  upload,
};
