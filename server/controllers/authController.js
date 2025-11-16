// server/controllers/authController.js
const pool = require("../db");
const { hashPassword, comparePassword } = require("../helpers/auth");
const jwt = require("jsonwebtoken");
const notificationController = require("./notificationController"); // ✅ added import

/* ---------------- TEST ---------------- */
const test = (req, res) => {
  res.json("test is working");
};

/* ---------------- REGISTER ---------------- */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const emailCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email is already taken" });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await pool.query(
      "INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, phone",
      [name, email, hashedPassword, "borrower", phone]
    );

    res.json(newUser.rows[0]);
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ---------------- LOGIN ---------------- */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: "No user found" });
    }

    const user = userQuery.rows[0];
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Incorrect password" });
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
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // ✅ Step 4: After successful login, send queued notifications if subscription exists
    try {
      const subResult = await pool.query(
        "SELECT * FROM push_subscriptions WHERE user_id = $1",
        [user.id]
      );

      if (subResult.rows.length > 0 && notificationController.sendQueuedNotifications) {
        await notificationController.sendQueuedNotifications(user.id);
      }
    } catch (notifyError) {
      console.warn("⚠️ Failed to send queued notifications on login:", notifyError.message);
    }

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Internal server error" });
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
        "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING *",
        [name, email, "borrower"]
      );
      user = newUser.rows[0];
    } else {
      user = userQuery.rows[0];
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
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // ✅ Step 4 also for Google login
    try {
      const subResult = await pool.query(
        "SELECT * FROM push_subscriptions WHERE user_id = $1",
        [user.id]
      );
      if (subResult.rows.length > 0 && notificationController.sendQueuedNotifications) {
        await notificationController.sendQueuedNotifications(user.id);
      }
    } catch (notifyError) {
      console.warn("⚠️ Failed to send queued notifications on Google login:", notifyError.message);
    }

    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("Google auth error:", error.message);
    res.redirect("http://localhost:5173/login?error=Google login failed");
  }
};

/* ---------------- GET PROFILE ---------------- */
const getProfile = async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) return res.status(401).json({ error: "Unauthorized - No token" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(401).json({ error: "Unauthorized - Invalid token" });

      const userQuery = await pool.query(
        "SELECT id, name, email, role, phone, dark_mode FROM users WHERE id = $1",
        [decoded.id]
      );

      if (userQuery.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(userQuery.rows[0]);
    });
  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ---------------- CHANGE PASSWORD ---------------- */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { token } = req.cookies;

    if (!token) return res.status(401).json({ error: "Unauthorized - No token" });
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Both current and new passwords are required" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(401).json({ error: "Unauthorized - Invalid token" });

      const userQuery = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
      if (userQuery.rows.length === 0) return res.status(404).json({ error: "User not found" });

      const user = userQuery.rows[0];
      const isMatch = await comparePassword(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });

      const hashedNewPassword = await hashPassword(newPassword);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
        hashedNewPassword,
        decoded.id,
      ]);

      res.json({ message: "Password updated successfully" });
    });
  } catch (error) {
    console.error("Change password error:", error.message);
    res.status(500).json({ error: "Internal server error" });
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
    const result = await pool.query("SELECT id, name, email, role FROM users ORDER BY id");
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

/* ---------------- EXPORT CONTROLLERS ---------------- */
module.exports = {
  test,
  registerUser,
  loginUser,
  getProfile,
  googleCallback,
  logoutUser,
  getAllUsers,
  updateUserRole,
  deleteUser,
  changePassword,
  updateThemePreference,
};
