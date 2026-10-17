const { pool } = require('../db/mysql');

// All times use MySQL's NOW(), never JS dates, so the app and the database
// can't disagree about the clock or timezone.

// A worker that crashed mid-job leaves it in 'processing' forever.
// After 5 minutes we assume it died and put the job back in the queue.
async function reclaimStale() {
  const [result] = await pool.execute(
    `UPDATE jobs SET status = 'pending', locked_at = NULL
      WHERE status = 'processing' AND locked_at < NOW() - INTERVAL 5 MINUTE`,
  );
  return result.affectedRows;
}

// Take the oldest runnable job. The transaction is kept SHORT on purpose:
// lock the row, flip it to 'processing', commit. The slow work (parsing,
// Mongo) happens after commit, so no lock is held while we do it.
async function claimNext() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE: lock this row until commit. A second worker running the
    // same query waits, then sees status = 'processing' and skips it.
    const [rows] = await conn.execute(
      `SELECT id, inbound_event_id, attempts FROM jobs
        WHERE status = 'pending' AND run_after <= NOW()
        ORDER BY run_after, id
        LIMIT 1
        FOR UPDATE`,
    );
    if (rows.length === 0) {
      await conn.commit();
      return null;
    }

    const job = rows[0];
    await conn.execute(
      `UPDATE jobs SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
        WHERE id = ?`,
      [job.id],
    );
    await conn.commit();
    return { ...job, attempts: job.attempts + 1 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// note: optional reason, e.g. "ignored: no matching application"
async function markDone(jobId, note = null) {
  await pool.execute(
    `UPDATE jobs SET status = 'done', locked_at = NULL, last_error = ? WHERE id = ?`,
    [note, jobId],
  );
}

// Back to the queue, but not runnable until delaySeconds from now.
async function scheduleRetry(jobId, error, delaySeconds) {
  await pool.execute(
    `UPDATE jobs SET status = 'pending', locked_at = NULL, last_error = ?,
            run_after = NOW() + INTERVAL ? SECOND
      WHERE id = ?`,
    [error, delaySeconds, jobId],
  );
}

// Gave up: record it for a human, and take the job out of the queue.
// One transaction so we never have a dead-letter row for a job that's still pending.
async function moveToDeadLetter(job, error) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'INSERT INTO dead_letter (job_id, inbound_event_id, attempts, error) VALUES (?, ?, ?, ?)',
      [job.id, job.inbound_event_id, job.attempts, error],
    );
    await conn.execute(
      `UPDATE jobs SET status = 'done', locked_at = NULL, last_error = ? WHERE id = ?`,
      [error, job.id],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { reclaimStale, claimNext, markDone, scheduleRetry, moveToDeadLetter };
