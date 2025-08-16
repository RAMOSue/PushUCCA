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
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}

module.exports = {
  createUser,
  getUserByEmail,
};
