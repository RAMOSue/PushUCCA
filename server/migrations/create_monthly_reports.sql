-- Create monthly_reports table for storing generated monthly summary reports
-- Used by AdminReports.jsx for reporting and analytics

CREATE TABLE IF NOT EXISTS monthly_reports (
  id SERIAL PRIMARY KEY,
  month VARCHAR(7) NOT NULL UNIQUE,  -- Format: YYYY-MM (e.g., 2026-04)
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- User who generated the report
  total_borrowed INTEGER DEFAULT 0,  -- Total items borrowed in the month
  overdue_count INTEGER DEFAULT 0,   -- Number of overdue items
  inventory_changes JSONB DEFAULT '[]'::jsonb,  -- JSON array of inventory changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster monthly queries
CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(month);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_created_at ON monthly_reports(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_monthly_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monthly_reports_timestamp ON monthly_reports;
CREATE TRIGGER monthly_reports_timestamp
BEFORE UPDATE ON monthly_reports
FOR EACH ROW
EXECUTE FUNCTION update_monthly_reports_timestamp();
