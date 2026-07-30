-- create_announcements_table.sql
-- Adds announcements table used by admin UI and public API

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  image_url VARCHAR(1024),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'Normal',
  pinned BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_announcements_is_published ON announcements(is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_division_id ON announcements(division_id);
