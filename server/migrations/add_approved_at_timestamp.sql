-- Add approved_at column to track when requests are approved
-- This allows us to display a complete timeline of status progression

ALTER TABLE borrowing_requests
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP DEFAULT NULL;

-- Create an index for efficient queries filtering by approved_at
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_approved_at ON borrowing_requests(approved_at);
