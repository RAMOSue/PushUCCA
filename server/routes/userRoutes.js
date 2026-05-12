// userRoutes.js
const express = require('express');
const { ensureAuth } = require('../helpers/auth'); // JWT middleware
const router = express.Router();

const {
  getActivityLogs,
  getLoginHistory,
  downloadActivityLogsCSV,
} = require('../controllers/authController');

// ========== ACTIVITY & LOGS ==========
router.get('/activity-logs', ensureAuth, getActivityLogs);
router.get('/login-history', ensureAuth, getLoginHistory);
router.get('/activity-logs/download', ensureAuth, downloadActivityLogsCSV);

module.exports = router;
