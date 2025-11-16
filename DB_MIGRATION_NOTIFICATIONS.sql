-- ============================================================================
-- DATABASE MIGRATION FOR NOTIFICATION SYSTEM
-- Run this in psql: psql -U postgres -d ucca -f DB_MIGRATION_NOTIFICATIONS.sql
-- ============================================================================

-- 1. Ensure push_subscriptions table exists with proper constraints
-- NOTE: endpoint UNIQUE prevents duplicate subscriptions;
-- ON DELETE CASCADE ensures subscriptions are removed when user is deleted
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index on user_id for faster lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
  ON push_subscriptions(user_id);

-- Add index on endpoint for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
  ON push_subscriptions(endpoint);

-- ============================================================================
-- 2. Update notifications table to support delivery tracking
-- ============================================================================

-- Add missing columns to notifications table (if they don't exist)
-- is_delivered: whether push notification was successfully sent
-- delivered_at: timestamp when notification was marked delivered
-- is_read: whether user has read/acknowledged the notification (already may exist)
ALTER TABLE IF EXISTS notifications
  ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Add index on user_id and is_delivered for faster pending queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_delivered 
  ON notifications(user_id, is_delivered);

-- Add index for fetching pending notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON notifications(created_at DESC);

-- ============================================================================
-- 3. OPTIONAL: Verify table structure (can run separately to inspect)
-- ============================================================================

-- View the final schema:
-- \d push_subscriptions;
-- \d notifications;

-- Count current subscriptions:
-- SELECT user_id, COUNT(*) as subscription_count FROM push_subscriptions GROUP BY user_id;

-- View pending notifications (not delivered):
-- SELECT id, user_id, message, is_delivered, created_at FROM notifications WHERE is_delivered = false ORDER BY created_at DESC;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
