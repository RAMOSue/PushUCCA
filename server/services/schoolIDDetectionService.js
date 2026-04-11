/**
 * School ID Detection Service
 * Uses image processing and AI to detect and validate school IDs
 * Features:
 * - Detect if image is a school ID (not random photo)
 * - Extract student ID and school name
 * - Validate ID format and quality
 * - Return confidence scores and detected elements
 */

let Tesseract;
let sharp;

// Initialize Tesseract
try {
  Tesseract = require("tesseract.js");
  console.log("✅ Tesseract.js loaded successfully");
} catch (err) {
  console.error("❌ Failed to load tesseract.js:", err.message);
  console.warn("⚠️  Install with: npm install tesseract.js sharp --save");
  Tesseract = null;
}

// Initialize sharp
try {
  sharp = require("sharp");
  console.log("✅ Sharp loaded successfully");
} catch (err) {
  console.error("❌ Failed to load sharp:", err.message);
  console.warn("⚠️  Install with: npm install tesseract.js sharp --save");
  sharp = null;
}

const path = require("path");

// ✅ NEW: Import QR code detection service
const {
  detectQRCode,
  compareDetectionResults,
} = require("./qrCodeDetectionService");

/**
 * Main ID verification function
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} fieldName - "id_front" or "id_back"
 * @returns {Promise<Object>} Verification result
 */
