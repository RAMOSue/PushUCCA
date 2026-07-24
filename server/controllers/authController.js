// server/controllers/authController.js
const pool = require("../db");
const { hashPassword, comparePassword } = require("../helpers/auth");
const jwt = require("jsonwebtoken");
const notificationController = require("./notificationController"); // ✅ added import
const verificationService = require("../services/verificationService"); // ✅ import verification service
const { sendVerificationEmail } = require("../utils/emailService"); // ✅ import email service

/* ============ CARSU EMAIL DOMAIN VALIDATION ============ */
const ALLOWED_EMAIL_DOMAINS = ["@carsu.edu.ph", "@gmail.com"];

const isValidEmail = (email) => {
  const emailLower = email.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
};

/* ---------------- TEST ---------------- */
const test = (req, res) => {
  res.json("test is working");
};

/* ============ EMAIL VERIFICATION SYSTEM ============ */

/**
 * Step 1: Register user (creates unverified account and sends verification code)
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate email format (frontend should also validate this)
    if (!email || !email.toLowerCase()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailLower = email.toLowerCase();

    // ✅ NEW: Validate allowed email domains
    if (!isValidEmail(emailLower)) {
      return res.status(400).json({
        error: `Only ${ALLOWED_EMAIL_DOMAINS.join(" or ")} email addresses are allowed`,
      });
    }

    // Validate required fields
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    // Check if email already exists
    const emailCheck = await pool.query("SELECT * FROM users WHERE email = $1", [emailLower]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // ✅ NEW: Create user with is_verified = false
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password, role, phone, is_verified) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id, name, email, role, phone, is_verified",
      [name, emailLower, hashedPassword, "borrower", phone]
    );

    const user = newUser.rows[0];

    // ✅ NEW: Create verification token and send email
    try {
      const tokenData = await verificationService.createVerificationToken(
        user.id,
        emailLower
      );

      // Send verification email
      await sendVerificationEmail(emailLower, tokenData.code);

      res.json({
        message:
          "Registration successful! Check your email for the verification code.",
        userId: user.id,
        email: user.email,
        expiresIn: "15 minutes",
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      console.error("Email error details:", emailError.message);
      console.error("EMAIL_USER env var:", process.env.EMAIL_USER);
      console.error("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
      
      // Delete the user if we can't send verification email
      await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
      
      return res.status(500).json({
        error: "Failed to send verification email. Please try again.",
        details: emailError.message,
      });
    }
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

/**
 * Step 2: Verify email code
 */
const verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({ error: "Email and verification code are required" });
    }

    const emailLower = email.toLowerCase();

    // Verify the code
    const verificationResult = await verificationService.verifyEmailCode(
      emailLower,
      verificationCode
    );

    if (!verificationResult.success) {
      return res.status(400).json({ error: verificationResult.error });
    }

    // ✅ NEW: Fetch the now-verified user
    const userQuery = await pool.query(
      "SELECT id, name, email, role, phone, is_verified FROM users WHERE id = $1",
      [verificationResult.userId]
    );

    const user = userQuery.rows[0];

    // ✅ NEW: Create JWT token and set cookie for automatic login
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // ✅ CHANGED: Extended to 7 days for session persistence
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // ✅ CHANGED: Extended to 7 days
    });

    res.json({
      message: "Email verified successfully! You are now logged in.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        is_verified: user.is_verified,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error.message);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
};

/**
 * Resend verification code
 */
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailLower = email.toLowerCase();

    // Find user
    const userQuery = await pool.query(
      "SELECT id, email, is_verified FROM users WHERE email = $1",
      [emailLower]
    );

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = userQuery.rows[0];

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Check rate limit
    const rateCheckResult = await verificationService.canResendVerification(user.id);
    if (!rateCheckResult.canResend) {
      return res.status(429).json({
        error: `Please wait ${rateCheckResult.waitSeconds} seconds before requesting a new code`,
        waitSeconds: rateCheckResult.waitSeconds,
      });
    }

    // Generate new code
    const tokenData = await verificationService.createVerificationToken(user.id, emailLower);

    // Send email
    await sendVerificationEmail(emailLower, tokenData.code);

    res.json({
      message: "Verification code sent! Check your email.",
      expiresIn: "15 minutes",
    });
  } catch (error) {
    console.error("Resend verification error:", error.message);
    res.status(500).json({
      error: "Failed to resend verification code. Please try again.",
    });
  }
};


