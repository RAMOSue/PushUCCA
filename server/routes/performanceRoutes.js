const express = require('express');
const router = express.Router();
const perf = require('../controllers/performanceController');
const requireRole = require('../middleware/requireRole');

// Public: list and view
router.get('/', perf.getAllPerformances);
router.get('/:id', perf.getPerformanceById);

// Staff-only: create, update, delete
router.post('/', requireRole('staff'), perf.createPerformance);
router.put('/:id', requireRole('staff'), perf.updatePerformance);
router.delete('/:id', requireRole('staff'), perf.deletePerformance);

module.exports = router;
