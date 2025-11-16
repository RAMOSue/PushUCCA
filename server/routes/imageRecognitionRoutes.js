// server/routes/imageRecognitionRoutes.js
const express = require("express");
const router = express.Router();
const requireRole = require("../middleware/requireRole");

const {
  scanImageWithAI,
  getRecognitionHistory,
  checkAIServiceHealth,
  scanMultipleImages,
  upload,
} = require("../controllers/imageRecognitionController");

// Health check - public endpoint
router.get("/health", checkAIServiceHealth);

// Image recognition endpoints - authenticated users only
// Single image scan
router.post("/scan", requireRole(["borrower", "student", "staff", "admin"]), upload.single("image"), scanImageWithAI);

// Multiple images batch scan
router.post(
  "/scan/batch",
  requireRole(["staff", "admin"]),
  upload.array("images", 10),
  scanMultipleImages
);

// Get user's recognition history
router.get(
  "/history",
  requireRole(["borrower", "student", "staff", "admin"]),
  getRecognitionHistory
);

module.exports = router;
