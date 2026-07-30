const pool = require('../db');

async function getAllAnnouncements({ onlyPublished = false, limit = 50, offset = 0, divisionId = null, divisionName = null } = {}) {
  const clauses = [];
  const values = [];

  if (onlyPublished) clauses.push('a.is_published = TRUE');
  if (divisionId) {
    values.push(divisionId);
    clauses.push(`a.division_id = $${values.length}`);
  } else if (divisionName) {
    values.push(divisionName);
    clauses.push(`LOWER(d.name) = LOWER($${values.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const q = `
    SELECT a.*, u.name as author_name, u.id as author_id, p.profile_pic_url,
           d.name AS division_name, d.id AS division_id
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN user_profiles p ON u.id = p.user_id
    LEFT JOIN divisions d ON a.division_id = d.id
    ${where}
    ORDER BY a.pinned DESC, a.published_at DESC NULLS LAST, a.created_at DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;
  const { rows } = await pool.query(q, [...values, limit, offset]);
  return rows;
}

async function getAnnouncementById(id) {
  const q = `
    SELECT a.*, u.name as author_name, u.id as author_id, p.profile_pic_url,
           d.name AS division_name, d.id AS division_id
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN user_profiles p ON u.id = p.user_id
    LEFT JOIN divisions d ON a.division_id = d.id
    WHERE a.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

async function createAnnouncement({ title, content, image_url, created_by, division_id = null, is_published = false, published_at = null, priority = 'Normal', pinned = false }) {
  const q = `
    INSERT INTO announcements (title, content, image_url, created_by, division_id, is_published, published_at, priority, pinned, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const vals = [title, content, image_url, created_by, division_id, is_published, published_at, priority, pinned];
  const { rows } = await pool.query(q, vals);
  return rows[0];
}

async function updateAnnouncement(id, fields = {}) {
  const allowed = ['title','content','image_url','division_id','is_published','published_at','priority','pinned'];
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
