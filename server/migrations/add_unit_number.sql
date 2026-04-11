-- ============================================================================
-- UNIT NAMING SYSTEM MIGRATION
-- Add unit_number column to inventory_units table for tracking unit names
-- ============================================================================

-- 1. Add unit_number column to track unit names (e.g., "Suyam S - 1")
ALTER TABLE inventory_units
ADD COLUMN IF NOT EXISTS unit_number VARCHAR(255);

-- 2. Create index for faster unit number searches
CREATE INDEX IF NOT EXISTS idx_inventory_units_unit_number 
ON inventory_units(unit_number);

-- 3. Create index for combined searches (item + unit_number)
CREATE INDEX IF NOT EXISTS idx_inventory_units_item_unit
ON inventory_units(inventory_item_id, unit_number);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check that column was added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'inventory_units' 
-- AND column_name = 'unit_number';

-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'inventory_units';

-- Sample query to get units with names:
-- SELECT id, inventory_item_id, unit_number, size, qr_code_url 
-- FROM inventory_units 
-- WHERE unit_number IS NOT NULL 
-- LIMIT 10;
