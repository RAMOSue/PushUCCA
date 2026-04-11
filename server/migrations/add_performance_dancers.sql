-- Create performance_dancers table if it doesn't exist
CREATE TABLE IF NOT EXISTS performance_dancers (
  id SERIAL PRIMARY KEY,
  performance_id INTEGER NOT NULL REFERENCES performances(id) ON DELETE CASCADE,
  dance_type VARCHAR(50) NOT NULL DEFAULT 'all', -- 'male', 'female', or 'all'
  num_dancers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on performance_id for faster queries
CREATE INDEX IF NOT EXISTS idx_performance_dancers_performance_id 
ON performance_dancers(performance_id);
