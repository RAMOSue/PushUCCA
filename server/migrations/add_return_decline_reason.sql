-- Add column to store return decline reason and warning message
ALTER TABLE borrowing_requests
ADD COLUMN IF NOT EXISTS return_decline_reason VARCHAR(255);

-- Add a timestamp for when the decline happened
ALTER TABLE borrowing_requests
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP;
