// models/settingsModel.js
const pool = require("../db");

// Get user settings (fetch all settings for a user)
async function getUserSettings(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      // If no settings exist, create default settings for this user
      return await createDefaultSettings(userId);
    }
    
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Create default settings for a new user
async function createDefaultSettings(userId) {
  try {
    const result = await pool.query(
      `INSERT INTO user_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId]
    );
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Update user settings (partial update)
async function updateUserSettings(userId, settings) {
  try {
    // Build dynamic query based on provided settings
    const allowedFields = [
      'theme',
      'dark_mode',
      'accent_color',
      'compact_mode',
      'animation_level',
      'notifications_enabled',
      'request_alerts',
      'conflict_alerts',
      'reminder_frequency',
      'two_fa_enabled',
      'date_format',
      'auto_approval_enabled',
      'duplicate_protection'
    ];

    const updates = [];
    const values = [userId];
    let paramCounter = 2;

    for (const [key, value] of Object.entries(settings)) {
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
        updates.push(`${key} = $${paramCounter}`);
        values.push(value);
        paramCounter++;
      }
    }

    if (updates.length === 0) {
      // No valid updates, return existing settings
      return await getUserSettings(userId);
    }

    const query = `UPDATE user_settings 
                   SET ${updates.join(', ')}
                   WHERE user_id = $1
                   RETURNING *`;

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Update specific setting (single field)
async function updateSetting(userId, fieldName, fieldValue) {
  try {
    const allowedFields = [
      'theme',
      'dark_mode',
      'accent_color',
      'compact_mode',
      'animation_level',
      'notifications_enabled',
      'request_alerts',
      'conflict_alerts',
      'reminder_frequency',
      'two_fa_enabled',
      'date_format',
      'auto_approval_enabled',
      'duplicate_protection'
    ];

    if (!allowedFields.includes(fieldName)) {
      throw new Error(`Invalid field: ${fieldName}`);
    }

    const result = await pool.query(
      `UPDATE user_settings SET ${fieldName} = $1 WHERE user_id = $2 RETURNING *`,
      [fieldValue, userId]
    );

    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Reset settings to defaults for a user
async function resetUserSettings(userId) {
  try {
    const result = await pool.query(
      `UPDATE user_settings 
       SET theme = 'system',
           dark_mode = FALSE,
           accent_color = 'indigo',
           compact_mode = FALSE,
           animation_level = 'standard',
           notifications_enabled = TRUE,
           request_alerts = TRUE,
           conflict_alerts = TRUE,
           reminder_frequency = 'daily',
           two_fa_enabled = FALSE,
           date_format = 'MM/DD/YYYY',
           auto_approval_enabled = FALSE,
           duplicate_protection = TRUE
       WHERE user_id = $1
       RETURNING *`,
      [userId]
    );

    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

module.exports = {
  getUserSettings,
  createDefaultSettings,
  updateUserSettings,
  updateSetting,
  resetUserSettings,
};
