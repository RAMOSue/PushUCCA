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
    const resolveToken = () => {
      if (req.cookies?.token) {
        return req.cookies.token;
      }

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
      }

      return null;
    };

    if (req.user?.role && allowedRoles.includes(req.user.role)) {
      return next();
    }

    const token = resolveToken();

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
