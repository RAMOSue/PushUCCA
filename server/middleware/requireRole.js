// middleware/requireRole.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to restrict access based on user role(s)
 * @param {string|string[]} roles - Role or array of allowed roles
 */
function requireRole(roles = []) {
  // Ensure roles is an array
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, {}, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      if (!decoded.role || !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient role' });
      }

      req.user = decoded;
      next();
    });
  };
}

module.exports = requireRole;
