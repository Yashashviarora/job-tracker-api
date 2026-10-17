const env = require('./config/env'); // validates env first; exits if invalid
const app = require('./app');
const { connectMongo, disconnectMongo } = require('./db/mongo');
const { pool } = require('./db/mysql');
const { startWorker, stopWorker } = require('./worker/worker');

async function main() {
  // Fail fast: if Mongo is unreachable, don't start at all.
  await connectMongo();
  console.log('MongoDB connected');

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Same process, same event loop: the worker's DB calls are async I/O, so
  // they interleave with HTTP requests instead of blocking them.
  if (env.WORKER_ENABLED) startWorker();

  // Graceful shutdown, in dependency order:
  // 1. stop accepting HTTP, 2. let the in-flight job finish, 3. close DB handles.
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return; // a second Ctrl+C shouldn't start a second shutdown
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await stopWorker();
      await Promise.allSettled([pool.end(), disconnectMongo()]);
      process.exit(0);
    });
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
