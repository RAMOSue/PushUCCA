// server/routes/borrowRoutes.js
const express = require("express");
const router = express.Router();

const {
  addToCart,
  submitBorrowRequest,
  getBorrowHistory,
  getAllBorrowRequests,
  approveBorrowRequest,
  declineBorrowRequest,
  returnBorrowedItems,
  getInventoryUnitByQrText, // Scan QR for a unit
  updateBorrowCartQuantity, // ✅ NEW for per-unit quantity updates
} = require("../controllers/borrowController");

// TODO: plug in auth / role middleware when available
// const requireAuth = require("../middleware/requireAuth");
// const requireStaffOrAdmin = require("../middleware/requireStaffOrAdmin");

// -----------------------
// 🛒 Borrow Cart Routes
// -----------------------
router.post("/cart", addToCart);
router.post("/update-quantity", updateBorrowCartQuantity); // ✅ new endpoint

// -----------------------
// 📄 Borrow Request Routes
// -----------------------
router.post("/request", submitBorrowRequest);
router.get("/history/:userId", getBorrowHistory);
router.get("/requests", getAllBorrowRequests);
router.put("/requests/:id/approve", approveBorrowRequest);
router.put("/requests/:id/decline", declineBorrowRequest);

// -----------------------
// 🔄 Return Items
// -----------------------
router.post("/return", returnBorrowedItems);

// -----------------------
// 📲 QR Code Scan (Borrower)
// -----------------------
// Exact text scan for a single inventory unit
router.get("/scan/:qrCodeText", getInventoryUnitByQrText);

module.exports = router;
