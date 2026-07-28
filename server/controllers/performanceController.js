const pool = require('../db');

// Backend base URL (set in .env). In production, ensure BASE_URL is the full https:// URL.
const isProd = process.env.NODE_ENV === 'production';
const BASE_URL = process.env.BASE_URL || (isProd ? '' : 'http://localhost:8000');

// Helper: convert relative or absolute path to full URL
function toFullUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) {
    return isProd ? filePath.replace(/^http:\/\//i, 'https://') : filePath;
  }
  if (BASE_URL) {
    const base = isProd ? BASE_URL.replace(/^http:\/\//i, 'https://') : BASE_URL;
    return base + filePath;
  }
  return filePath;
}

// GET /api/performances
async function getAllPerformances(req, res) {
  try {
    const q = 'SELECT * FROM performances ORDER BY start_time DESC';
    const { rows } = await pool.query(q);
    
    // Fetch items and borrowers for each performance
    const performancesWithDetails = await Promise.all(
      rows.map(async (perf) => {
        try {
          // ✅ UPDATED: Simplified query without subquery
          const itemsResult = await pool.query(
            `SELECT pi.*, ii.name, ii.category, ii.image_url
             FROM performance_items pi
             LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
             WHERE pi.performance_id = $1
             ORDER BY pi.created_at`,
            [perf.id]
          );

          // ✅ NEW: Fetch borrowers with full details including profile picture
          const borrowersResult = await pool.query(
            `SELECT pb.borrower_user_id, u.name, u.email, p.profile_pic_url
             FROM performance_borrowers pb
             LEFT JOIN users u ON pb.borrower_user_id = u.id
             LEFT JOIN user_profiles p ON u.id = p.user_id
             WHERE pb.performance_id = $1
             ORDER BY u.name`,
            [perf.id]
          );

          // ✅ UPDATED: Convert profile_pic_url to full URL
          const borrowersWithUrls = borrowersResult.rows.map(borrower => ({
            ...borrower,
            profile_pic_url: toFullUrl(borrower.profile_pic_url)
          }));

          return {
            ...perf,
            dancers: [],
            items: itemsResult.rows,
            performance_borrowers: borrowersWithUrls // ✅ NEW: Include full borrower details
          };
        } catch (itemErr) {
          console.error(`Error fetching items for performance ${perf.id}:`, itemErr.message);
          return {
            ...perf,
            dancers: [],
            items: [],
            performance_borrowers: []
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
      `SELECT pi.*, ii.name, ii.category, ii.image_url
       FROM performance_items pi
       LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
       WHERE pi.performance_id = $1
       ORDER BY pi.created_at`,
      [id]
    );

    // ✅ NEW: Fetch borrowers with full details including profile picture
    const borrowersResult = await pool.query(
      `SELECT pb.borrower_user_id, u.name, u.email, p.profile_pic_url
       FROM performance_borrowers pb
       LEFT JOIN users u ON pb.borrower_user_id = u.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE pb.performance_id = $1
       ORDER BY u.name`,
      [id]
    );

    // ✅ UPDATED: Convert profile_pic_url to full URL
    const borrowersWithUrls = borrowersResult.rows.map(borrower => ({
      ...borrower,
      profile_pic_url: toFullUrl(borrower.profile_pic_url)
    }));
    
    res.json({
      ...perf,
      dancers: [],
      items: itemsResult.rows,
      performance_borrowers: borrowersWithUrls // ✅ NEW: Include full borrower details
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
    const { title, description, location, start_time, end_time, selectedBorrowerIds, selectedItemIds } = req.body;
    const created_by = req.user?.id || null;
    
    await client.query('BEGIN');
    
    // Create performance
    const perfResult = await client.query(
      `INSERT INTO performances (title, description, location, start_time, end_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, description || null, location || null, start_time, end_time, created_by]
    );
    
    const performance = perfResult.rows[0];
    
    // ✅ FIXED: Add selected borrowers if provided (changed from selectedBorrowers to selectedBorrowerIds)
    if (selectedBorrowerIds && Array.isArray(selectedBorrowerIds)) {
      for (const borrowerId of selectedBorrowerIds) {
        await client.query(
          `INSERT INTO performance_borrowers (performance_id, borrower_user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [performance.id, borrowerId]
        );
      }
    }
    
    // ✅ FIXED: Add items with simple IDs (changed from items to selectedItemIds)
    if (selectedItemIds && Array.isArray(selectedItemIds)) {
      for (const itemId of selectedItemIds) {
        await client.query(
          `INSERT INTO performance_items (performance_id, inventory_item_id, size, quantity)
           VALUES ($1, $2, $3, $4)`,
          [performance.id, itemId, null, 1]
        );
      }
    }

    // Create recommendations for all selected borrowers
    // Each borrower gets recommendations for all items in the performance
    if (selectedBorrowerIds && Array.isArray(selectedBorrowerIds) && selectedItemIds && Array.isArray(selectedItemIds)) {
      for (const borrowerId of selectedBorrowerIds) {
        for (const itemId of selectedItemIds) {
          await client.query(
            `INSERT INTO performance_recommendations 
             (performance_id, borrower_id, inventory_item_id, size, quantity, is_viewed)
             VALUES ($1, $2, $3, $4, $5, FALSE)
             ON CONFLICT (performance_id, borrower_id, inventory_item_id, size) DO NOTHING`,
            [performance.id, borrowerId, itemId, null, 1]
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
    const { title, description, location, start_time, end_time, selectedBorrowerIds, selectedItemIds } = req.body;
    
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
    
    // ✅ FIXED: Delete and recreate borrowers (changed from selectedBorrowers to selectedBorrowerIds)
    await client.query('DELETE FROM performance_borrowers WHERE performance_id = $1', [id]);
    if (selectedBorrowerIds && Array.isArray(selectedBorrowerIds)) {
      for (const borrowerId of selectedBorrowerIds) {
        await client.query(
          `INSERT INTO performance_borrowers (performance_id, borrower_user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, borrowerId]
        );
      }
    }
    
    // ✅ FIXED: Delete and recreate items (changed from items to selectedItemIds)
    await client.query('DELETE FROM performance_items WHERE performance_id = $1', [id]);
    if (selectedItemIds && Array.isArray(selectedItemIds)) {
      for (const itemId of selectedItemIds) {
        await client.query(
          `INSERT INTO performance_items (performance_id, inventory_item_id, size, quantity)
           VALUES ($1, $2, $3, $4)`,
          [id, itemId, null, 1]
        );
      }
    }

    // Delete and recreate recommendations for updated performance
    await client.query('DELETE FROM performance_recommendations WHERE performance_id = $1', [id]);
    if (selectedBorrowerIds && Array.isArray(selectedBorrowerIds) && selectedItemIds && Array.isArray(selectedItemIds)) {
      for (const borrowerId of selectedBorrowerIds) {
        for (const itemId of selectedItemIds) {
          await client.query(
            `INSERT INTO performance_recommendations 
             (performance_id, borrower_id, inventory_item_id, size, quantity, is_viewed)
             VALUES ($1, $2, $3, $4, $5, FALSE)
             ON CONFLICT (performance_id, borrower_id, inventory_item_id, size) DO NOTHING`,
            [id, borrowerId, itemId, null, 1]
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
      `SELECT pi.*, ii.name, ii.category, ii.image_url
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
  
  // ✅ UPDATED: Fetch borrowers with full details (name, email, and profile picture)
  const borrowersResult = await client.query(
    `SELECT pb.borrower_user_id, u.name, u.email, p.profile_pic_url
     FROM performance_borrowers pb
     LEFT JOIN users u ON pb.borrower_user_id = u.id
     LEFT JOIN user_profiles p ON u.id = p.user_id
     WHERE pb.performance_id = $1
     ORDER BY u.name`,
    [performanceId]
  );
  
  // ✅ UPDATED: Simplified query for items
  const itemsResult = await client.query(
    `SELECT pi.*, ii.name, ii.category, ii.image_url
     FROM performance_items pi
     LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
     WHERE pi.performance_id = $1
     ORDER BY pi.created_at`,
    [performanceId]
  );
  
  // ✅ UPDATED: Convert profile_pic_url to full URL
  const borrowersWithUrls = borrowersResult.rows.map(borrower => ({
    ...borrower,
    profile_pic_url: toFullUrl(borrower.profile_pic_url)
  }));
  
  return {
    ...perf,
    performance_borrowers: borrowersWithUrls, // ✅ UPDATED: Return full borrower details instead of just IDs
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

// ✅ NEW: GET /api/performances/borrower/:borrowerId
// Get all performances assigned to a specific borrower
async function getBorrowerPerformances(req, res) {
  try {
    const { borrowerId } = req.params;

    // Get all performances where this borrower is assigned
    const performancesResult = await pool.query(
      `SELECT DISTINCT p.*
       FROM performances p
       JOIN performance_borrowers pb ON p.id = pb.performance_id
       WHERE pb.borrower_user_id = $1
       ORDER BY p.start_time DESC`,
      [borrowerId]
    );

    // Fetch items and borrowers for each performance
    const performancesWithDetails = await Promise.all(
      performancesResult.rows.map(async (perf) => {
        try {
          // Fetch items for this performance
          const itemsResult = await pool.query(
            `SELECT pi.*, ii.name, ii.category, ii.image_url
             FROM performance_items pi
             LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
             WHERE pi.performance_id = $1
             ORDER BY pi.created_at`,
            [perf.id]
          );

          // Fetch all borrowers for this performance
          const borrowersResult = await pool.query(
            `SELECT pb.borrower_user_id, u.name, u.email, p.profile_pic_url
             FROM performance_borrowers pb
             LEFT JOIN users u ON pb.borrower_user_id = u.id
             LEFT JOIN user_profiles p ON u.id = p.user_id
             WHERE pb.performance_id = $1
             ORDER BY u.name`,
            [perf.id]
          );

          // ✅ UPDATED: Convert profile_pic_url to full URL
          const borrowersWithUrls = borrowersResult.rows.map(borrower => ({
            ...borrower,
            profile_pic_url: toFullUrl(borrower.profile_pic_url)
          }));

          return {
            ...perf,
            dancers: [],
            items: itemsResult.rows,
            performance_borrowers: borrowersWithUrls
          };
        } catch (itemErr) {
          console.error(`Error fetching details for performance ${perf.id}:`, itemErr.message);
          return {
            ...perf,
            dancers: [],
            items: [],
            performance_borrowers: []
          };
        }
      })
    );

    res.json(performancesWithDetails);
  } catch (err) {
    console.error('getBorrowerPerformances error:', err.message);
    res.status(500).json({ error: 'Failed to fetch borrower performances' });
  }
}

// ✅ NEW: GET /api/performances/borrower/:borrowerId/all
// Get ALL performances with a flag indicating if borrower is assigned
async function getAllPerformancesForBorrower(req, res) {
  try {
    const { borrowerId } = req.params;

    // Get ALL performances
    const performancesResult = await pool.query(
      `SELECT p.* FROM performances p ORDER BY p.start_time DESC`
    );

    // Get list of performance IDs where borrower is assigned
    const assignedResult = await pool.query(
      `SELECT DISTINCT pb.performance_id 
       FROM performance_borrowers pb 
       WHERE pb.borrower_user_id = $1`,
      [borrowerId]
    );
    const assignedPerformanceIds = new Set(assignedResult.rows.map(r => r.performance_id));

    // Fetch items and borrowers for each performance + mark as assigned
    const performancesWithDetails = await Promise.all(
      performancesResult.rows.map(async (perf) => {
        try {
          // Fetch items for this performance
          const itemsResult = await pool.query(
            `SELECT pi.*, ii.name, ii.category, ii.image_url
             FROM performance_items pi
             LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
             WHERE pi.performance_id = $1
             ORDER BY pi.created_at`,
            [perf.id]
          );

          // Fetch all borrowers for this performance
          const borrowersResult = await pool.query(
            `SELECT pb.borrower_user_id, u.name, u.email, p.profile_pic_url
             FROM performance_borrowers pb
             LEFT JOIN users u ON pb.borrower_user_id = u.id
             LEFT JOIN user_profiles p ON u.id = p.user_id
             WHERE pb.performance_id = $1
             ORDER BY u.name`,
            [perf.id]
          );

          // ✅ UPDATED: Convert profile_pic_url to full URL
          const borrowersWithUrls = borrowersResult.rows.map(borrower => ({
            ...borrower,
            profile_pic_url: toFullUrl(borrower.profile_pic_url)
          }));

          return {
            ...perf,
            dancers: [],
            items: itemsResult.rows,
            performance_borrowers: borrowersWithUrls,
            isAssigned: assignedPerformanceIds.has(perf.id) // ✅ Flag for borrower assignment
          };
        } catch (itemErr) {
          console.error(`Error fetching details for performance ${perf.id}:`, itemErr.message);
          return {
            ...perf,
            dancers: [],
            items: [],
            performance_borrowers: [],
            isAssigned: assignedPerformanceIds.has(perf.id)
          };
        }
      })
    );

    // Sort: assigned first, then by start_time
    const sorted = performancesWithDetails.sort((a, b) => {
      if (a.isAssigned !== b.isAssigned) {
        return a.isAssigned ? -1 : 1; // Assigned first
      }
      return new Date(a.start_time) - new Date(b.start_time);
    });

    res.json(sorted);
  } catch (err) {
    console.error('getAllPerformancesForBorrower error:', err.message);
    res.status(500).json({ error: 'Failed to fetch performances' });
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
  getBorrowerPerformances,
  getAllPerformancesForBorrower,
};