async function verifySchoolID(imageBuffer, fieldName) {
  try {
    // Check if dependencies are installed
    if (!Tesseract || !sharp) {
      return {
        isValid: false,
        isSchoolID: false,
        detectedText: "",
        confidence: 0,
        schoolName: "Unknown",
        studentID: "Not detected",
        qrDetection: null,
        issues: ["Dependencies not installed. Run: npm install tesseract.js sharp --save"],
        message: "❌ System not configured. Please install dependencies first.",
        error: true,
      };
    }

    console.log("\n========== ID VERIFICATION START ==========");
    console.log("Field:", fieldName);
    console.log("━".repeat(50));

    // ✅ Step 1: Detect QR Code (parallel with OCR for speed)
    console.log("\n🔵 DETECTION METHOD 1: QR CODE DETECTION");
    console.log("━".repeat(50));
    const qrDetectionPromise = detectQRCode(imageBuffer).catch(err => {
      console.warn("⚠️  QR detection failed:", err.message);
      return {
        found: false,
        studentID: null,
        confidence: 0,
        error: true,
      };
    });

    // ✅ Step 2: Perform OCR (text detection)
    console.log("\n🟢 DETECTION METHOD 2: OCR TEXT DETECTION");
    console.log("━".repeat(50));
    const processedImage = await preprocessImage(imageBuffer);
    const ocrResult = await performOCR(processedImage);
    const detectedText = ocrResult.text || "";
    
    // ✅ Step 3: Analyze image properties
    const imageAnalysis = await analyzeImageProperties(imageBuffer);
    
    // ✅ Step 4: Wait for QR detection to complete
    const qrDetection = await qrDetectionPromise;
    
    console.log("\n🟡 QR CODE RESULT:");
    console.log("━".repeat(50));
    if (qrDetection.found) {
      console.log("✅ QR Code found!");
      console.log("📱 Decoded Data:", qrDetection.data);
      console.log("👤 Student ID from QR:", qrDetection.studentID);
      console.log("📊 Confidence:", (qrDetection.confidence * 100).toFixed(1) + "%");
    } else {
      console.log("❌ No QR code detected");
    }

    // ✅ Step 5: Determine if it's a school ID from OCR
    const isSchoolID = detectSchoolID(detectedText, imageAnalysis, fieldName);
    
    // ✅ Step 6: Extract school info from OCR
    const schoolInfo = extractSchoolInfo(detectedText);
    
    // ✅ Step 7: Compare OCR and QR detection results
    console.log("\n🟣 COMPARING DETECTION RESULTS");
    console.log("━".repeat(50));
    const comparisonResult = compareDetectionResults(
      schoolInfo.studentID,
      qrDetection.studentID
    );
    
    console.log("Comparison Result:", comparisonResult.message);
    
    // ✅ Step 8: Determine final student ID (QR takes priority if found)
    let finalStudentID = schoolInfo.studentID;
    let studentIDSource = "ocr";
    
    if (qrDetection.found && qrDetection.studentID) {
      finalStudentID = qrDetection.studentID;
      studentIDSource = "qr";
      console.log("✅ Using QR code student ID (higher priority):", finalStudentID);
    } else if (schoolInfo.studentID !== "Not detected") {
      console.log("✅ Using OCR student ID:", finalStudentID);
    } else {
      console.log("⚠️  No student ID detected from either method");
      finalStudentID = "Not detected";
    }
    
    // ✅ Step 9: Calculate final confidence
    let finalConfidence = calculateConfidence(
      isSchoolID,
      detectedText,
      imageAnalysis,
      schoolInfo
    );
    
    // ✅ Boost confidence if QR code also found matching ID
    if (qrDetection.found && qrDetection.studentID) {
      if (comparisonResult.match) {
        // Both methods agree - high confidence!
        finalConfidence = Math.max(finalConfidence, 0.95);
        console.log("🎯 DUAL VERIFICATION: Both OCR and QR detected same ID!");
      } else if (comparisonResult.source === "qr_only") {
        // Only QR found - still good
        finalConfidence = Math.max(finalConfidence, 0.85);
        console.log("📱 VERIFIED VIA QR CODE");
      } else if (comparisonResult.source === "ocr_only") {
        // Only OCR found - keep current confidence
        console.log("📝 VERIFIED VIA OCR");
      }
    }
    
    // Identify any issues
    const issues = identifyIssues(imageAnalysis, detectedText, isSchoolID);
    
    // Build response with QR detection data
    const response = {
      isValid: isSchoolID && finalConfidence > 0.6,
      isSchoolID,
      detectedText: detectedText.substring(0, 200), // Limit text length
      confidence: Math.min(finalConfidence, 1.0),
      schoolName: schoolInfo.schoolName || "Unknown",
      studentID: finalStudentID,
      studentIDSource: studentIDSource,
      issues: issues,
      message: generateMessage(isSchoolID, finalConfidence),
      // ✅ NEW: Include QR detection results
      qrDetection: {
        found: qrDetection.found,
        data: qrDetection.data,
        studentID: qrDetection.studentID,
        confidence: qrDetection.confidence,
      },
      detectionMethods: {
        ocr: {
          detected: isSchoolID,
          studentID: schoolInfo.studentID,
          confidence: calculateConfidence(isSchoolID, detectedText, imageAnalysis, schoolInfo),
        },
        qr: {
          detected: qrDetection.found,
          studentID: qrDetection.studentID,
          confidence: qrDetection.confidence,
        },
      },
    };
    
    console.log("\n========== FINAL VERIFICATION RESULT ==========");
    console.log("Status:", response.isValid ? "✅ VALID" : "❌ INVALID");
    console.log("Is School ID:", response.isSchoolID);
    console.log("Student ID:", response.studentID);
    console.log("Confidence:", (response.confidence * 100).toFixed(1) + "%");
    console.log("ID Source:", response.studentIDSource.toUpperCase());
    console.log("═".repeat(50));
    console.log("Message:", response.message);
    console.log("═".repeat(50) + "\n");
    
    return response;
  } catch (error) {
    console.error("School ID verification error:", error);
    return {
      isValid: false,
      isSchoolID: false,
      detectedText: "",
      confidence: 0,
      schoolName: "Unknown",
      studentID: "Error",
      issues: ["Failed to process image: " + error.message],
      message: "❌ Failed to verify ID. Please try again.",
      error: true,
    };
  }
}

/**
 * Preprocess image for better OCR results
 * - Resize
 * - Enhance contrast
 * - Convert to grayscale
 */
