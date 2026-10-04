const { pool } = require('../db/mysql');

// Repository layer: the only place SQL lives. Returns plain data, no HTTP,
// no AppError. The service decides what a missing row *means*.

async function findByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, email, role, created_at FROM users WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function create({ email, passwordHash }) {
  const [result] = await pool.execute(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash],
  );
  return result.insertId;
}

async function findAll() {
  const [rows] = await pool.execute(
    'SELECT id, email, role, created_at FROM users ORDER BY id',
  );
  return rows;
}

module.exports = { findByEmail, findById, create, findAll };

// module.exports = { findByEmail, findById, create };
