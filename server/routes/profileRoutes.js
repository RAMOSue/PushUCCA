// profileRoutes.js
const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const requireRole = require("../middleware/requireRole");
const { ensureAuth } = require("../helpers/auth"); // ✅ ensures user is authenticated

// ------------------------
// Borrower routes
// ------------------------

// Borrower uploads their own profile (authenticated)
router.post("/upload", ensureAuth, profileController.uploadProfile);

// 🆕 Update profile info (name, phone, division) - dedicated endpoint
router.post("/update-info", ensureAuth, profileController.updateProfileInfo);

// ✅ PATCH current user's profile (modern REST pattern)
router.patch("/me", ensureAuth, profileController.updateProfileInfo);

// 🆕 Verify school ID (AI/OCR detection)
router.post("/verify-school-id", ensureAuth, profileController.verifySchoolId);

// Get current user's profile
// Frontend can call: axios.get("/api/profiles/me") or axios.get("/api/profiles/profile")
router.get("/profile", ensureAuth, profileController.getMyProfile); // alias
router.get("/me", ensureAuth, profileController.getMyProfile);      // frontend compatible

// ------------------------
// ✅ FIX: Place download route BEFORE ":id" to avoid conflict
// ------------------------
// Example: /api/profiles/download?path=/uploads/profiles/unnamed-12345.jpg
router.get("/download", ensureAuth, profileController.downloadFile);

// ------------------------
// Admin/Staff routes
// ------------------------

// List all profiles
router.get("/all", ensureAuth, requireRole(["admin", "staff"]), profileController.getAllProfiles);

// Fetch a specific profile by ID
router.get("/:id", ensureAuth, requireRole(["admin", "staff"]), profileController.getProfileById);

module.exports = router;
