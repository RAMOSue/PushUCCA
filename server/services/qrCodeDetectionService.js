/**
 * QR Code Detection Service
 * Detects and decodes QR codes on school IDs
 * Works alongside OCR text detection
 * Features:
 * - Detect QR codes in image
 * - Decode QR code data (Student ID)
 * - Extract student ID from QR code
 * - Validate QR code format
 * - Return confidence scores
 */

let jsQR;

// Initialize jsQR
try {
  jsQR = require("jsqr");
  console.log("✅ jsQR loaded successfully");
} catch (err) {
  console.error("❌ Failed to load jsqr:", err.message);
  console.warn("⚠️  Install with: npm install jsqr --save");
  jsQR = null;
}

let Jimp;

// Initialize Jimp for image processing
try {
  Jimp = require("jimp");
  console.log("✅ Jimp loaded successfully");
} catch (err) {
  console.error("❌ Failed to load jimp:", err.message);
  console.warn("⚠️  Install with: npm install jimp --save");
  Jimp = null;
}

/**
 * Detect and decode QR code from image
 * @param {Buffer} imageBuffer - Image file buffer
 * @returns {Promise<Object>} QR code detection result
 */
async function detectQRCode(imageBuffer) {
  try {
    // Check if dependencies are installed
    if (!jsQR) {
      return {
        found: false,
        data: null,
        studentID: null,
        confidence: 0,
        message: "QR code detection not available",
        error: true,
      };
    }

    // Read image using Jimp
    let imageData = null;
    
    if (Jimp) {
      try {
        console.log("📸 Loading image with Jimp for QR detection...");
        const image = await Jimp.read(imageBuffer);
        
        // Get image dimensions and pixel data
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        console.log(`📏 Image dimensions: ${width}x${height}`);
        
        // Extract pixel data in RGBA format
        const data = new Uint8ClampedArray(image.bitmap.data);
        
        // Create ImageData format for jsQR
        imageData = {
          data: data,
          width: width,
          height: height,
        };
      } catch (jimpErr) {
        console.warn("⚠️  Jimp processing failed, attempting raw buffer:", jimpErr.message);
        // Attempt with raw buffer if Jimp fails
        imageData = await createImageDataFromBuffer(imageBuffer);
      }
    } else {
      // Fallback if Jimp not available
      imageData = await createImageDataFromBuffer(imageBuffer);
    }

    if (!imageData) {
      return {
        found: false,
        data: null,
        studentID: null,
        confidence: 0,
        message: "Failed to process image for QR detection",
        error: true,
      };
    }

    // Detect QR code using jsQR
    console.log("🔍 Scanning for QR codes...");
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (!qrCode) {
      console.log("⚠️  No QR code detected in image");
      return {
        found: false,
        data: null,
        studentID: null,
        confidence: 0,
        message: "No QR code found in image",
      };
    }

    // QR code found
    console.log("✅ QR code detected!");
    console.log("📍 QR Position:", qrCode.location);
    console.log("📝 QR Data:", qrCode.data);

    // Extract student ID from QR code
    const studentID = extractStudentIDFromQR(qrCode.data);
    
    // Validate QR data format
    const isValidFormat = validateQRFormat(qrCode.data, studentID);
    
    // Calculate confidence
    const confidence = isValidFormat ? 0.95 : 0.7;

    return {
      found: true,
      data: qrCode.data,
      studentID: studentID,
      confidence: confidence,
      location: qrCode.location,
      isValid: isValidFormat,
      message: `✅ QR Code detected - Student ID: ${studentID}`,
    };
  } catch (error) {
    console.error("❌ QR code detection error:", error);
    return {
      found: false,
      data: null,
      studentID: null,
      confidence: 0,
      message: "Error detecting QR code: " + error.message,
      error: true,
    };
  }
}

/**
 * Create ImageData from buffer (fallback method)
 * @param {Buffer} imageBuffer
 * @returns {Promise<Object|null>}
 */
async function createImageDataFromBuffer(imageBuffer) {
  try {
    // This is a simplified fallback - in production, use Jimp or Sharp
    // For now, we'll attempt with common image processing
    console.warn("⚠️  Using fallback image processing (limited QR detection)");
    return null; // Fallback not fully implemented
  } catch (error) {
    console.error("Image data creation error:", error);
    return null;
  }
}

