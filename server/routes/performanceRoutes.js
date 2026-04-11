const express = require('express');
const router = express.Router();
const perf = require('../controllers/performanceController');
const requireRole = require('../middleware/requireRole');

// Recommendations for borrowers - must come BEFORE /:id routes
router.get('/recommendations/:borrowerId', perf.getBorrowerRecommendations);
router.post('/recommendations/:recommendationId/viewed', perf.markRecommendationViewed);

// Public: list and view
router.get('/', perf.getAllPerformances);
router.get('/:id', perf.getPerformanceById);

// Staff-only: create, update, delete
router.post('/', requireRole('staff'), perf.createPerformance);
router.put('/:id', requireRole('staff'), perf.updatePerformance);
router.delete('/:id', requireRole('staff'), perf.deletePerformance);

// Dancers management
router.get('/:id/dancers', perf.getPerformanceDancers);
router.post('/:id/dancers', requireRole('staff'), perf.addPerformanceDancer);
router.delete('/:id/dancers/:dancerId', requireRole('staff'), perf.removePerformanceDancer);

// Items management
router.get('/:id/items', perf.getPerformanceItems);
router.post('/:id/items', requireRole('staff'), perf.addPerformanceItem);
router.delete('/:id/items/:itemId', requireRole('staff'), perf.removePerformanceItem);

module.exports = router;
