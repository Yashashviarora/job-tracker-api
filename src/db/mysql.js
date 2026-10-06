const mysql = require('mysql2/promise');
const env = require('../config/env');

// One pool for the whole process. Each query borrows a connection and returns
// it; the pool caps concurrency and reuses TCP connections instead of paying
// the handshake cost on every request.
const pool = mysql.createPool({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  waitForConnections: true, // queue callers instead of erroring when all 10 are busy
  connectionLimit: 10,
  queueLimit: 0,            // 0 = unlimited queue
  timezone: 'Z',            // read/write DATETIME as UTC
  dateStrings: ['DATE'],    // DATE columns come back as 'YYYY-MM-DD' strings, not JS Dates
  // Hosted MySQL requires TLS; local Docker does not. rejectUnauthorized: true
  // verifies the server certificate like a browser does. Never set it false.
  ssl: env.MYSQL_SSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
});

// Cheap round-trip used by /health. Throws if the DB is unreachable.
async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release(); // ALWAYS release, or the pool leaks a connection
  }
}

module.exports = { pool, ping };
