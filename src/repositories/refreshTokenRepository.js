const { pool } = require('../db/mysql');

// Every function accepts an optional `conn` so the service can run several
// statements inside one transaction. Defaults to the pool for single queries.

async function insert({ jti, userId, expiresAt }, conn = pool) {
  await conn.execute(
    'INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)',
    [jti, userId, expiresAt],
  );
}

async function findByJti(jti, conn = pool) {
  const [rows] = await conn.execute(
    'SELECT jti, user_id, expires_at FROM refresh_tokens WHERE jti = ? LIMIT 1',
    [jti],
  );
  return rows[0] || null;
}

// Returns true if a row was actually deleted. Used to detect "already used".
async function deleteByJti(jti, conn = pool) {
  const [result] = await conn.execute('DELETE FROM refresh_tokens WHERE jti = ?', [jti]);
  return result.affectedRows === 1;
}

// "Log out everywhere" / reuse-detection response.
async function deleteAllForUser(userId, conn = pool) {
  const [result] = await conn.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  return result.affectedRows;
}

module.exports = { insert, findByJti, deleteByJti, deleteAllForUser };
