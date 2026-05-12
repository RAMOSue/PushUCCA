// server/testing/metricsAPI.js
// Testing System Metrics API
const express = require("express");
const router = express.Router();
const pool = require("../db");
const requireRole = require("../middleware/requireRole");

/**
 * ✅ GET /api/metrics
 * Fetch comprehensive testing system metrics
 */
router.get("/metrics", async (req, res) => {
  try {
    // Get borrowing statistics from borrowing_requests table
    const borrowStats = await pool.query(`
      SELECT 
        COUNT(*) as total_borrows,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_borrows,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_borrows,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned_borrows,
        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_borrows
      FROM borrowing_requests
    `);

    // Get user statistics
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'borrower' THEN 1 ELSE 0 END) as borrowers,
        SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
      FROM users
    `);

    // Get inventory statistics
    const inventoryStats = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity
      FROM inventory_items
    `);

    // Get active borrows (currently borrowed - status approved, not returned)
    const activeBorrows = await pool.query(`
      SELECT COUNT(*) as active_count
      FROM borrowing_requests
      WHERE status = 'approved' OR status = 'pending_return'
    `);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      borrowing: borrowStats.rows[0] || {},
      users: userStats.rows[0] || {},
      inventory: inventoryStats.rows[0] || {},
      activeBorrows: activeBorrows.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Metrics API Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch metrics",
      message: error.message 
    });
  }
});

/**
 * ✅ GET /api/metrics/performance
 * Fetch performance metrics for testing
 */
router.get("/metrics/performance", async (req, res) => {
  try {
    // Get average borrow processing time
    const processingTime = await pool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) as avg_processing_seconds
      FROM borrowing_requests
      WHERE status IN ('approved', 'returned', 'pending_return') AND approved_at IS NOT NULL
    `);

    // Get return rate
    const returnRate = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'returned' THEN 1 END)::float / 
        NULLIF(COUNT(*), 0) * 100 as return_rate_percentage
      FROM borrowing_requests
      WHERE status IN ('returned', 'approved', 'pending_return')
    `);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      avgProcessingTime: processingTime.rows[0]?.avg_processing_seconds || 0,
      returnRatePercentage: returnRate.rows[0]?.return_rate_percentage || 0,
    });
  } catch (error) {
    console.error("❌ Performance Metrics API Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch performance metrics",
      message: error.message 
    });
  }
});

/**
 * ✅ GET /api/metrics/user/:userId
 * Fetch user-specific metrics
 */
router.get("/metrics/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const userMetrics = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(br.id) as total_borrows,
        SUM(CASE WHEN br.status = 'returned' THEN 1 ELSE 0 END) as returned_count,
        SUM(CASE WHEN br.status = 'approved' OR br.status = 'pending_return' THEN 1 ELSE 0 END) as currently_borrowed
      FROM users u
      LEFT JOIN borrowing_requests br ON u.id = br.borrower_id
      WHERE u.id = $1
      GROUP BY u.id, u.name, u.email, u.role
    `, [userId]);

    if (userMetrics.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      user: userMetrics.rows[0],
    });
  } catch (error) {
    console.error("❌ User Metrics API Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch user metrics",
      message: error.message 
    });
  }
});

/**
 * ✅ GET /api/metrics/health
 * System health check
 */
router.get("/metrics/health", async (req, res) => {
  try {
    const dbCheck = await pool.query("SELECT 1");
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

module.exports = router;
