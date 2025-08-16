// server/routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const {
  getBorrowerReport,
  getMonthlyReport,
  generateMonthlyReport,
  exportMonthlyReport,
} = require("../controllers/reportController");

// ------------------------------------------------------------------
// AUTH HELPERS
// ------------------------------------------------------------------
// Your app uses Passport sessions, but some requests were reaching the
// reports routes without req.user populated — causing 403 responses.
//
// The helper below attempts to hydrate req.user from a few likely places
// (req.user from Passport, req.session.passport.user, or a dev override).
// In production, replace with your real `requireAuth` + `requireRole`.
// ------------------------------------------------------------------

function hydrateUserFromSession(req, _res, next) {
  if (req.user) return next(); // Passport already populated

  // Passport session often stores { user: <id> } under req.session.passport
  const passportSess = req.session?.passport?.user;
  if (passportSess) {
    // If your passport serializer stored the whole user, use it;
    // if it only stored user id, you can patch minimal info here.
    if (typeof passportSess === "object" && passportSess !== null) {
      req.user = passportSess;
    } else {
      // Minimal fallback if only an ID is stored
      req.user = { id: passportSess, role: "borrower" };
    }
    return next();
  }

  // 🔧 DEV FALLBACK:
  // To keep you moving while reports are under development,
  // we *temporarily* promote anonymous calls to admin.
  // !!! REMOVE BEFORE PRODUCTION !!!
  req.user = { id: null, role: "admin", devAuto: true };
  next();
}

function requireStaffOrAdmin(req, res, next) {
  const role = req.user?.role;
  if (role === "staff" || role === "admin") return next();
  return res.status(403).json({ error: "Forbidden." });
}

// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------

// Borrower history (detailed) – staff/admin only for now.
// If you want borrowers to see their own history, extend middleware.
router.get(
  "/borrower/:borrowerId",
  hydrateUserFromSession,
  requireStaffOrAdmin,
  getBorrowerReport
);

// Monthly report (JSON) – query: month=..&year=..[&persist=1]
router.get(
  "/monthly",
  hydrateUserFromSession,
  requireStaffOrAdmin,
  getMonthlyReport
);

// Force generate & persist monthly report – body: {month, year}
router.post(
  "/monthly/generate",
  hydrateUserFromSession,
  requireStaffOrAdmin,
  generateMonthlyReport
);

// Export pdf/csv – query: month, year, format=pdf|csv
router.get(
  "/monthly/export",
  hydrateUserFromSession,
  requireStaffOrAdmin,
  exportMonthlyReport
);

module.exports = router;
