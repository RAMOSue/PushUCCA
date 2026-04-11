// server/services/verificationService.js
const pool = require("../db");

/**
 * Generate a random 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create or update a verification token for an email
 */
const createVerificationToken = async (userId, email) => {
  try {
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Mark previous tokens as used
    await pool.query(
      "UPDATE email_verification_tokens SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE",
      [userId]
    );

    // Insert new token
    const tokenResult = await pool.query(
      "INSERT INTO email_verification_tokens (user_id, token, email, expires_at) VALUES ($1, $2, $3, $4) RETURNING id, token, expires_at",
      [userId, verificationCode, email, expiresAt]
    );

    return {
      code: verificationCode,
      expiresAt: expiresAt,
      id: tokenResult.rows[0].id,
    };
  } catch (error) {
    console.error("Error creating verification token:", error);
    throw error;
  }
};

/**
 * Verify an email code
 */
const verifyEmailCode = async (email, verificationCode) => {
  try {
    // Find the verification token
    const tokenQuery = await pool.query(
      "SELECT * FROM email_verification_tokens WHERE email = $1 AND token = $2 AND is_used = FALSE ORDER BY created_at DESC LIMIT 1",
      [email, verificationCode]
    );

    if (tokenQuery.rows.length === 0) {
      return {
        success: false,
        error: "Invalid verification code",
      };
    }

    const token = tokenQuery.rows[0];

    // Check if token has expired
    if (new Date() > new Date(token.expires_at)) {
      return {
        success: false,
        error: "Verification code has expired",
      };
    }

    // Mark token as used and set verified_at
    await pool.query(
      "UPDATE email_verification_tokens SET is_used = TRUE, verified_at = NOW() WHERE id = $1",
      [token.id]
    );

    // Mark user as verified
    await pool.query("UPDATE users SET is_verified = TRUE WHERE id = $1", [
      token.user_id,
    ]);

    return {
      success: true,
      userId: token.user_id,
      email: email,
    };
  } catch (error) {
    console.error("Error verifying email code:", error);
    throw error;
  }
};

/**
 * Check if can resend verification code (rate limiting)
 * Max 1 resend per 5 minutes
 */
const canResendVerification = async (userId) => {
  try {
    const recentTokenQuery = await pool.query(
      "SELECT * FROM email_verification_tokens WHERE user_id = $1 AND created_at > NOW() - INTERVAL '5 minutes' AND is_used = FALSE ORDER BY created_at DESC LIMIT 1",
      [userId]
    );

    if (recentTokenQuery.rows.length > 0) {
      const token = recentTokenQuery.rows[0];
      const createdAt = new Date(token.created_at);
      const waitUntil = new Date(createdAt.getTime() + 5 * 60 * 1000);
      const waitSeconds = Math.ceil((waitUntil - new Date()) / 1000);

      return {
        canResend: false,
        waitSeconds: Math.max(0, waitSeconds),
      };
    }

    return {
      canResend: true,
      waitSeconds: 0,
    };
  } catch (error) {
    console.error("Error checking resend eligibility:", error);
    throw error;
  }
};

/**
 * Get verification status for a user
 */
const getVerificationStatus = async (userId) => {
  try {
    const userQuery = await pool.query(
      "SELECT id, email, is_verified FROM users WHERE id = $1",
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return null;
    }

    return userQuery.rows[0];
  } catch (error) {
    console.error("Error getting verification status:", error);
    throw error;
  }
};

/**
 * Get user by email
 */
const getUserByEmail = async (email) => {
  try {
    const userQuery = await pool.query(
      "SELECT id, name, email, is_verified FROM users WHERE email = $1",
      [email]
    );

    if (userQuery.rows.length === 0) {
      return null;
    }

    return userQuery.rows[0];
  } catch (error) {
    console.error("Error getting user by email:", error);
    throw error;
  }
};

/**
 * Clean up expired tokens (can be run by cron job)
 */
const cleanupExpiredTokens = async () => {
  try {
    const result = await pool.query(
      "DELETE FROM email_verification_tokens WHERE expires_at < NOW() AND is_used = FALSE"
    );
    console.log(
      `✅ Cleaned up ${result.rowCount} expired verification tokens`
    );
    return result.rowCount;
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);
    throw error;
  }
};

module.exports = {
  generateVerificationCode,
  createVerificationToken,
  verifyEmailCode,
  canResendVerification,
  getVerificationStatus,
  getUserByEmail,
  cleanupExpiredTokens,
};
