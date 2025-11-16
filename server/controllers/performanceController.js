const pool = require('../db');

// GET /api/performances
async function getAllPerformances(req, res) {
  try {
    const q = 'SELECT * FROM performances ORDER BY start_time DESC';
    const { rows } = await pool.query(q);
    res.json(rows);
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
    res.json(rows[0]);
  } catch (err) {
    console.error('getPerformanceById error:', err.message);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
}

// POST /api/performances
async function createPerformance(req, res) {
  try {
    const { title, description, location, start_time, end_time } = req.body;
    const created_by = req.user?.id || null;
    const q = `INSERT INTO performances (title, description, location, start_time, end_time, created_by)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
    const params = [title, description || null, location || null, start_time, end_time, created_by];
    const { rows } = await pool.query(q, params);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createPerformance error:', err.message);
    res.status(500).json({ error: 'Failed to create performance' });
  }
}

// PUT /api/performances/:id
async function updatePerformance(req, res) {
  try {
    const { id } = req.params;
    const { title, description, location, start_time, end_time } = req.body;
    const q = `UPDATE performances SET title=$1, description=$2, location=$3, start_time=$4, end_time=$5, updated_at=now()
               WHERE id=$6 RETURNING *`;
    const params = [title, description || null, location || null, start_time, end_time, id];
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updatePerformance error:', err.message);
    res.status(500).json({ error: 'Failed to update performance' });
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

module.exports = {
  getAllPerformances,
  getPerformanceById,
  createPerformance,
  updatePerformance,
  deletePerformance,
};
