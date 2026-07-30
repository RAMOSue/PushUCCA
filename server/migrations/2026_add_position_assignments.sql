-- Migration: add position_assignments table
CREATE TABLE IF NOT EXISTS position_assignments (
    id SERIAL PRIMARY KEY,
    org_structure_id INTEGER REFERENCES organizational_structures(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_structure_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_assign_org_structure_id ON position_assignments(org_structure_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_user_id ON position_assignments(user_id);
