const { pool } = require('../db/mysql');

// Failed jobs nobody has replayed yet, oldest first, with the email's event_id
// so an admin can tell which email it was.
// Served by idx_dead_letter_open (replayed_at, id).
async function listOpen({ limit }) {
  const [rows] = await pool.execute(
    `SELECT d.id, d.job_id, d.inbound_event_id, e.event_id, d.attempts, d.error, d.created_at
       FROM dead_letter d
       JOIN inbound_events e ON e.id = d.inbound_event_id
      WHERE d.replayed_at IS NULL
      ORDER BY d.id
      LIMIT ${Number(limit)}`,
  );
  return rows;
}

// Put the job back in the queue with a fresh attempt budget, and mark the
// dead-letter row as handled. One transaction: never one without the other.
// Returns 'not_found' | 'already_replayed' | 'replayed'.
async function replay(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE: two admins clicking replay at once can't both reset the job.
    const [rows] = await conn.execute(
      'SELECT id, job_id, replayed_at FROM dead_letter WHERE id = ? FOR UPDATE',
      [id],
    );
    const dl = rows[0];
    if (!dl) {
      await conn.rollback();
      return 'not_found';
    }
    if (dl.replayed_at) {
      await conn.rollback();
      return 'already_replayed';
    }

    await conn.execute(
      `UPDATE jobs SET status = 'pending', attempts = 0, run_after = NOW(),
              locked_at = NULL, last_error = NULL
        WHERE id = ?`,
      [dl.job_id],
    );
    await conn.execute('UPDATE dead_letter SET replayed_at = NOW() WHERE id = ?', [id]);

    await conn.commit();
    return 'replayed';
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listOpen, replay };
