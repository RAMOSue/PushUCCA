const express = require('express');
const router = express.Router();
const announcements = require('../controllers/announcementsController');
const requireRole = require('../middleware/requireRole');

// Public: list and get
router.get('/', announcements.listAnnouncements);
router.get('/:id', announcements.getAnnouncement);

// Protected: create, update, delete (Staff only)
router.post('/', requireRole('staff'), announcements.createAnnouncement);
router.put('/:id', requireRole('staff'), announcements.updateAnnouncement);
router.delete('/:id', requireRole('staff'), announcements.deleteAnnouncement);

module.exports = router;
