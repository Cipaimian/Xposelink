const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

// Non-blocking: sets req.user if a valid token is present, otherwise req.user = null.
// Reads token from HTTPOnly cookie first, falls back to Bearer header (legacy/migration).
function authMiddleware(req, res, next) {
  const cookieToken = req.cookies?.xposelink_token;
  const header = req.headers.authorization;
  const headerToken = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = cookieToken || headerToken;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = null;
  }

  next();
}

// Blocking: rejects requests with no valid token.
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Admin-only: rejects requests that are not from an admin user.
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

module.exports = { authMiddleware, requireAuth, requireAdmin };
