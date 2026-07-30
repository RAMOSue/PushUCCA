const express = require('express');
const router = express.Router();
const announcements = require('../controllers/announcementsController');
const requireRole = require('../middleware/requireRole');

// Public: list and get
router.get('/', announcements.listAnnouncements);
router.get('/:id', announcements.getAnnouncement);

// Protected: create, update, delete (Staff and Admin)
router.post('/', requireRole(['Staff','Admin']), announcements.createAnnouncement);
router.put('/:id', requireRole(['Staff','Admin']), announcements.updateAnnouncement);
router.delete('/:id', requireRole(['Staff','Admin']), announcements.deleteAnnouncement);

module.exports = router;
