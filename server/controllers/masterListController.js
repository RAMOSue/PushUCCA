// server/controllers/masterListController.js
// Controller for Master List CRUD operations
const {
  UnitsModel,
  PositionsModel,
  OrgStructureModel,
  TermsModel,
  RulesModel,
  EventTypesModel,
  AttendanceSettingsModel,
  InventoryCategoriesModel,
  PositionPermissionsModel,
} = require("../models/masterListModel");

// ======================== UNITS ENDPOINTS ========================
const getAllUnits = async (req, res) => {
  try {
    const units = await UnitsModel.getAll();
    res.json(units);
  } catch (err) {
    console.error("Get units error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await UnitsModel.getById(id);
    if (!unit) return res.status(404).json({ error: "Unit not found" });
    res.json(unit);
  } catch (err) {
    console.error("Get unit error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createUnit = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const unit = await UnitsModel.create(name, description, status, req.user.id);
    res.status(201).json(unit);
  } catch (err) {
    console.error("Create unit error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const unit = await UnitsModel.update(id, { name, description, status }, req.user.id);
    if (!unit) return res.status(404).json({ error: "Unit not found" });
    res.json(unit);
  } catch (err) {
    console.error("Update unit error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await UnitsModel.delete(id);
    if (!unit) return res.status(404).json({ error: "Unit not found" });
    res.json({ success: true, message: "Unit deleted", unit });
  } catch (err) {
    console.error("Delete unit error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== POSITIONS ENDPOINTS ========================
const getAllPositions = async (req, res) => {
  try {
    const positions = await PositionsModel.getAll();
    res.json(positions);
  } catch (err) {
    console.error("Get positions error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const position = await PositionsModel.getById(id);
    if (!position) return res.status(404).json({ error: "Position not found" });
    res.json(position);
  } catch (err) {
    console.error("Get position error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createPosition = async (req, res) => {
  try {
    const { name, description, maxHolders, isSharedRole, status } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const position = await PositionsModel.create(name, description, maxHolders, isSharedRole, status, req.user.id);
    res.status(201).json(position);
  } catch (err) {
    console.error("Create position error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, maxHolders, isSharedRole, status } = req.body;

    const position = await PositionsModel.update(id, { name, description, maxHolders, isSharedRole, status });
    if (!position) return res.status(404).json({ error: "Position not found" });
    res.json(position);
  } catch (err) {
    console.error("Update position error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const position = await PositionsModel.delete(id);
    if (!position) return res.status(404).json({ error: "Position not found" });
    res.json({ success: true, message: "Position deleted", position });
  } catch (err) {
    console.error("Delete position error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== ORGANIZATIONAL STRUCTURE ENDPOINTS ========================
const getAllOrgStructures = async (req, res) => {
  try {
    const structures = await OrgStructureModel.getAll();
    res.json(structures);
  } catch (err) {
    console.error("Get org structures error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getOrgStructuresByUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const structures = await OrgStructureModel.getByUnit(unitId);
    res.json(structures);
  } catch (err) {
    console.error("Get org structures by unit error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createOrgStructure = async (req, res) => {
  try {
    const { unitId, positionId, hierarchyLevel, termId, status } = req.body;
    if (!unitId || !positionId) {
      return res.status(400).json({ error: "Unit ID and Position ID are required" });
    }

    const structure = await OrgStructureModel.create(unitId, positionId, hierarchyLevel, termId, status, req.user.id);
    res.status(201).json(structure);
  } catch (err) {
    console.error("Create org structure error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updateOrgStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { unitId, positionId, hierarchyLevel, termId, status } = req.body;

    const structure = await OrgStructureModel.update(id, { unitId, positionId, hierarchyLevel, termId, status });
    if (!structure) return res.status(404).json({ error: "Organizational structure not found" });
    res.json(structure);
  } catch (err) {
    console.error("Update org structure error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteOrgStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await OrgStructureModel.delete(id);
    if (!structure) return res.status(404).json({ error: "Organizational structure not found" });
    res.json({ success: true, message: "Organizational structure deleted", structure });
  } catch (err) {
    console.error("Delete org structure error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== TERMS ENDPOINTS ========================
const getAllTerms = async (req, res) => {
  try {
    const terms = await TermsModel.getAll();
    res.json(terms);
  } catch (err) {
    console.error("Get terms error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getActiveTerms = async (req, res) => {
  try {
    const terms = await TermsModel.getActive();
    res.json(terms);
  } catch (err) {
    console.error("Get active terms error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createTerm = async (req, res) => {
  try {
    const { name, description, startDate, endDate, isActive } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: "Name, start date, and end date are required" });
    }

    const term = await TermsModel.create(name, description, startDate, endDate, isActive, req.user.id);
    res.status(201).json(term);
  } catch (err) {
    console.error("Create term error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updateTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, isActive } = req.body;

    const term = await TermsModel.update(id, { name, description, startDate, endDate, isActive });
    if (!term) return res.status(404).json({ error: "Term not found" });
    res.json(term);
  } catch (err) {
    console.error("Update term error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const term = await TermsModel.delete(id);
    if (!term) return res.status(404).json({ error: "Term not found" });
    res.json({ success: true, message: "Term deleted", term });
  } catch (err) {
    console.error("Delete term error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== RULES ENDPOINTS ========================
const getAllRules = async (req, res) => {
  try {
    const rules = await RulesModel.getAll();
    res.json(rules);
  } catch (err) {
    console.error("Get rules error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getRulesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const rules = await RulesModel.getByCategory(category);
    res.json(rules);
  } catch (err) {
    console.error("Get rules by category error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createRule = async (req, res) => {
  try {
    const { title, description, category, severity, sanction, isActive } = req.body;
    if (!title || !category || !severity) {
      return res.status(400).json({ error: "Title, category, and severity are required" });
    }

    const rule = await RulesModel.create(title, description, category, severity, sanction, isActive, req.user.id);
    res.status(201).json(rule);
  } catch (err) {
    console.error("Create rule error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, severity, sanction, isActive } = req.body;

    const rule = await RulesModel.update(id, { title, description, category, severity, sanction, isActive });
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err) {
    console.error("Update rule error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await RulesModel.delete(id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ success: true, message: "Rule deleted", rule });
  } catch (err) {
    console.error("Delete rule error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== EVENT TYPES ENDPOINTS ========================
const getAllEventTypes = async (req, res) => {
  try {
    const eventTypes = await EventTypesModel.getAll();
    res.json(eventTypes);
  } catch (err) {
    console.error("Get event types error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createEventType = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const eventType = await EventTypesModel.create(name, description, status, req.user.id);
    res.status(201).json(eventType);
  } catch (err) {
    console.error("Create event type error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updateEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const eventType = await EventTypesModel.update(id, { name, description, status });
    if (!eventType) return res.status(404).json({ error: "Event type not found" });
    res.json(eventType);
  } catch (err) {
    console.error("Update event type error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const eventType = await EventTypesModel.delete(id);
    if (!eventType) return res.status(404).json({ error: "Event type not found" });
    res.json({ success: true, message: "Event type deleted", eventType });
  } catch (err) {
    console.error("Delete event type error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== ATTENDANCE SETTINGS ENDPOINTS ========================
const getAttendanceSettings = async (req, res) => {
  try {
    const settings = await AttendanceSettingsModel.get();
    res.json(settings);
  } catch (err) {
    console.error("Get attendance settings error:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateAttendanceSettings = async (req, res) => {
  try {
    const settings = await AttendanceSettingsModel.update(req.body, req.user.id);
    res.json(settings);
  } catch (err) {
    console.error("Update attendance settings error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== INVENTORY CATEGORIES ENDPOINTS ========================
const getAllInventoryCategories = async (req, res) => {
  try {
    const categories = await InventoryCategoriesModel.getAll();
    res.json(categories);
  } catch (err) {
    console.error("Get inventory categories error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createInventoryCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const category = await InventoryCategoriesModel.create(name, description, status, req.user.id);
    res.status(201).json(category);
  } catch (err) {
    console.error("Create inventory category error:", err);
    res.status(400).json({ error: err.message });
  }
};

const updateInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const category = await InventoryCategoriesModel.update(id, { name, description, status });
    if (!category) return res.status(404).json({ error: "Inventory category not found" });
    res.json(category);
  } catch (err) {
    console.error("Update inventory category error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await InventoryCategoriesModel.delete(id);
    if (!category) return res.status(404).json({ error: "Inventory category not found" });
    res.json({ success: true, message: "Inventory category deleted", category });
  } catch (err) {
    console.error("Delete inventory category error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================== POSITION PERMISSIONS ENDPOINTS ========================
const getPositionPermissions = async (req, res) => {
  try {
    const { positionId } = req.params;
    const permissions = await PositionPermissionsModel.getByPosition(positionId);
    res.json(permissions);
  } catch (err) {
    console.error("Get position permissions error:", err);
    res.status(500).json({ error: err.message });
  }
};

const addPositionPermission = async (req, res) => {
  try {
    const { positionId } = req.params;
    const { permissionName } = req.body;

    if (!permissionName) return res.status(400).json({ error: "Permission name is required" });

    const permission = await PositionPermissionsModel.addPermission(positionId, permissionName);
    res.status(201).json(permission);
  } catch (err) {
    console.error("Add position permission error:", err);
    res.status(500).json({ error: err.message });
  }
};

const removePositionPermission = async (req, res) => {
  try {
    const { positionId, permissionName } = req.params;
    const permission = await PositionPermissionsModel.removePermission(positionId, permissionName);
    res.json({ success: true, message: "Permission removed", permission });
  } catch (err) {
    console.error("Remove position permission error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  // Units
  getAllUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  // Positions
  getAllPositions,
  getPosition,
  createPosition,
  updatePosition,
  deletePosition,
  // Org Structure
  getAllOrgStructures,
  getOrgStructuresByUnit,
  createOrgStructure,
  updateOrgStructure,
  deleteOrgStructure,
  // Terms
  getAllTerms,
  getActiveTerms,
  createTerm,
  updateTerm,
  deleteTerm,
  // Rules
  getAllRules,
  getRulesByCategory,
  createRule,
  updateRule,
  deleteRule,
  // Event Types
  getAllEventTypes,
  createEventType,
  updateEventType,
  deleteEventType,
  // Attendance Settings
  getAttendanceSettings,
  updateAttendanceSettings,
  // Inventory Categories
  getAllInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
  // Position Permissions
  getPositionPermissions,
  addPositionPermission,
  removePositionPermission,
};
