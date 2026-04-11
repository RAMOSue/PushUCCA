// controllers/settingsController.js
const settingsModel = require("../models/settingsModel");

// Get user's settings
const getUserSettings = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID not found" });
    }

    const settings = await settingsModel.getUserSettings(userId);
    res.json(settings);
  } catch (err) {
    console.error("Error fetching user settings:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
};

// Update user's settings (partial or full update)
const updateUserSettings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID not found" });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No settings provided to update" });
    }

    const updatedSettings = await settingsModel.updateUserSettings(userId, updates);
    res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error("Error updating user settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

// Update a single setting
const updateSingleSetting = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { fieldName, fieldValue } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID not found" });
    }

    if (!fieldName || fieldValue === undefined) {
      return res.status(400).json({ error: "Field name and value are required" });
    }

    const updated = await settingsModel.updateSetting(userId, fieldName, fieldValue);
    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error("Error updating setting:", err);
    res.status(400).json({ error: err.message || "Failed to update setting" });
  }
};

// Reset settings to defaults
const resetSettings = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID not found" });
    }

    const resetSettings = await settingsModel.resetUserSettings(userId);
    res.json({ success: true, settings: resetSettings });
  } catch (err) {
    console.error("Error resetting user settings:", err);
    res.status(500).json({ error: "Failed to reset settings" });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings,
  updateSingleSetting,
  resetSettings,
};
