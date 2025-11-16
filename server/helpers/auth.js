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
    if (!token) {
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    // Verify and decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user info to req for controllers
    req.user = decoded;

    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ error: "Unauthorized - Invalid or expired token" });
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  ensureAuth,
};