/**
 * Extract student ID from QR code data
 * QR code may contain:
 * - Plain student ID (e.g., "221-01515")
 * - URL with student ID (e.g., "https://carsu.edu.ph/student/221-01515")
 * - JSON data with student ID
 * @param {string} qrData - Raw QR code data
 * @returns {string} Extracted student ID or original data
 */
function extractStudentIDFromQR(qrData) {
  if (!qrData) return null;

  // Try to find CSU student ID pattern (221-XXXXX)
  const csuIdMatch = qrData.match(/221-(\d{5,6})/i);
  if (csuIdMatch) {
    const studentID = "221-" + csuIdMatch[1];
    console.log("📝 Extracted CSU Student ID from QR:", studentID);
    return studentID;
  }

  // Try to extract from URL
  const urlMatch = qrData.match(/\/(\d{3}-\d{5,6})/);
  if (urlMatch) {
    console.log("📝 Extracted ID from URL:", urlMatch[1]);
    return urlMatch[1];
  }

  // Try to parse as JSON
  try {
    const jsonData = JSON.parse(qrData);
    if (jsonData.studentID) {
      console.log("📝 Extracted ID from JSON:", jsonData.studentID);
      return jsonData.studentID;
    }
    if (jsonData.id) {
      console.log("📝 Extracted ID from JSON:", jsonData.id);
      return jsonData.id;
    }
  } catch (e) {
    // Not JSON, continue
  }

  // If no pattern found, return the raw data if it looks like an ID
  if (/^\d{3}-\d{5,6}$/.test(qrData.trim())) {
    console.log("📝 QR data appears to be student ID:", qrData);
    return qrData.trim();
  }

  // Return full data if it's relatively short
  if (qrData.length < 100) {
    console.log("📝 Returning QR data as-is:", qrData);
    return qrData;
  }

  return null;
}

/**
 * Validate QR code format
 * @param {string} qrData - QR code data
 * @param {string} studentID - Extracted student ID
 * @returns {boolean} True if QR code appears valid for CSU ID
 */
function validateQRFormat(qrData, studentID) {
  if (!qrData) return false;

  // Check for CSU ID pattern
  if (/221-\d{5,6}/.test(qrData)) {
    console.log("✅ Valid CSU student ID pattern in QR");
    return true;
  }

  // Check if QR contains school information
  if (/caraga|csu|university/i.test(qrData)) {
    console.log("✅ QR contains school information");
    return true;
  }

  // Check if extracted ID is valid
  if (studentID && /221-\d{5,6}/.test(studentID)) {
    console.log("✅ Extracted student ID is valid format");
    return true;
  }

  return false;
}

/**
 * Compare OCR text ID with QR code ID
 * Used to verify both detection methods found same student
 * @param {string} ocrStudentID - Student ID from OCR
 * @param {string} qrStudentID - Student ID from QR code
 * @returns {Object} Comparison result
 */
function compareDetectionResults(ocrStudentID, qrStudentID) {
  if (!ocrStudentID && !qrStudentID) {
    return {
      match: false,
      ocrID: null,
      qrID: null,
      confidence: 0,
      message: "❌ No student ID detected from either OCR or QR",
    };
  }

  if (!ocrStudentID) {
    return {
      match: false,
      ocrID: null,
      qrID: qrStudentID,
      confidence: 0.7,
      message: `⚠️  Only QR code detected: ${qrStudentID}`,
      source: "qr_only",
    };
  }

  if (!qrStudentID) {
    return {
      match: false,
      ocrID: ocrStudentID,
      qrID: null,
      confidence: 0.6,
      message: `⚠️  Only OCR detected: ${ocrStudentID}`,
      source: "ocr_only",
    };
  }

  // Both detected - compare
  const normalize = (id) => (id || "").replace(/[-\s]/g, "").toUpperCase();
  const normalizedOcr = normalize(ocrStudentID);
  const normalizedQr = normalize(qrStudentID);

  if (normalizedOcr === normalizedQr) {
    return {
      match: true,
      ocrID: ocrStudentID,
      qrID: qrStudentID,
      confidence: 0.98,
      message: `✅ Both OCR and QR detected same ID: ${qrStudentID}`,
      source: "both",
    };
  }

  return {
    match: false,
    ocrID: ocrStudentID,
    qrID: qrStudentID,
    confidence: 0.5,
    message: `⚠️  OCR and QR show different IDs - OCR: ${ocrStudentID}, QR: ${qrStudentID}`,
    source: "mismatch",
  };
}

module.exports = {
  detectQRCode,
  extractStudentIDFromQR,
  validateQRFormat,
  compareDetectionResults,
};
