const { pool } = require('../db/mysql');

const COLUMNS =
  'id, user_id, company, role_title, source, status, applied_on, salary_expected, notes, created_at, updated_at';

// Columns a client is allowed to write. Anything else is ignored even if it
// somehow reached this layer.
const WRITABLE = ['company', 'role_title', 'source', 'status', 'applied_on', 'salary_expected', 'notes'];

async function create(userId, data) {
  const [result] = await pool.execute(
    `INSERT INTO applications
       (user_id, company, role_title, source, status, applied_on, salary_expected, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.company,
      data.role_title,
      data.source ?? null,
      data.status,
      data.applied_on ?? null,
      data.salary_expected ?? null,
      data.notes ?? null,
    ],
  );
  return result.insertId;
}

async function findByIdForUser(id, userId) {
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS} FROM applications WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId],
  );
  return rows[0] || null;
}

// Keyset pagination. `after` is the decoded cursor { v, id } of the last row
// the client saw, or null for the first page. Fetches limit+1 so the caller
// can tell whether another page exists without a COUNT query.
//
// `sort`, `order` and `limit` are interpolated into the SQL, which is safe
// ONLY because zod has already forced them into closed sets (SORTABLE,
// asc|desc, 1..100). Everything user-typed still goes through `?`.
async function listForUser(userId, { limit, sort, order, after, status, company }) {
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  const cmp = order === 'asc' ? '>' : '<';

  const where = ['user_id = ?'];
  const params = [userId];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (company) {
    where.push('company LIKE ?');
    params.push(`${company}%`); // prefix match, index-friendly
  }
  if (after) {
    // Row-value comparison: strictly after (sortCol, id) in the chosen order.
    // id is the tiebreaker so rows with equal sort values are never skipped.
    where.push(`(${sort} ${cmp} ? OR (${sort} = ? AND id ${cmp} ?))`);
    params.push(after.v, after.v, after.id);
  }

  const [rows] = await pool.execute(
    `SELECT ${COLUMNS} FROM applications
      WHERE ${where.join(' AND ')}
      ORDER BY ${sort} ${dir}, id ${dir}
      LIMIT ${Number(limit) + 1}`,
    params,
  );
  return rows;
}

async function countByStatus(userId) {
  const [rows] = await pool.execute(
    'SELECT status, COUNT(*) AS count FROM applications WHERE user_id = ? GROUP BY status',
    [userId],
  );
  return rows;
}

// Builds "SET col = ?, col = ?" from the patch. Column names come from the
// WRITABLE allowlist, never from user input, so the only user-controlled
// values are the ? parameters.
async function updateForUser(id, userId, patch) {
  const keys = Object.keys(patch).filter((k) => WRITABLE.includes(k));
  if (keys.length === 0) return false;

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k] ?? null);

  const [result] = await pool.execute(
    `UPDATE applications SET ${setClause} WHERE id = ? AND user_id = ?`,
    [...values, id, userId],
  );
  return result.affectedRows === 1;
}

async function deleteForUser(id, userId) {
  const [result] = await pool.execute(
    'DELETE FROM applications WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  return result.affectedRows === 1;
}

module.exports = { create, findByIdForUser, listForUser, countByStatus, updateForUser, deleteForUser };
