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
  getReservedRequest,       // ✅ new controller for frontend
} = require("../controllers/borrowController");

// -----------------------
// 🟢 Borrowing Session Init
// -----------------------
router.post("/start", startBorrowingSession);

// -----------------------
// 🛒 Borrow Cart Routes
// -----------------------
// 🔹 Updated route to match frontend call
router.post("/cart", addToCart);
// Remove an item/unit from a reserved cart
router.post("/cart/remove", require("../controllers/borrowController").removeFromCart);
router.post("/update-quantity", updateBorrowCartQuantity);

// 🔹 New route: fetch reserved request for user
router.get("/reserved/:userId", getReservedRequest);

// -----------------------
// 📄 Borrow Request Routes
// -----------------------
// Support both /request and /submit so frontend stays flexible
router.post("/request", submitBorrowRequest);
router.post("/submit", submitBorrowRequest);
// Alias used by frontend
router.post("/submit-cart", submitBorrowRequest);

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
