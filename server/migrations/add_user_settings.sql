-- Database Migration: User Settings System
-- File: server/migrations/add_user_settings.sql
-- Purpose: Add comprehensive user settings support for themes, notifications, preferences, etc.

-- Step 1: Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Appearance Settings
  theme VARCHAR(20) DEFAULT 'system', -- 'light', 'dark', 'system'
  dark_mode BOOLEAN DEFAULT FALSE,
  accent_color VARCHAR(50) DEFAULT 'indigo', -- 'indigo', 'blue', 'purple', 'green'
  compact_mode BOOLEAN DEFAULT FALSE,
  animation_level VARCHAR(20) DEFAULT 'standard', -- 'smooth', 'standard', 'minimal'
  
  -- Notification Settings
  notifications_enabled BOOLEAN DEFAULT TRUE,
  request_alerts BOOLEAN DEFAULT TRUE,
  conflict_alerts BOOLEAN DEFAULT TRUE,
  reminder_frequency VARCHAR(20) DEFAULT 'daily', -- 'realtime', 'hourly', 'daily', 'weekly'
  
  -- Security Settings
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  
  -- System Preferences
  date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY', -- 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
  auto_approval_enabled BOOLEAN DEFAULT FALSE,
  duplicate_protection BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Step 3: Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_user_settings_timestamp();

-- Step 4: Populate settings for existing users (if needed)
INSERT INTO user_settings (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;

-- Done!
-- Run this file with: psql -U postgres -d ucca -f server/migrations/add_user_settings.sql
