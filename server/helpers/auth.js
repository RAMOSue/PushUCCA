const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

/* ---------------- Password Helpers ---------------- */
const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    bcrypt.genSalt(12, (err, salt) => {
      if (err) return reject(err);
      bcrypt.hash(password, salt, (err, hash) => {
        if (err) return reject(err);
        resolve(hash);
      });
    });
  });
};

const comparePassword = (password, hashed) => {
  return bcrypt.compare(password, hashed);
};

/* ---------------- Auth Middleware ---------------- */
// ✅ Verify JWT from cookie OR Authorization header, attach user to req
const ensureAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token; // read JWT from cookie first
    
    // ✅ Check Authorization header if not in cookie (for Bearer tokens from frontend)
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7); // Remove "Bearer " prefix
      }
    }
    
    // ✅ Enhanced logging
    const cookieHeader = req.headers['cookie'];
    console.log(`🔐 [ensureAuth] Auth check for ${req.path}`);
    console.log(`  - Token from cookie: ${!!(req.cookies?.token)}`);
    console.log(`  - Token from Authorization header: ${!!(req.headers.authorization && token)}`);
    console.log(`  - Token present: ${!!token}`);
    console.log(`  - Cookies header: ${!!cookieHeader}`);
    console.log(`  - Token preview: ${token ? token.substring(0, 20) + '...' : 'none'}`);
    
    if (!token) {
      console.warn(`⚠️ [ensureAuth] No token found in cookies or Authorization header for ${req.path}`);
      return res.status(401).json({ 
        error: "Unauthorized - No token provided",
        details: "Token not found in cookies or Authorization header"
      });
    }

    // Verify and decode JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`✅ [ensureAuth] Token verified for user ID: ${decoded.id}`);
    } catch (jwtErr) {
      console.error(`❌ [ensureAuth] JWT verification failed: ${jwtErr.message}`);
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: "Unauthorized - Token expired",
          details: `Token expired at ${jwtErr.expiredAt}`,
          code: "TOKEN_EXPIRED"
        });
      }
      throw jwtErr;
    }

    const userQuery = await pool.query("SELECT id FROM users WHERE id = $1", [decoded.id]);
    if (userQuery.rows.length === 0) {
      console.warn(`⚠️ [ensureAuth] Account deleted for user ID: ${decoded.id}`);
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });
      return res.status(401).json({
        error: "Unauthorized - Account deleted",
        details: "Your account no longer exists",
        code: "ACCOUNT_DELETED",
      });
    }

    // Attach decoded user info to req for controllers
    req.user = decoded;
    next();
  } catch (err) {
    console.error(`❌ [ensureAuth] Auth error: ${err.message}`, err);
    return res.status(401).json({ 
      error: "Unauthorized - Invalid or expired token",
      details: err.message,
      code: "AUTH_FAILED"
    });
  }
};

// ✅ Ensure user is staff
const ensureStaff = (req, res, next) => {
  ensureAuth(req, res, () => {
    if (req.user?.role !== "staff") {
      return res.status(403).json({ 
        error: "Forbidden - Staff access required",
        userRole: req.user?.role
      });
    }
    next();
  });
};

// ✅ Ensure user is admin
const ensureAdmin = (req, res, next) => {
  ensureAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ 
        error: "Forbidden - Admin access required",
        userRole: req.user?.role
      });
    }
    next();
  });
};

// ✅ Ensure user is staff or admin
const ensureStaffOrAdmin = (req, res, next) => {
  ensureAuth(req, res, () => {
    if (req.user?.role !== "staff" && req.user?.role !== "admin") {
      return res.status(403).json({ 
        error: "Forbidden - Staff or Admin access required",
        userRole: req.user?.role
      });
    }
    next();
  });
};

module.exports = {
  hashPassword,
  comparePassword,
  ensureAuth,
  ensureStaff,
  ensureAdmin,
  ensureStaffOrAdmin,
};