/* ============ LOGIN SYSTEM ============ */

/**
 * Login user (only if email is verified)
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const emailLower = email.toLowerCase();
    console.log(`🔐 [loginUser] Login attempt for: ${emailLower}`);

    const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [emailLower]);
    if (userQuery.rows.length === 0) {
      console.warn(`⚠️ [loginUser] No user found: ${emailLower}`);
      return res.status(400).json({ error: "No user found with this email" });
    }

    const user = userQuery.rows[0];
    console.log(`✅ [loginUser] User found: ${user.email} (ID: ${user.id}, role: ${user.role})`);

    // ✅ NEW: Check if email is verified
    if (!user.is_verified) {
      console.warn(`⚠️ [loginUser] User not verified: ${email}`);
      return res.status(403).json({
        error: "Please verify your email before logging in",
        email: user.email,
        requiresVerification: true,
      });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      console.warn(`⚠️ [loginUser] Wrong password for: ${emailLower}`);
      return res.status(400).json({ error: "Incorrect password" });
    }

    console.log(`✅ [loginUser] Password correct for user: ${emailLower}`);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`🔐 [loginUser] JWT created for user ${user.id}`);

    // ✅ Enhanced cookie options with explicit path
    const cookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);
    console.log(`✅ [loginUser] Cookie set with options: ${JSON.stringify(cookieOptions)}`);

    // Trigger resend of pending notifications
    try {
      await notificationController.resendPendingForUser(user.id);
    } catch (notifyError) {
      console.warn(
        "⚠️ [loginUser] Failed to resend pending notifications:",
        notifyError?.message || notifyError
      );
    }

    console.log(`✅ [loginUser] Login successful for: ${emailLower}`);
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("❌ [loginUser] Error:", error.message, error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/* ---------------- GOOGLE OAUTH CALLBACK ---------------- */
const googleCallback = async (req, res) => {
  const { name, email } = req.user;

  try {
    let userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user;

    if (userQuery.rows.length === 0) {
      const newUser = await pool.query(
        "INSERT INTO users (name, email, role, is_verified) VALUES ($1, $2, $3, TRUE) RETURNING *",
        [name, email, "borrower"]
      );
      user = newUser.rows[0];
      console.log(`✅ [Google OAuth] New user created: ${email} (role: borrower)`);
    } else {
      user = userQuery.rows[0];
      // ✅ Mark existing user as verified on Google login
      await pool.query("UPDATE users SET is_verified = TRUE WHERE id = $1", [user.id]);
      user.is_verified = true;
      console.log(`✅ [Google OAuth] Existing user logged in: ${email} (role: ${user.role})`);
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Set cookie for server-side auth if needed
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log(`🔐 [Google OAuth] Token generated for user: ${user.email}`);

    // ✅ Step 4 also for Google login: trigger resend of pending notifications
    try {
      await notificationController.resendPendingForUser(user.id);
    } catch (notifyError) {
      console.warn("⚠️ Failed to resend pending notifications on Google login:", notifyError && notifyError.message ? notifyError.message : notifyError);
    }

    // ✅ Redirect based on user role for staff/admin
    const redirectPath = 
      user.role === "admin" ? "/admin" :
      user.role === "staff" ? "/staff" :
      "/available-items";

    // ✅ IMPORTANT: Pass token in URL so frontend can store it
    const redirectURL = `${process.env.FRONTEND_URL || "http://localhost:5173"}${redirectPath}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify({id: user.id, email: user.email, name: user.name, role: user.role}))}`;
    console.log(`✅ [Google OAuth] Redirecting to: ${redirectPath}`);
    
    res.redirect(redirectURL);
  } catch (error) {
    console.error("❌ Google auth error:", error.message);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=Google login failed`);
  }
};

/* ---------------- GET PROFILE ---------------- */
const getProfile = async (req, res) => {
  try {
    // ✅ Use req.user set by ensureAuth middleware
    const userId = req.user?.id;
    
    console.log(`📋 [getProfile] Profile request for user ID: ${userId}`);
    
    if (!userId) {
      console.warn(`❌ [getProfile] No user ID in req.user: ${JSON.stringify(req.user)}`);
      return res.status(401).json({ 
        error: "Unauthorized - No user ID",
        details: "req.user not set by ensureAuth middleware"
      });
    }

    const userQuery = await pool.query(
      "SELECT id, name, email, role, phone, dark_mode FROM users WHERE id = $1",
      [userId]
    );

    if (userQuery.rows.length === 0) {
      console.warn(`❌ [getProfile] User not found in DB: ${userId}`);
      return res.status(404).json({ 
        error: "User not found",
        userId: userId
      });
    }

    console.log(`✅ [getProfile] Profile retrieved for user: ${userQuery.rows[0].email}`);
    res.json(userQuery.rows[0]);
  } catch (error) {
    console.error(`❌ [getProfile] Error: ${error.message}`, error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/* ---------------- CHANGE PASSWORD ---------------- */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { token } = req.cookies;

    // ✅ Validate input
    if (!token) {
      return res.status(401).json({ 
        error: "Unauthorized - No token provided",
        message: "Please log in to change your password"
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: "Both current and new passwords are required",
        message: "Please fill in all password fields"
      });
    }

    // ✅ Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "New password must be at least 6 characters",
        message: "Password must be at least 6 characters long"
      });
    }

    // ✅ Prevent same password
    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        error: "New password must be different from current password",
        message: "Please choose a different password"
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ 
          error: "Unauthorized - Invalid token",
          message: "Your session has expired. Please log in again"
        });
      }

      // ✅ Get user from database
      const userQuery = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
      if (userQuery.rows.length === 0) {
        return res.status(404).json({ 
          error: "User not found",
          message: "Your account could not be found"
        });
      }

      const user = userQuery.rows[0];

      // ✅ Verify current password
      const isMatch = await comparePassword(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ 
          error: "Current password is incorrect",
          message: "The password you entered is incorrect. Please try again"
        });
      }

      // ✅ Hash new password and update
      try {
        const hashedNewPassword = await hashPassword(newPassword);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
          hashedNewPassword,
          decoded.id,
        ]);

        console.log(`✅ Password changed for user: ${user.email}`);
        
        return res.status(200).json({ 
          message: "✅ Your password has been changed successfully",
          success: true
        });
      } catch (hashErr) {
        console.error("Password hashing error:", hashErr.message);
        return res.status(500).json({ 
          error: "Failed to update password",
          message: "An error occurred while changing your password. Please try again"
        });
      }
    });
  } catch (error) {
    console.error("Change password error:", error.message);
    res.status(500).json({ 
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later"
    });
  }
};

/* ---------------- UPDATE THEME PREFERENCE ---------------- */
const updateThemePreference = async (req, res) => {
  try {
    const { token } = req.cookies;
    const { dark_mode } = req.body;

    if (!token) return res.status(401).json({ error: "Unauthorized - No token" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(401).json({ error: "Unauthorized - Invalid token" });

      await pool.query("UPDATE users SET dark_mode = $1 WHERE id = $2", [
        dark_mode,
        decoded.id,
      ]);

      res.json({ message: "Theme preference updated successfully" });
    });
  } catch (error) {
    console.error("Update theme error:", error.message);
    res.status(500).json({ error: "Failed to update theme preference" });
  }
};

/* ---------------- LOGOUT ---------------- */
const logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.json({ message: "Logged out successfully" });
};

/* ---------------- GET ALL USERS ---------------- */
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.division_id, d.name AS department_name
       FROM users u
       LEFT JOIN divisions d ON u.division_id = d.id
       ORDER BY u.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ---------------- UPDATE USER ROLE ---------------- */
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ["borrower", "staff", "admin"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role specified" });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role",
      [role, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Role updated", user: result.rows[0] });
  } catch (err) {
    console.error("Error updating role:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ---------------- UPDATE USER DIVISION ----------------*/
const updateUserDivision = async (req, res) => {
  const { id } = req.params;
  const { division_id } = req.body;

  try {
    // If division_id is null/empty, just unassign
    const divisionValue = division_id === "" || division_id === null ? null : parseInt(division_id, 10);

    const result = await pool.query(
      "UPDATE users SET division_id = $1 WHERE id = $2 RETURNING id, name, email, role, division_id",
      [divisionValue, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Division updated", user: result.rows[0] });
  } catch (err) {
    console.error("Error updating division:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ---------------- DELETE USER ---------------- */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully", id });
  } catch (err) {
    console.error("Error deleting user:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============ ACTIVITY LOGS ============ */

/**
 * Get activity logs for the current authenticated user
 */
const getActivityLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // For now, return mock data - can integrate with actual logs table later
    const activityLogs = [
      {
        id: 1,
        action: "Login",
        description: "Logged in from web",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        device: "Chrome",
      },
      {
        id: 2,
        action: "View Profile",
        description: "Viewed accommodation profile",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        device: "Chrome",
      },
      {
        id: 3,
        action: "Edit Settings",
        description: "Updated notification preferences",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        device: "Safari",
      },
      {
        id: 4,
        action: "Download Report",
        description: "Downloaded activity report",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        device: "Firefox",
      },
    ];

    res.json(activityLogs);
  } catch (err) {
    console.error("Error fetching activity logs:", err.message);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
};

/**
 * Get login history for the current authenticated user
 */
const getLoginHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // For now, return mock data - can integrate with actual login_history table later
    const loginHistory = [
      {
        id: 1,
        ip_address: "192.168.1.100",
        device: "Chrome",
        device_type: "Desktop",
        location: "Manila, Philippines",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: "successful",
      },
      {
        id: 2,
        ip_address: "203.153.45.67",
        device: "Safari",
        device_type: "Mobile",
        location: "Quezon City, Philippines",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: "successful",
      },
      {
        id: 3,
        ip_address: "156.123.45.89",
        device: "Firefox",
        device_type: "Desktop",
        location: "Makati, Philippines",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: "successful",
      },
      {
        id: 4,
        ip_address: "Unknown",
        device: "Unknown",
        device_type: "Unknown",
        location: "Unknown",
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: "failed",
      },
    ];

    res.json(loginHistory);
  } catch (err) {
    console.error("Error fetching login history:", err.message);
    res.status(500).json({ error: "Failed to fetch login history" });
  }
};

/**
 * Download activity logs as CSV
 */
const downloadActivityLogsCSV = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Create CSV header and sample data
    const csvContent = [
      ["Action", "Description", "Timestamp", "Device"].join(","),
      ["Login", "Logged in from web", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), "Chrome"].join(","),
      ["View Profile", "Viewed accommodation profile", new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), "Chrome"].join(","),
      ["Edit Settings", "Updated notification preferences", new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), "Safari"].join(","),
      ["Download Report", "Downloaded activity report", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), "Firefox"].join(","),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=activity-logs.csv");
    res.send(csvContent);
  } catch (err) {
    console.error("Error downloading activity logs:", err.message);
    res.status(500).json({ error: "Failed to download logs" });
  }
};

/* ============ EXPORT CONTROLLERS ============ */
module.exports = {
  test,
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationCode,
  getProfile,
  googleCallback,
  logoutUser,
  getAllUsers,
  updateUserRole,
  updateUserDivision,
  deleteUser,
  changePassword,
  updateThemePreference,
  getActivityLogs,
  getLoginHistory,
  downloadActivityLogsCSV,
};
