-- ============================================================================
-- Add Division Reference to Users Table
-- Links users to organizational divisions (Dulimbay, Budjong, Kayam, Admin, Students)
-- ============================================================================

-- Step 1: Add division_id column to users table (references divisions.id)
ALTER TABLE users ADD COLUMN IF NOT EXISTS division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL;

-- Step 2: Create index on division_id for faster queries
CREATE INDEX IF NOT EXISTS idx_users_division_id ON users(division_id);

-- Step 3: Create index on (division_id, role) for filtering by department and role
CREATE INDEX IF NOT EXISTS idx_users_division_role ON users(division_id, role);

-- ============================================================================
-- Examples of division IDs (from divisions table):
-- id=1: Dulimbay
-- id=2: Budjong
-- id=3: Kayam
-- id=4: Admin
-- id=5: Students
-- ============================================================================

