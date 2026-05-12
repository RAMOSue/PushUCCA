const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
// ✅ Verify JWT from cookie, attach user to req
const ensureAuth = (req, res, next) => {
  try {
    const token = req.cookies?.token; // read JWT from cookie
    
    // ✅ Enhanced logging
    const cookieHeader = req.headers['cookie'];
    console.log(`🔐 [ensureAuth] Auth check for ${req.path}`);
    console.log(`  - Token present: ${!!token}`);
    console.log(`  - Cookies header: ${!!cookieHeader}`);
    console.log(`  - Token preview: ${token ? token.substring(0, 20) + '...' : 'none'}`);
    
    if (!token) {
      console.warn(`⚠️ [ensureAuth] No token found in cookies for ${req.path}`);
      return res.status(401).json({ 
        error: "Unauthorized - No token provided",
        details: "Cookie 'token' not found in request"
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
