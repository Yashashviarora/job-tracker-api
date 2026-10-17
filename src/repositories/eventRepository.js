const { pool } = require('../db/mysql');

// Save the email and queue its job in ONE transaction: both rows or neither.
async function insertEventWithJob({ eventId, source, payload }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ev] = await conn.execute(
      'INSERT INTO inbound_events (event_id, source, payload) VALUES (?, ?, ?)',
      [eventId, source, JSON.stringify(payload)],
    );
    const [job] = await conn.execute('INSERT INTO jobs (inbound_event_id) VALUES (?)', [ev.insertId]);

    await conn.commit();
    return { duplicate: false, inboundEventId: ev.insertId, jobId: job.insertId };
  } catch (err) {
    await conn.rollback();
    // Unique event_id already present: the sender is redelivering.
    if (err.code === 'ER_DUP_ENTRY') return { duplicate: true };
    throw err;
  } finally {
    conn.release();
  }
}


// The worker only has the job's inbound_event_id; this loads the email itself.
// mysql2 parses JSON columns back into objects, so payload is ready to use.
async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, event_id, payload FROM inbound_events WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}


module.exports = { insertEventWithJob,findById };
