// routes/settingsRoutes.js
const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { ensureAuth } = require("../helpers/auth");

// ========================
// USER SETTINGS ROUTES
// ========================

// Get all settings for the current user
router.get("/me", ensureAuth, settingsController.getUserSettings);

// Update multiple settings at once
router.put("/me", ensureAuth, settingsController.updateUserSettings);

// Update a single setting
router.patch("/field", ensureAuth, settingsController.updateSingleSetting);

// Reset all settings to defaults
router.post("/reset", ensureAuth, settingsController.resetSettings);

module.exports = router;
