// server/models/masterListModel.js
// Centralized CRUD operations for Master List tables
const pool = require("../db");

// ======================== UNITS ========================
class UnitsModel {
  static async getAll() {
    const result = await pool.query("SELECT * FROM divisions ORDER BY name ASC");
    return result.rows;
  }

  static async getById(id) {
    const result = await pool.query("SELECT * FROM divisions WHERE id = $1", [id]);
    return result.rows[0];
  }

  static async create(name, description, status = "Active", createdBy) {
    // Check for duplicates
    const existing = await pool.query("SELECT id FROM divisions WHERE LOWER(name) = LOWER($1)", [name]);
    if (existing.rows.length > 0) {
      throw new Error(`Unit "${name}" already exists`);
    }

    const result = await pool.query(
      "INSERT INTO divisions (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, description, status, createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, status }, updatedBy) {
    // Check if another unit has this name
    if (name) {
      const existing = await pool.query(
        "SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) AND id != $2",
        [name, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Unit "${name}" already exists`);
      }
    }

    const result = await pool.query(
      "UPDATE divisions SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
      [name, description, status, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    // Soft delete by setting status to Inactive (or hard delete if needed)
    const result = await pool.query(
      "UPDATE divisions SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== POSITIONS ========================
class PositionsModel {
  static async getAll() {
    const result = await pool.query("SELECT * FROM positions ORDER BY name ASC");
    return result.rows;
  }

  static async getById(id) {
    const result = await pool.query("SELECT * FROM positions WHERE id = $1", [id]);
    return result.rows[0];
  }

  static async create(name, description, maxHolders, isSharedRole, status, createdBy) {
    // Check for duplicates
    const existing = await pool.query("SELECT id FROM positions WHERE LOWER(name) = LOWER($1)", [name]);
    if (existing.rows.length > 0) {
      throw new Error(`Position "${name}" already exists`);
    }

    const result = await pool.query(
      "INSERT INTO positions (name, description, max_holders, is_shared_role, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, description, maxHolders || 1, isSharedRole || false, status || "Active", createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, maxHolders, isSharedRole, status }) {
    if (name) {
      const existing = await pool.query(
        "SELECT id FROM positions WHERE LOWER(name) = LOWER($1) AND id != $2",
        [name, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Position "${name}" already exists`);
      }
    }

    const result = await pool.query(
      "UPDATE positions SET name = COALESCE($1, name), description = COALESCE($2, description), max_holders = COALESCE($3, max_holders), is_shared_role = COALESCE($4, is_shared_role), status = COALESCE($5, status), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
      [name, description, maxHolders, isSharedRole, status, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      "UPDATE positions SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== ORGANIZATIONAL STRUCTURES ========================
class OrgStructureModel {
  static async getAll() {
    const result = await pool.query(`
      SELECT 
        os.id, os.unit_id, u.name as unit_name,
        os.position_id, p.name as position_name,
        os.hierarchy_level, os.term_id, t.name as term_name,
        os.status, os.created_at, os.updated_at
      FROM organizational_structures os
      LEFT JOIN divisions u ON os.unit_id = u.id
      LEFT JOIN positions p ON os.position_id = p.id
      LEFT JOIN terms t ON os.term_id = t.id
      ORDER BY os.hierarchy_level, p.name
    `);
    return result.rows;
  }

  static async getByUnit(unitId) {
    const result = await pool.query(`
      SELECT 
        os.id, os.unit_id, u.name as unit_name,
        os.position_id, p.name as position_name,
        os.hierarchy_level, os.term_id, t.name as term_name,
        os.status
      FROM organizational_structures os
      LEFT JOIN divisions u ON os.unit_id = u.id
      LEFT JOIN positions p ON os.position_id = p.id
      LEFT JOIN terms t ON os.term_id = t.id
      WHERE os.unit_id = $1
      ORDER BY os.hierarchy_level
    `, [unitId]);
    return result.rows;
  }

  static async create(unitId, positionId, hierarchyLevel, termId, status, createdBy) {
    // Check for duplicates
    const existing = await pool.query(
      "SELECT id FROM organizational_structures WHERE unit_id = $1 AND position_id = $2 AND term_id IS NOT DISTINCT FROM $3",
      [unitId, positionId, termId]
    );
    if (existing.rows.length > 0) {
      throw new Error("This position is already assigned to this unit for the selected term");
    }

    const result = await pool.query(
      "INSERT INTO organizational_structures (unit_id, position_id, hierarchy_level, term_id, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [unitId, positionId, hierarchyLevel, termId, status || "Active", createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { unitId, positionId, hierarchyLevel, termId, status }) {
    const result = await pool.query(
      "UPDATE organizational_structures SET unit_id = COALESCE($1, unit_id), position_id = COALESCE($2, position_id), hierarchy_level = COALESCE($3, hierarchy_level), term_id = COALESCE($4, term_id), status = COALESCE($5, status), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
      [unitId, positionId, hierarchyLevel, termId, status, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    // Perform hard delete to fully remove officer assignment records
    const result = await pool.query(
      "DELETE FROM organizational_structures WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== TERMS ========================
class TermsModel {
  static async getAll() {
    const result = await pool.query("SELECT * FROM terms ORDER BY start_date DESC");
    return result.rows;
  }

  static async getActive() {
    const result = await pool.query("SELECT * FROM terms WHERE is_active = TRUE ORDER BY start_date DESC");
    return result.rows;
  }

  static async create(name, description, startDate, endDate, isActive, createdBy) {
    // Check for duplicates
    const existing = await pool.query("SELECT id FROM terms WHERE LOWER(name) = LOWER($1)", [name]);
    if (existing.rows.length > 0) {
      throw new Error(`Term "${name}" already exists`);
    }

    const result = await pool.query(
      "INSERT INTO terms (name, description, start_date, end_date, is_active, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, description, startDate, endDate, isActive || false, createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, startDate, endDate, isActive }) {
    if (name) {
      const existing = await pool.query(
        "SELECT id FROM terms WHERE LOWER(name) = LOWER($1) AND id != $2",
        [name, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Term "${name}" already exists`);
      }
    }

    const result = await pool.query(
      "UPDATE terms SET name = COALESCE($1, name), description = COALESCE($2, description), start_date = COALESCE($3, start_date), end_date = COALESCE($4, end_date), is_active = COALESCE($5, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
      [name, description, startDate, endDate, isActive, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    // Soft delete
    const result = await pool.query(
      "DELETE FROM terms WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== RULES & POLICIES ========================
class RulesModel {
  static async getAll() {
    const result = await pool.query("SELECT * FROM rules ORDER BY category, severity DESC, created_at DESC");
    return result.rows;
  }

  static async getByCategory(category) {
    const result = await pool.query(
      "SELECT * FROM rules WHERE category = $1 AND is_active = TRUE ORDER BY severity DESC",
      [category]
    );
    return result.rows;
  }

  static async create(title, description, category, severity, sanction, isActive, createdBy) {
    // Check for duplicates
    const existing = await pool.query(
      "SELECT id FROM rules WHERE LOWER(title) = LOWER($1) AND category = $2",
      [title, category]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Rule "${title}" already exists in category "${category}"`);
    }

    const result = await pool.query(
      "INSERT INTO rules (title, description, category, severity, sanction, is_active, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [title, description, category, severity, sanction, isActive || true, createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { title, description, category, severity, sanction, isActive }) {
    if (title && category) {
      const existing = await pool.query(
        "SELECT id FROM rules WHERE LOWER(title) = LOWER($1) AND category = $2 AND id != $3",
        [title, category, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Rule "${title}" already exists in category "${category}"`);
      }
    }

    const result = await pool.query(
      "UPDATE rules SET title = COALESCE($1, title), description = COALESCE($2, description), category = COALESCE($3, category), severity = COALESCE($4, severity), sanction = COALESCE($5, sanction), is_active = COALESCE($6, is_active), version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *",
      [title, description, category, severity, sanction, isActive, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      "UPDATE rules SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== EVENT TYPES ========================
class EventTypesModel {
  static async getAll() {
    const result = await pool.query("SELECT * FROM event_types ORDER BY name ASC");
    return result.rows;
  }

  static async create(name, description, status, createdBy) {
    // Check for duplicates
    const existing = await pool.query(
      "SELECT id FROM event_types WHERE LOWER(name) = LOWER($1)",
      [name]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Event type "${name}" already exists`);
    }

    const result = await pool.query(
      "INSERT INTO event_types (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, description, status || "Active", createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, status }) {
    if (name) {
      const existing = await pool.query(
        "SELECT id FROM event_types WHERE LOWER(name) = LOWER($1) AND id != $2",
        [name, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Event type "${name}" already exists`);
      }
    }

    const result = await pool.query(
      "UPDATE event_types SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
      [name, description, status, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      "UPDATE event_types SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== ATTENDANCE SETTINGS ========================
class AttendanceSettingsModel {
  static async get() {
    const result = await pool.query("SELECT * FROM attendance_settings LIMIT 1");
    return result.rows[0];
  }

  static async update(settings, updatedBy) {
    const result = await pool.query(
      "UPDATE attendance_settings SET am_start = $1, am_end = $2, pm_start = $3, pm_end = $4, grace_period_minutes = $5, undertime_threshold_minutes = $6, required_hours_per_day = $7, updated_at = CURRENT_TIMESTAMP, updated_by = $8 WHERE id = (SELECT id FROM attendance_settings LIMIT 1) RETURNING *",
      [
        settings.amStart,
        settings.amEnd,
        settings.pmStart,
        settings.pmEnd,
        settings.gracePeriodMinutes,
        settings.undertimeThresholdMinutes,
        settings.requiredHoursPerDay,
        updatedBy,
      ]
    );
    return result.rows[0];
  }
}

// ======================== INVENTORY CATEGORIES ========================
class InventoryCategoriesModel {
  static async getAll() {
    const result = await pool.query("SELECT * FROM inventory_categories ORDER BY name ASC");
    return result.rows;
  }

  static async create(name, description, status, createdBy) {
    // Check for duplicates
    const existing = await pool.query(
      "SELECT id FROM inventory_categories WHERE LOWER(name) = LOWER($1)",
      [name]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Inventory category "${name}" already exists`);
    }

    const result = await pool.query(
      "INSERT INTO inventory_categories (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, description, status || "Active", createdBy]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, status }) {
    if (name) {
      const existing = await pool.query(
        "SELECT id FROM inventory_categories WHERE LOWER(name) = LOWER($1) AND id != $2",
        [name, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Inventory category "${name}" already exists`);
      }
    }

    const result = await pool.query(
      "UPDATE inventory_categories SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
      [name, description, status, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      "UPDATE inventory_categories SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

// ======================== POSITION PERMISSIONS ========================
class PositionPermissionsModel {
  static async getByPosition(positionId) {
    const result = await pool.query(
      "SELECT * FROM position_permissions WHERE position_id = $1 ORDER BY permission_name",
      [positionId]
    );
    return result.rows;
  }

  static async addPermission(positionId, permissionName) {
    const result = await pool.query(
      "INSERT INTO position_permissions (position_id, permission_name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *",
      [positionId, permissionName]
    );
    return result.rows[0];
  }

  static async removePermission(positionId, permissionName) {
    const result = await pool.query(
      "DELETE FROM position_permissions WHERE position_id = $1 AND permission_name = $2 RETURNING *",
      [positionId, permissionName]
    );
    return result.rows[0];
  }
}

module.exports = {
  UnitsModel,
  PositionsModel,
  OrgStructureModel,
  TermsModel,
  RulesModel,
  EventTypesModel,
  AttendanceSettingsModel,
  InventoryCategoriesModel,
  PositionPermissionsModel,
};
