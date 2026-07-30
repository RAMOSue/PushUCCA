const pool = require('../db');

async function getAllAnnouncements({ onlyPublished = false, limit = 50, offset = 0 } = {}) {
  const where = onlyPublished ? 'WHERE a.is_published = TRUE' : '';
  const q = `
    SELECT a.*, u.name as author_name, u.id as author_id, p.profile_pic_url
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN user_profiles p ON u.id = p.user_id
    ${where}
    ORDER BY a.pinned DESC, a.published_at DESC NULLS LAST, a.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const { rows } = await pool.query(q, [limit, offset]);
  return rows;
}

async function getAnnouncementById(id) {
  const q = `
    SELECT a.*, u.name as author_name, u.id as author_id, p.profile_pic_url
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN user_profiles p ON u.id = p.user_id
    WHERE a.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

async function createAnnouncement({ title, content, image_url, created_by, is_published = false, published_at = null, priority = 'Normal', pinned = false }) {
  const q = `
    INSERT INTO announcements (title, content, image_url, created_by, is_published, published_at, priority, pinned, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const vals = [title, content, image_url, created_by, is_published, published_at, priority, pinned];
  const { rows } = await pool.query(q, vals);
  return rows[0];
}

async function updateAnnouncement(id, fields = {}) {
  const allowed = ['title','content','image_url','is_published','published_at','priority','pinned'];
  const sets = [];
  const vals = [];
  let idx = 1;
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = $${idx}`);
    vals.push(fields[key]);
    idx++;
  }
  if (sets.length === 0) return getAnnouncementById(id);
  vals.push(id);
  const q = `UPDATE announcements SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
  const { rows } = await pool.query(q, vals);
  return rows[0];
}

async function deleteAnnouncement(id) {
  const q = `DELETE FROM announcements WHERE id = $1 RETURNING *`;
  const { rows } = await pool.query(q, [id]);
  return rows[0];
}

module.exports = {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
