// server/routes/inventoryRoutes.js
const express = require("express");
const router = express.Router();
const requireRole = require("../middleware/requireRole");

const inventoryController = require("../controllers/inventoryController");

// Destructure controller functions
const {
  getAllInventory,
  getAvailableInventory,
  getItemByQRCode,       // Legacy image-based QR scan
  scanQRCode,            // Flexible scan (text or URL)
  scanByQrCode,          // Exact text-based QR scan
  addToBorrowCart,
  reserveInventoryUnit,  // ✅ Reserve unit before adding to cart
  releaseInventoryUnit,  // ✅ NEW: Release unit/item back to inventory
  updateBorrowQuantity,  // ✅ Update borrow quantity route
  updateInventoryQuantity,
  restoreInventoryQuantity,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  deleteUnit,
  updateUnit,
  uploadImage,
  upload,
  generateUnitsForItem,
  getUnitsForItem,       // Fetch units for an inventory item
} = inventoryController;

// -----------------------
// 🔓 Public Inventory Routes
// -----------------------
router.get("/", getAllInventory);
router.get("/available", getAvailableInventory);

// ✅ Correct scan via unit QR code TEXT (preferred for scanner sync)
router.get("/scan/text/:qrCodeText", scanByQrCode);

// ✅ Flexible scan (accepts text or URL)
router.get("/scan/flexible/:qr", scanQRCode);

// ✅ Legacy image-based QR scan (optional / deprecated)
router.get("/scan/:qr", getItemByQRCode);

// ✅ Fetch all units for a specific inventory item
router.get("/:id/units", getUnitsForItem);

// -----------------------
// 🛒 Borrowing Cart & Quantity Sync Routes
// -----------------------
router.post("/borrow/cart", addToBorrowCart);
router.post("/borrow/reserve-unit", reserveInventoryUnit);
router.post("/borrow/reserve-item", reserveInventoryUnit); // alias for frontend
router.post("/borrow/release-unit", releaseInventoryUnit); // ✅ NEW route to release reserved units/items
router.post("/borrow/update-borrow-quantity", updateBorrowQuantity);
router.post("/borrow/update-quantity", updateInventoryQuantity);
router.post("/borrow/restore-quantity", restoreInventoryQuantity);

// -----------------------
// ⬆️ Manual File Upload (Images)
// -----------------------
router.post(
  "/upload",
  requireRole("staff"),
  (req, res, next) => {
    upload.single("image")(req, res, function (err) {
      if (err) {
        if (err.message.includes("file too large")) {
          return res.status(400).json({ error: "File too large (max 2MB)" });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  uploadImage
);

// -----------------------
// 📦 Inventory CRUD (Staff Only)
// -----------------------
router.post("/", requireRole("staff"), upload.single("file"), addInventoryItem);
router.put("/:id", requireRole("staff"), updateInventoryItem);
router.delete("/:id", requireRole("staff"), deleteInventoryItem);

// -----------------------
// 🧩 Inventory Unit CRUD (Staff Only)
// -----------------------
router.delete("/units/:unitId", requireRole("staff"), deleteUnit);
router.put("/units/:unitId", requireRole("staff"), updateUnit);
router.post("/:id/generate-units", requireRole("staff"), generateUnitsForItem);

module.exports = router;
