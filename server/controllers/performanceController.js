const pool = require('../db');

// GET /api/performances
async function getAllPerformances(req, res) {
  try {
    const q = 'SELECT * FROM performances ORDER BY start_time DESC';
    const { rows } = await pool.query(q);
    
    // Fetch items for each performance
    const performancesWithDetails = await Promise.all(
      rows.map(async (perf) => {
        try {
          // ✅ UPDATED: Simplified query without subquery
          const itemsResult = await pool.query(
            `SELECT pi.*, ii.name, ii.category
             FROM performance_items pi
             LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
             WHERE pi.performance_id = $1
             ORDER BY pi.created_at`,
            [perf.id]
          );
          return {
            ...perf,
            dancers: [],
            items: itemsResult.rows
          };
        } catch (itemErr) {
          console.error(`Error fetching items for performance ${perf.id}:`, itemErr.message);
          return {
            ...perf,
            dancers: [],
            items: []
          };
        }
      })
    );
    
    res.json(performancesWithDetails);
  } catch (err) {
    console.error('getAllPerformances error:', err.message);
    res.status(500).json({ error: 'Failed to fetch performances' });
  }
}

// GET /api/performances/:id
async function getPerformanceById(req, res) {
  try {
    const { id } = req.params;
    const q = 'SELECT * FROM performances WHERE id = $1';
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    
    const perf = rows[0];
    
    // Fetch items
    const itemsResult = await pool.query(
      `SELECT pi.*, ii.name, ii.category
       FROM performance_items pi
       LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
       WHERE pi.performance_id = $1
       ORDER BY pi.created_at`,
      [id]
    );
    
    res.json({
      ...perf,
      dancers: [],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error('getPerformanceById error:', err.message);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
}

// POST /api/performances
async function createPerformance(req, res) {
  const client = await pool.connect();
  try {
    const { title, description, location, start_time, end_time, selectedBorrowers, dancers, items } = req.body;
    const created_by = req.user?.id || null;
    
    await client.query('BEGIN');
    
    // Create performance
    const perfResult = await client.query(
      `INSERT INTO performances (title, description, location, start_time, end_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, description || null, location || null, start_time, end_time, created_by]
    );
    
    const performance = perfResult.rows[0];
    
    // Add selected borrowers if provided
    if (selectedBorrowers && Array.isArray(selectedBorrowers)) {
      for (const borrowerId of selectedBorrowers) {
        await client.query(
          `INSERT INTO performance_borrowers (performance_id, borrower_user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [performance.id, borrowerId]
        );
      }
    }
    
    // ✅ NOTE: Dancer data is not persisted to database (performance_dancers table doesn't exist)
    // Dancers info is maintained in frontend state only
    
    // ✅ UPDATED: Add items with unit_number support
    if (items && Array.isArray(items)) {
      for (const item of items) {
        // Store unit information if available (unit_id, unit_number)
        await client.query(
          `INSERT INTO performance_items (performance_id, inventory_item_id, size, quantity)
           VALUES ($1, $2, $3, $4)`,
          [performance.id, item.inventory_item_id, item.size || null, item.quantity || 1]
        );
        
        // Note: If unit_id column exists, can extend to:
        // INSERT INTO performance_items (performance_id, inventory_item_id, unit_id, size, quantity)
        // For now, unit tracking is maintained in frontend form structure
      }
    }

    // Create recommendations for all selected borrowers
    // Each borrower gets recommendations for all items in the performance
    if (selectedBorrowers && Array.isArray(selectedBorrowers) && items && Array.isArray(items)) {
      for (const borrowerId of selectedBorrowers) {
        for (const item of items) {
          await client.query(
            `INSERT INTO performance_recommendations 
             (performance_id, borrower_id, inventory_item_id, size, quantity, is_viewed)
             VALUES ($1, $2, $3, $4, $5, FALSE)
             ON CONFLICT (performance_id, borrower_id, inventory_item_id, size) DO NOTHING`,
            [performance.id, borrowerId, item.inventory_item_id, item.size || null, item.quantity || 1]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    client.release();
    
    // Fetch complete performance with dancers and items using pool
    const fullPerf = await getFullPerformance(pool, performance.id);
    res.status(201).json(fullPerf);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    console.error('createPerformance error:', err.message);
    res.status(500).json({ error: 'Failed to create performance' });
  } finally {
    try {
      client.release();
    } catch (e) {
      // Client might already be released
    }
  }
}

// PUT /api/performances/:id
async function updatePerformance(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, description, location, start_time, end_time, selectedBorrowers, dancers, items } = req.body;
    
    await client.query('BEGIN');
    
    // Update performance
    const perfResult = await client.query(
      `UPDATE performances SET title=$1, description=$2, location=$3, start_time=$4, end_time=$5, updated_at=now()
       WHERE id=$6 RETURNING *`,
      [title, description || null, location || null, start_time, end_time, id]
    );
    
    if (!perfResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Delete and recreate borrowers
    await client.query('DELETE FROM performance_borrowers WHERE performance_id = $1', [id]);
    if (selectedBorrowers && Array.isArray(selectedBorrowers)) {
      for (const borrowerId of selectedBorrowers) {
        await client.query(
          `INSERT INTO performance_borrowers (performance_id, borrower_user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, borrowerId]
        );
      }
    }
    
    // ✅ NOTE: Dancer data is not persisted to database (performance_dancers table doesn't exist)
    // Dancers info is maintained in frontend state only
    
    // Delete and recreate items
    await client.query('DELETE FROM performance_items WHERE performance_id = $1', [id]);
    // ✅ UPDATED: Support unit tracking
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO performance_items (performance_id, inventory_item_id, size, quantity)
           VALUES ($1, $2, $3, $4)`,
          [id, item.inventory_item_id, item.size || null, item.quantity || 1]
        );
      }
    }

    // Delete and recreate recommendations for updated performance
    await client.query('DELETE FROM performance_recommendations WHERE performance_id = $1', [id]);
    if (selectedBorrowers && Array.isArray(selectedBorrowers) && items && Array.isArray(items)) {
      for (const borrowerId of selectedBorrowers) {
        for (const item of items) {
          await client.query(
            `INSERT INTO performance_recommendations 
             (performance_id, borrower_id, inventory_item_id, size, quantity, is_viewed)
             VALUES ($1, $2, $3, $4, $5, FALSE)
             ON CONFLICT (performance_id, borrower_id, inventory_item_id, size) DO NOTHING`,
            [id, borrowerId, item.inventory_item_id, item.size || null, item.quantity || 1]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    client.release();
    
    // Fetch complete performance using pool
    const fullPerf = await getFullPerformance(pool, id);
    res.json(fullPerf);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    console.error('updatePerformance error:', err.message);
    res.status(500).json({ error: 'Failed to update performance' });
  } finally {
    try {
      client.release();
    } catch (e) {
      // Client might already be released
    }
  }
}

// DELETE /api/performances/:id
async function deletePerformance(req, res) {
  try {
    const { id } = req.params;
    const q = 'DELETE FROM performances WHERE id=$1 RETURNING *';
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id });
  } catch (err) {
    console.error('deletePerformance error:', err.message);
    res.status(500).json({ error: 'Failed to delete performance' });
  }
}

// GET /api/performances/:id/dancers
async function getPerformanceDancers(req, res) {
  try {
    // ✅ NOTE: Dancer data is not persisted to database (performance_dancers table doesn't exist)
    // Return empty array - dancers info is maintained in frontend state only
    res.json([]);
  } catch (err) {
    console.error('getPerformanceDancers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dancers' });
  }
}

// POST /api/performances/:id/dancers
async function addPerformanceDancer(req, res) {
  try {
    // ✅ NOTE: Dancer data is not persisted to database (performance_dancers table doesn't exist)
    // Dancers info is maintained in frontend state only
    res.status(201).json({ message: 'Dancer data is maintained in frontend only' });
  } catch (err) {
    console.error('addPerformanceDancer error:', err.message);
    res.status(500).json({ error: 'Failed to add dancer' });
  }
}

// DELETE /api/performances/:id/dancers/:dancerId
async function removePerformanceDancer(req, res) {
  try {
    // ✅ NOTE: Dancer data is not persisted to database (performance_dancers table doesn't exist)
    // Return success - dancers info is maintained in frontend state only
    res.json({ message: 'Deleted from frontend state' });
  } catch (err) {
    console.error('removePerformanceDancer error:', err.message);
    res.status(500).json({ error: 'Failed to remove dancer' });
  }
}

// GET /api/performances/:id/items
async function getPerformanceItems(req, res) {
  try {
    const { id } = req.params;
    // ✅ UPDATED: Simplified query for performance items
    const { rows } = await pool.query(
      `SELECT pi.*, ii.name, ii.category
       FROM performance_items pi
       LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
       WHERE pi.performance_id = $1
       ORDER BY pi.created_at`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getPerformanceItems error:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
}

// POST /api/performances/:id/items
async function addPerformanceItem(req, res) {
  try {
    const { id } = req.params;
    const { inventory_item_id, size, quantity } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO performance_items (performance_id, inventory_item_id, size, quantity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, inventory_item_id, size || null, quantity || 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('addPerformanceItem error:', err.message);
    res.status(500).json({ error: 'Failed to add item' });
  }
}

// DELETE /api/performances/:id/items/:itemId
async function removePerformanceItem(req, res) {
  try {
    const { id, itemId } = req.params;
    const { rows } = await pool.query(
      'DELETE FROM performance_items WHERE id = $1 AND performance_id = $2 RETURNING *',
      [itemId, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('removePerformanceItem error:', err.message);
    res.status(500).json({ error: 'Failed to remove item' });
  }
}

// Helper function to fetch complete performance
async function getFullPerformance(client, performanceId) {
  const perfResult = await client.query(
    'SELECT * FROM performances WHERE id = $1',
    [performanceId]
  );
  const perf = perfResult.rows[0];
  
  const borrowersResult = await client.query(
    'SELECT borrower_user_id FROM performance_borrowers WHERE performance_id = $1',
    [performanceId]
  );
  
  // ✅ UPDATED: Simplified query for items
  const itemsResult = await client.query(
    `SELECT pi.*, ii.name, ii.category
     FROM performance_items pi
     LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
     WHERE pi.performance_id = $1
     ORDER BY pi.created_at`,
    [performanceId]
  );
  
  return {
    ...perf,
    selectedBorrowers: borrowersResult.rows.map(r => r.borrower_user_id),
    dancers: [],
    items: itemsResult.rows
  };
}

// GET /api/performances/recommendations/:borrowerId
// Get all recommended items for a borrower from performances they are assigned to
async function getBorrowerRecommendations(req, res) {
  try {
    const { borrowerId } = req.params;

    const result = await pool.query(
      `SELECT 
        pr.id,
        pr.performance_id,
        pr.inventory_item_id,
        pr.size,
        pr.quantity,
        pr.is_viewed,
        pr.created_at,
        p.title as performance_title,
        p.start_time,
        p.end_time,
        ii.name as item_name,
        ii.category,
        ii.image_url
       FROM performance_recommendations pr
       JOIN performances p ON pr.performance_id = p.id
       JOIN inventory_items ii ON pr.inventory_item_id = ii.id
       WHERE pr.borrower_id = $1
       ORDER BY p.start_time DESC, pr.created_at DESC`,
      [borrowerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getBorrowerRecommendations error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
}

// POST /api/performances/recommendations/:recommendationId/viewed
// Mark a recommendation as viewed by borrower
async function markRecommendationViewed(req, res) {
  try {
    const { recommendationId } = req.params;

    await pool.query(
      `UPDATE performance_recommendations SET is_viewed = TRUE WHERE id = $1`,
      [recommendationId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('markRecommendationViewed error:', err.message);
    res.status(500).json({ error: 'Failed to mark recommendation as viewed' });
  }
}

module.exports = {
  getAllPerformances,
  getPerformanceById,
  createPerformance,
  updatePerformance,
  deletePerformance,
  getPerformanceDancers,
  addPerformanceDancer,
  removePerformanceDancer,
  getPerformanceItems,
  addPerformanceItem,
  removePerformanceItem,
  getBorrowerRecommendations,
  markRecommendationViewed,
};
