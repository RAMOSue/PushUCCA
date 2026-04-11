-- Create performance_recommendations table to track items needed for performances
-- This links performance items to borrowers who participate in those performances
-- allowing borrowers to see recommended items to borrow

CREATE TABLE IF NOT EXISTS performance_recommendations (
  id SERIAL PRIMARY KEY,
  performance_id INTEGER NOT NULL REFERENCES performances(id) ON DELETE CASCADE,
  borrower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  size VARCHAR(50), -- e.g., 'small', 'medium', 'large'
  quantity INTEGER NOT NULL DEFAULT 1,
  is_viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(performance_id, borrower_id, inventory_item_id, size)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_performance_recommendations_borrower_id 
ON performance_recommendations(borrower_id);

CREATE INDEX IF NOT EXISTS idx_performance_recommendations_performance_id 
ON performance_recommendations(performance_id);

CREATE INDEX IF NOT EXISTS idx_performance_recommendations_inventory_item_id 
ON performance_recommendations(inventory_item_id);