async function preprocessImage(imageBuffer) {
  try {
    if (!sharp) {
      console.warn("Sharp not available, using raw image");
      return imageBuffer;
    }

    const processed = await sharp(imageBuffer)
      .resize(1920, 1080, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .normalize() // Enhance contrast
      .toBuffer();
    
    return processed;
  } catch (error) {
    console.error("Image preprocessing error:", error);
    return imageBuffer; // Return original if processing fails
  }
}

/**
 * Perform OCR using Tesseract.js
 */
async function performOCR(imageBuffer) {
  try {
    if (!Tesseract) {
      console.warn("⚠️  Tesseract.js not available - returning empty text");
      return {
        text: "",
        confidence: 0,
      };
    }

    console.log("🔍 Starting OCR with Tesseract.js...");
    console.log("📦 Tesseract object type:", typeof Tesseract);
    console.log("📦 Tesseract.createWorker:", typeof Tesseract.createWorker);
    
    if (!Tesseract.createWorker || typeof Tesseract.createWorker !== "function") {
      console.error("❌ Tesseract.createWorker is not a function!");
      console.error("Tesseract object keys:", Object.keys(Tesseract || {}));
      return {
        text: "",
        confidence: 0,
      };
    }

    let worker;
    try {
      console.log("⏳ Creating Tesseract worker...");
      worker = await Tesseract.createWorker("eng", 1, {
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5/",
      });
      
      console.log("⏳ Loading Tesseract language data...");
      await worker.load();
      
      console.log("⏳ Recognizing text from image...");
      const result = await worker.recognize(imageBuffer);
      
      const extractedText = result.data.text || "";
      const confidence = result.data.confidence || 0;
      
      console.log("✅ OCR completed");
      console.log("📝 Extracted Text:", extractedText.substring(0, 200));
      console.log("📊 OCR Confidence:", confidence);
      
      return {
        text: extractedText,
        confidence: confidence,
      };
    } finally {
      if (worker) {
        try {
          console.log("🧹 Cleaning up Tesseract worker...");
          await worker.terminate();
        } catch (termErr) {
          console.warn("⚠️  Error terminating worker:", termErr.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ OCR error:", error.message || error);
    console.error("Error details:", error);
    return {
      text: "",
      confidence: 0,
    };
  }
}

/**
 * Analyze image properties (size, colors, content)
 */
async function analyzeImageProperties(imageBuffer) {
  try {
    if (!sharp) {
      // Basic analysis without sharp
      return {
        width: 0,
        height: 0,
        format: "unknown",
        hasAlpha: false,
        isPortrait: false,
        size: imageBuffer.length,
        isReasonableSize: imageBuffer.length > 10000 && imageBuffer.length < 50000000,
      };
    }

    const metadata = await sharp(imageBuffer).metadata();
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha || false,
      isPortrait: metadata.height > metadata.width,
      size: imageBuffer.length,
      isReasonableSize: imageBuffer.length > 10000 && imageBuffer.length < 50000000,
    };
  } catch (error) {
    console.error("Image analysis error:", error);
    return {
      width: 0,
      height: 0,
      format: "unknown",
      hasAlpha: false,
      isPortrait: false,
      size: imageBuffer.length,
      isReasonableSize: false,
    };
  }
}

/**
 * Detect if image is a school ID
 * Looks for keywords, patterns, and characteristics of school IDs
 */
function detectSchoolID(text, imageAnalysis, fieldName) {
  const upperText = text.toUpperCase();
  
  console.log("🔎 Detecting School ID with text:", upperText.substring(0, 300));
  
  // ✅ ENHANCED: Specific CSU detection patterns (more flexible matching)
  const csuPatterns = [
    /CARAGA\s+STATE\s+UNIVERSITY/i,
    /CSU\s+CARAGA/i,
    /CARAGA STATE/i,
    /CARAGA/i,  // Even just "CARAGA" is strong indicator
    /221-[0-9]{5,6}/i,  // CSU ID format: 221-XXXXX
    /221[\s-]?[0-9]{5,6}/i,  // Flexible spacing
    /STUDENT\s+ID.*221/i,  // "STUDENT ID 221-xxxxx" format
  ];
  
  // ✅ Check for CSU-specific patterns first (very specific)
  const isCsuId = csuPatterns.some(pattern => pattern.test(text));
  if (isCsuId) {
    console.log("✅ Detected CSU-specific pattern");
    return true;  // If it matches CSU pattern, definitely a school ID
  }
  
  // Common school ID keywords (Philippine schools)
  const schoolKeywords = [
    "CARAGA",
    "COLLEGE",
    "UNIVERSITY",
    "SCHOOL",
    "STATE",
    "TECH",
    "INSTITUTE",
    "EDUCATION",
    "ID",
    "STUDENT",
    "VALID",
    "CSU",
    "UPD",
    "ATENEO",
    "LASALLE",
    "MAPUA",
    "DLSU",
    "PUP",
    "CEBU",
    "DAVAO",
    "MANILA",
  ];
  
  // Check for student ID numbers (usually 6-12 digits or CSU format)
  const studentIDPattern = /\b(\d{6,12}|221-\d{5,6}|[A-Z]{1,3}\d{5,8})\b/;
  
  // Score calculation
  let score = 0;
  
  // ✅ Check for CSU-specific keywords first (they carry more weight)
  const csuKeywords = ["CARAGA", "CSU", "221"];
  const csuMatches = csuKeywords.filter(kw => upperText.includes(kw)).length;
  
  // ✅ Extra points for CSU detection
  if (csuMatches >= 2) score += 50;  // "CARAGA" + "CSU" or "CARAGA" + "221"
  else if (csuMatches === 1) score += 35;  // Found at least one CSU keyword
  
  // Check for other school keywords
  const otherKeywords = schoolKeywords.filter(kw => 
    !csuKeywords.includes(kw) && upperText.includes(kw)
  ).length;
  
  if (otherKeywords >= 2) score += 25; // Found multiple other school keywords
  else if (otherKeywords >= 1) score += 15; // Found at least one other keyword
  
  // Check for student ID pattern
  if (studentIDPattern.test(text)) score += 25;
  
  // Check for name pattern (usually 2+ words, title case)
  const namePattern = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)/;
  if (namePattern.test(text)) score += 15;
  
  // Check image orientation (IDs are usually portrait)
  if (imageAnalysis.isPortrait) score += 10;
  
  // Check image size (reasonable document size)
  if (imageAnalysis.isReasonableSize) score += 10;
  
  // ✅ ENHANCED: Front side detection
  if (fieldName === "id_front") {
    if (upperText.includes("STUDENT") && upperText.includes("ID")) score += 15;
    else if (upperText.includes("STUDENT") || upperText.includes("ID")) score += 10;
    if (upperText.includes("MAIN CAMPUS")) score += 15;  // CSU-specific
    if (upperText.includes("CARAGA")) score += 20;  // CSU front side bonus
  }
  
  // ✅ ENHANCED: Back side detection
  if (fieldName === "id_back") {
    if (upperText.includes("VALID") || upperText.includes("YEAR")) score += 10;
    if (upperText.includes("OFFICE") && upperText.includes("STUDENT") && upperText.includes("AFFAIRS")) score += 20;  // CSU-specific
    if (upperText.includes("CARAGA")) score += 20;  // CSU back side bonus
  }
  
  // ✅ ENHANCED: Adaptive threshold based on CSU detection
  const hasText = text && text.trim().length > 20;
  const hasCsuIndicators = csuMatches > 0;
  
  // ✅ Lower threshold if CSU is detected or if we have good text
  let threshold = 50;
  if (hasCsuIndicators) {
    threshold = 25;  // CSU detected - very low threshold
    console.log("🎯 CSU indicators detected - lowered threshold to 25");
  } else if (hasText) {
    threshold = 35;  // Good text extracted - lower threshold
  }
  
  console.log(`📊 ID Detection Score: ${score}/${threshold} (CSU: ${hasCsuIndicators ? 'YES' : 'NO'})`);
  
  return score >= threshold;
}

/**
 * Extract school and student information from text
 */
function extractSchoolInfo(text) {
  const upperText = text.toUpperCase();
  
  // Detect school - check specific patterns first
  let schoolName = "Unknown School";
  
  if (/CARAGA\s+STATE\s+UNIVERSITY|CSU\s+CARAGA|CARAGA STATE/i.test(text)) {
    schoolName = "Caraga State University";
    console.log("✅ Identified: Caraga State University");
  } else if (/UP|UNIVERSITY\s+OF\s+THE\s+PHILIPPINES/i.test(text)) {
    schoolName = "University of the Philippines";
  } else if (/ATENEO|ATENEO\s+DE\s+MANILA/i.test(text)) {
    schoolName = "Ateneo de Manila University";
  } else if (/LASALLE|LA\s+SALLE|DE\s+LA\s+SALLE/i.test(text)) {
    schoolName = "De La Salle University";
  } else if (/DLSU/i.test(text)) {
    schoolName = "De La Salle University";
  } else if (/MAPUA/i.test(text)) {
    schoolName = "Mapua University";
  } else if (/PUP|POLYTECHNIC\s+UNIVERSITY/i.test(text)) {
    schoolName = "Polytechnic University of the Philippines";
  }
  
  // Extract student ID
  let studentID = "Not detected";
  
  // CSU format: 221-XXXXX
  const csuIDMatch = text.match(/221-([0-9]{5,6})/);
  if (csuIDMatch) {
    studentID = `221-${csuIDMatch[1]}`;
    console.log("👤 Student ID found (CSU):", studentID);
  } else {
    // Generic student ID (6-12 digits or alphanumeric)
    const idMatch = text.match(/\b(\d{6,12}|[A-Z]{1,3}\d{5,8})\b/);
    if (idMatch) {
      studentID = idMatch[1];
      console.log("👤 Student ID found (generic):", studentID);
    }
  }
  
  return { schoolName, studentID };
}

/**
 * Calculate confidence score (0-1)
 */
function calculateConfidence(isSchoolID, detectedText, imageAnalysis, schoolInfo) {
  let confidence = 0;
  
  if (!isSchoolID) return 0;
  
  // Text quality (more text = better OCR)
  const textLength = detectedText.length;
  if (textLength > 100) confidence += 0.25;
  else if (textLength > 50) confidence += 0.15;
  else if (textLength > 20) confidence += 0.05;
  
  // Image quality
  if (imageAnalysis.isReasonableSize) confidence += 0.2;
  if (imageAnalysis.format === "jpeg" || imageAnalysis.format === "png") confidence += 0.15;
  
  // School name detection
  if (schoolInfo.schoolName !== "Unknown School") {
    confidence += 0.2;
    // CSU gets bonus confidence
    if (schoolInfo.schoolName === "Caraga State University") {
      confidence += 0.1;
      console.log("🎯 CSU ID detected - adding confidence bonus");
    }
  }
  
  // Student ID detection
  if (schoolInfo.studentID !== "Not detected") {
    confidence += 0.2;
    // CSU format (221-XXXXX) gets bonus
    if (/^221-[0-9]{5,6}$/.test(schoolInfo.studentID)) {
      confidence += 0.1;
      console.log("🎯 CSU student ID format detected - adding confidence bonus");
    }
  }
  
  const finalConfidence = Math.min(confidence, 1.0);
  console.log(`📈 Final Confidence: ${(finalConfidence * 100).toFixed(1)}%`);
  return finalConfidence;
}

/**
 * Identify any issues with the ID/image
 */
function identifyIssues(imageAnalysis, text, isSchoolID) {
  const issues = [];
  
  // Image format issues
  if (imageAnalysis.format && !["jpeg", "png", "webp"].includes(imageAnalysis.format)) {
    issues.push("Unsupported image format");
  }
  
  // Size issues
  if (!imageAnalysis.isReasonableSize) {
    if (imageAnalysis.size < 10000) {
      issues.push("Image is too small or compressed");
    } else if (imageAnalysis.size > 50000000) {
      issues.push("Image file is too large");
    }
  }
  
  // Resolution issues
  if (imageAnalysis.width && imageAnalysis.width < 400) {
    issues.push("Image resolution is too low");
  }
  
  // Text extraction issues
  if (text.length < 20) {
    issues.push("Could not extract enough text from image");
  }
  
  // Not a school ID
  if (!isSchoolID) {
    issues.push("Image does not appear to be a school ID");
  }
  
  return issues;
}

/**
 * Generate user-friendly message
 */
function generateMessage(isSchoolID, confidence) {
  if (!isSchoolID) {
    return "❌ This does not appear to be a school ID. Please capture a valid school ID.";
  }
  
  if (confidence > 0.85) {
    return "✅ Valid school ID detected with high confidence!";
  } else if (confidence > 0.6) {
    return "✅ School ID detected. Please verify the information is clear.";
  } else {
    return "⚠️ School ID detected but with low confidence. Please ensure good lighting and clarity.";
  }
}

module.exports = {
  verifySchoolID,
  detectSchoolID,
  extractSchoolInfo,
  calculateConfidence,
  analyzeImageProperties,
};
