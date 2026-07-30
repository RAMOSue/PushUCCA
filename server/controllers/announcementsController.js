const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db');
const announcementModel = require('../models/announcementModel');
const isProd = process.env.NODE_ENV === 'production';
const SERVER_URL = process.env.SERVER_URL || (isProd ? '' : 'http://localhost:8000');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'announcements');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg','image/png','image/jpg'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG/PNG images allowed'), false);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

function toFullUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  if (SERVER_URL) return SERVER_URL + filePath;
  return filePath;
}

exports.listAnnouncements = async (req, res) => {
  try {
    const onlyPublished = req.query.published === 'true' || req.query.published === undefined;
    const divisionId = req.query.division_id ? parseInt(req.query.division_id, 10) : null;
    const divisionName = req.query.division || null;
    const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
    const offset = parseInt(req.query.offset || '0', 10);
    const rows = await announcementModel.getAllAnnouncements({ onlyPublished, limit, offset, divisionId, divisionName });
    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      image_url: r.image_url ? toFullUrl(r.image_url) : null,
      author: { id: r.author_id, name: r.author_name, profile_pic_url: r.profile_pic_url ? toFullUrl(r.profile_pic_url) : null },
      division_id: r.division_id,
      division_name: r.division_name,
      priority: r.priority,
      pinned: r.pinned,
      is_published: r.is_published,
      published_at: r.published_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    res.json(data);
  } catch (err) {
    console.error('listAnnouncements error:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

exports.getAnnouncement = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const a = await announcementModel.getAnnouncementById(id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    a.image_url = a.image_url ? toFullUrl(a.image_url) : null;
    a.author = { id: a.author_id, name: a.author_name, profile_pic_url: a.profile_pic_url ? toFullUrl(a.profile_pic_url) : null };
    res.json(a);
  } catch (err) {
    console.error('getAnnouncement error:', err);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
};

exports.createAnnouncement = [
  upload.single('image'),
  async (req, res) => {
    try {
      const { title, content, is_published, published_at, priority, pinned } = req.body;
      const division_id = req.body.division_id ? parseInt(req.body.division_id, 10) : null;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      const image_url = req.file ? `/uploads/announcements/${req.file.filename}` : null;
      const created_by = req.user?.id || null;
      const created = await announcementModel.createAnnouncement({
        title,
        content,
        image_url,
        created_by,
        division_id,
        is_published: is_published === 'true' || is_published === true,
        published_at: published_at || null,
        priority: priority || 'Normal',
        pinned: pinned === 'true' || pinned === true,
      });
      created.image_url = created.image_url ? toFullUrl(created.image_url) : null;
      res.status(201).json(created);
    } catch (err) {
      console.error('createAnnouncement error:', err);
      res.status(500).json({ error: 'Failed to create announcement', details: err.message });
    }
  }
];

exports.updateAnnouncement = [
  upload.single('image'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const fields = { ...req.body };
      if (req.file) fields.image_url = `/uploads/announcements/${req.file.filename}`;
      if (fields.division_id !== undefined) {
        const parsedDivisionId = parseInt(fields.division_id, 10);
        fields.division_id = Number.isNaN(parsedDivisionId) ? null : parsedDivisionId;
      }
      // Normalize boolean strings
      if (fields.is_published !== undefined) fields.is_published = fields.is_published === 'true' || fields.is_published === true;
      if (fields.pinned !== undefined) fields.pinned = fields.pinned === 'true' || fields.pinned === true;
      const updated = await announcementModel.updateAnnouncement(id, fields);
      if (!updated) return res.status(404).json({ error: 'Not found' });
      updated.image_url = updated.image_url ? toFullUrl(updated.image_url) : null;
      res.json(updated);
    } catch (err) {
      console.error('updateAnnouncement error:', err);
      res.status(500).json({ error: 'Failed to update announcement' });
    }
  }
];

exports.deleteAnnouncement = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await announcementModel.deleteAnnouncement(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAnnouncement error:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
};
