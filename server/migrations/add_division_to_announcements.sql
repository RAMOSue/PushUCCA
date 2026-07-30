-- add_division_to_announcements.sql
-- Adds division support to announcements and enables filtering by division.

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_division_id ON announcements(division_id);
