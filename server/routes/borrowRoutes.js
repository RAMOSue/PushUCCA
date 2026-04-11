// server/routes/borrowRoutes.js
const express = require("express");
const router = express.Router();

const { ensureAuth } = require("../helpers/auth");

const {
  addToCart,
  batchAddToCart,
  submitBorrowRequest,
  getBorrowHistory,
  deleteFromHistory,
  getAllBorrowRequests,
  approveBorrowRequest,
  declineBorrowRequest,
  returnBorrowedItems,
  getInventoryUnitByQrText, // Scan QR for a unit
  updateBorrowCartQuantity, // per-unit quantity updates
  saveCartQuantity,         // ✅ NEW: save cart quantity to backend
  startBorrowingSession,    // ✅ new controller
  getReservedRequest,       // ✅ new controller for frontend
  addUnitsToCart,           // ✅ add units to existing cart
} = require("../controllers/borrowController");

// -----------------------
// 🟢 Borrowing Session Init
// -----------------------
router.post("/start", ensureAuth, startBorrowingSession);

// -----------------------
// 🛒 Borrow Cart Routes
// -----------------------
// 🔹 Updated route to match frontend call
router.post("/cart", addToCart);
// ✅ NEW: Batch add multiple items in one transaction
router.post("/cart/batch-add", batchAddToCart);
// Remove an item/unit from a reserved cart
router.post("/cart/remove", require("../controllers/borrowController").removeFromCart);
// 🔹 Add units to existing cart
router.post("/cart/add-units", addUnitsToCart);
// ✅ NEW: Save cart quantity to backend
router.post("/cart/save-quantity", saveCartQuantity);
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
router.delete("/history/:requestId", deleteFromHistory);
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

// -----------------------
// 📸 Photo Upload (Before/After Borrowing)
// -----------------------
const { uploadBorrowPhoto, getBorrowPhotos, deleteBorrowPhoto } = require("../controllers/borrowController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../public/uploads/borrow-photos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ Created photo upload directory:", uploadDir);
}

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "photo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images allowed"));
    }
  },
});

// Upload photo for a borrow request
router.post("/photos/:requestId/upload", ensureAuth, upload.single("photo"), uploadBorrowPhoto);

// Get photos for a borrow request
router.get("/photos/:requestId", ensureAuth, getBorrowPhotos);

// Delete a specific photo
router.delete("/photos/:photoId", ensureAuth, deleteBorrowPhoto);

// -----------------------
// 📸 Return Photo Upload
// -----------------------
const { 
  initiateReturn, 
  uploadReturnPhoto, 
  getReturnPhotos, 
  deleteReturnPhoto,
  submitReturn,
  approveReturn,
  declineReturn,
  staffManualReturn,
  staffManualReturnWithPhotos,
  getPendingReturns
} = require("../controllers/borrowController");

// Create return request directory
const returnPhotosDir = path.join(__dirname, "../public/uploads/return-photos");
if (!fs.existsSync(returnPhotosDir)) {
  fs.mkdirSync(returnPhotosDir, { recursive: true });
  console.log("✅ Created return photos directory:", returnPhotosDir);
}

// Configure multer for return photo uploads
const returnStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, returnPhotosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "return-photo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadReturn = multer({
  storage: returnStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images allowed"));
    }
  },
});

// Memory storage for staff manual return photos (files kept in memory for processing)
const uploadReturnMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images allowed"));
    }
  },
});

// Initiate return (create return request)
router.post("/return/initiate", ensureAuth, initiateReturn);

// Upload return photo
router.post("/return/photos/:requestId/upload", ensureAuth, uploadReturn.single("photo"), uploadReturnPhoto);

// Get return photos
router.get("/return/photos/:requestId", ensureAuth, getReturnPhotos);

// Delete return photo
router.delete("/return/photos/:photoId", ensureAuth, deleteReturnPhoto);

// Submit return (finalize)
router.post("/return/submit", ensureAuth, submitReturn);

// -----------------------
// ✅ Staff Return Approval
// -----------------------
// Get pending returns for staff review
router.get("/return/pending", ensureAuth, getPendingReturns);

// Approve return and mark items as returned (with photos)
router.post("/return/approve", ensureAuth, approveReturn);

// Decline/reject return request and move back to approved status
router.post("/return/decline", ensureAuth, declineReturn);

// Staff manually processes return without waiting for borrower submission
router.post("/return/manual", ensureAuth, staffManualReturn);

// Staff manually processes return with photos (uses memory storage)
router.post("/return/manual-with-photos", ensureAuth, uploadReturnMemory.array("photos", 10), staffManualReturnWithPhotos);

module.exports = router;
