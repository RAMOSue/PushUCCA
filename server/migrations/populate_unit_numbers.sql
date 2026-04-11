-- Migration: Populate unit_number for existing inventory units
-- Generates labels like "ItemName-S-1", "ItemName-M-2", etc. based on unit order

-- Create a CTE that assigns row numbers for each (item, size) combination
WITH unit_numbers_to_assign AS (
  SELECT 
    u.id,
    i.name AS item_name,
    u.size,
    ROW_NUMBER() OVER (
      PARTITION BY u.inventory_item_id, u.size 
      ORDER BY u.created_at ASC, u.id ASC
    ) AS position_num,
    CASE 
      WHEN LOWER(u.size) = 'small' THEN 'S'
      WHEN LOWER(u.size) = 'medium' THEN 'M'
      WHEN LOWER(u.size) = 'large' THEN 'L'
      ELSE ''
    END AS size_abbrev
  FROM inventory_units u
  LEFT JOIN inventory_items i ON u.inventory_item_id = i.uuid
  WHERE u.unit_number IS NULL OR u.unit_number = ''
)
UPDATE inventory_units
SET unit_number = CASE
  WHEN uta.size_abbrev != '' THEN 
    CONCAT(uta.item_name, '-', uta.size_abbrev, '-', uta.position_num)
  ELSE 
    CONCAT(uta.item_name, '-', uta.position_num)
END
FROM unit_numbers_to_assign uta
WHERE inventory_units.id = uta.id;
