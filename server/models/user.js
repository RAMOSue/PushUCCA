// models/user.js
const pool = require("../db");

// Create a new user
async function createUser(name, email, password) {
  try {
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, email, password]
    );
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Get user by email (used for login)
async function getUserByEmail(email) {
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Get user by ID
async function getUserById(id) {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

// Update user password
async function updatePassword(userId, hashedPassword) {
  try {
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId]);
    return true;
  } catch (err) {
    throw err;
  }
}

// Update dark mode preference
async function updateThemePreference(userId, darkMode) {
  try {
    await pool.query("UPDATE users SET dark_mode = $1 WHERE id = $2", [darkMode, userId]);
    return true;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updatePassword,
  updateThemePreference,
};
