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
  updateBorrowCartQuantity, // per-unit quantity updates
  startBorrowingSession,    // ✅ new controller
} = require("../controllers/borrowController");

// -----------------------
// 🟢 Borrowing Session Init
// -----------------------
router.post("/start", startBorrowingSession);

// -----------------------
// 🛒 Borrow Cart Routes
// -----------------------
router.post("/cart", addToCart);
router.post("/update-quantity", updateBorrowCartQuantity);

// -----------------------
// 📄 Borrow Request Routes
// -----------------------
// Support both /request and /submit so frontend stays flexible
router.post("/request", submitBorrowRequest);
router.post("/submit", submitBorrowRequest);

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
router.get("/scan/:qrCodeText", getInventoryUnitByQrText);

module.exports = router;
