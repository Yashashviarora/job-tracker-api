const env = require('./config/env'); // validates env first; exits if invalid
const app = require('./app');
const { connectMongo, disconnectMongo } = require('./db/mongo');
const { pool } = require('./db/mysql');

async function main() {
  // Fail fast: if Mongo is unreachable, don't start at all.
  await connectMongo();
  console.log('MongoDB connected');

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown: stop accepting connections, close DB handles, exit.
  function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
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
