// server/routes/masterListRoutes.js
const express = require("express");
const router = express.Router();
const requireRole = require("../middleware/requireRole");
const { ensureAuth } = require("../helpers/auth");

const masterListController = require("../controllers/masterListController");
const { upload: slideshowUpload, getAllImages, getImageById, createImage, updateImage, deleteImage, reorderImages } = require("../controllers/slideshowImageController");

// ======================== RBAC MIDDLEWARE ========================
// All master list routes require STAFF role (or ADMIN)
const staffOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!role || (role !== "staff" && role !== "admin")) {
    return res.status(403).json({ error: "Forbidden: Staff or Admin access required" });
  }
  next();
};

// ======================== UNITS ROUTES ========================
// GET units - Allow all authenticated users (borrowers can view, staff/admin can manage)
router.get("/units", ensureAuth, masterListController.getAllUnits);
// POST/PUT/DELETE units - Staff/Admin only
router.post("/units", ensureAuth, staffOrAdmin, masterListController.createUnit);
router.put("/units/:id", ensureAuth, staffOrAdmin, masterListController.updateUnit);
router.delete("/units/:id", ensureAuth, staffOrAdmin, masterListController.deleteUnit);

// ======================== POSITIONS ROUTES ========================
router.get("/positions", ensureAuth, staffOrAdmin, masterListController.getAllPositions);
router.post("/positions", ensureAuth, staffOrAdmin, masterListController.createPosition);
router.put("/positions/:id", ensureAuth, staffOrAdmin, masterListController.updatePosition);
router.delete("/positions/:id", ensureAuth, staffOrAdmin, masterListController.deletePosition);

// ======================== ORGANIZATIONAL STRUCTURE ROUTES ========================
router.get("/org-structures", ensureAuth, staffOrAdmin, masterListController.getAllOrgStructures);
router.get("/org-structures/unit/:unitId", ensureAuth, staffOrAdmin, masterListController.getOrgStructuresByUnit);
// Assignment routes
router.get("/assignments/unit/:unitId", ensureAuth, staffOrAdmin, masterListController.getAssignmentsByUnit);
router.post("/assignments", ensureAuth, staffOrAdmin, masterListController.assignPosition);
router.delete("/assignments/:id", ensureAuth, staffOrAdmin, masterListController.removeAssignment);
router.post("/org-structures", ensureAuth, staffOrAdmin, masterListController.createOrgStructure);
router.put("/org-structures/:id", ensureAuth, staffOrAdmin, masterListController.updateOrgStructure);
router.delete("/org-structures/:id", ensureAuth, staffOrAdmin, masterListController.deleteOrgStructure);

// ======================== TERMS ROUTES ========================
router.get("/terms", ensureAuth, staffOrAdmin, masterListController.getAllTerms);
router.get("/terms/active", ensureAuth, staffOrAdmin, masterListController.getActiveTerms);
router.post("/terms", ensureAuth, staffOrAdmin, masterListController.createTerm);
router.put("/terms/:id", ensureAuth, staffOrAdmin, masterListController.updateTerm);
router.delete("/terms/:id", ensureAuth, staffOrAdmin, masterListController.deleteTerm);

// ======================== RULES ROUTES ========================
router.get("/rules", ensureAuth, staffOrAdmin, masterListController.getAllRules);
router.get("/rules/category/:category", ensureAuth, staffOrAdmin, masterListController.getRulesByCategory);
router.post("/rules", ensureAuth, staffOrAdmin, masterListController.createRule);
router.put("/rules/:id", ensureAuth, staffOrAdmin, masterListController.updateRule);
router.delete("/rules/:id", ensureAuth, staffOrAdmin, masterListController.deleteRule);

// ======================== EVENT TYPES ROUTES ========================
router.get("/event-types", ensureAuth, staffOrAdmin, masterListController.getAllEventTypes);
router.post("/event-types", ensureAuth, staffOrAdmin, masterListController.createEventType);
router.put("/event-types/:id", ensureAuth, staffOrAdmin, masterListController.updateEventType);
router.delete("/event-types/:id", ensureAuth, staffOrAdmin, masterListController.deleteEventType);

// ======================== ATTENDANCE SETTINGS ROUTES ========================
router.get("/attendance-settings", ensureAuth, staffOrAdmin, masterListController.getAttendanceSettings);
router.put("/attendance-settings", ensureAuth, staffOrAdmin, masterListController.updateAttendanceSettings);

// ======================== INVENTORY CATEGORIES ROUTES ========================
router.get("/inventory-categories", ensureAuth, staffOrAdmin, masterListController.getAllInventoryCategories);
router.post("/inventory-categories", ensureAuth, staffOrAdmin, masterListController.createInventoryCategory);
router.put("/inventory-categories/:id", ensureAuth, staffOrAdmin, masterListController.updateInventoryCategory);
router.delete("/inventory-categories/:id", ensureAuth, staffOrAdmin, masterListController.deleteInventoryCategory);

// ======================== POSITION PERMISSIONS ROUTES ========================
router.get("/positions/:positionId/permissions", ensureAuth, staffOrAdmin, masterListController.getPositionPermissions);
router.post("/positions/:positionId/permissions", ensureAuth, staffOrAdmin, masterListController.addPositionPermission);
router.delete("/positions/:positionId/permissions/:permissionName", ensureAuth, staffOrAdmin, masterListController.removePositionPermission);

// ======================== SLIDESHOW IMAGES ROUTES ========================
router.get("/slideshow-images", getAllImages); // Public - no auth needed for viewing
router.get("/slideshow-images/:id", getImageById);
router.post("/slideshow-images", ensureAuth, staffOrAdmin, slideshowUpload.single("image"), createImage);
router.put("/slideshow-images/:id", ensureAuth, staffOrAdmin, updateImage);
router.delete("/slideshow-images/:id", ensureAuth, staffOrAdmin, deleteImage);
router.post("/slideshow-images/reorder", ensureAuth, staffOrAdmin, reorderImages);

module.exports = router;
