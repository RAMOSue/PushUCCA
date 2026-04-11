-- Migration: Add soft delete columns to borrowing_requests table
-- Purpose: Allow deletion of borrow history entries while maintaining audit trail

ALTER TABLE borrowing_requests 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Create index on is_deleted for faster queries
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_is_deleted 
ON borrowing_requests(is_deleted);

-- Create index for combined queries (borrower + deletion status)
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_borrower_deleted 
ON borrowing_requests(borrower_id, is_deleted, created_at DESC);

COMMIT;
