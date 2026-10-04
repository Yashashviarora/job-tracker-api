// Dead-simple migration runner: reads schema.sql and executes each statement.
// Run with: npm run db:migrate
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./mysql');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Split on ";" and drop blanks. Fine for our schema (no procedures/triggers).
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }

  console.log(`Applied ${statements.length} statements.`);
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
