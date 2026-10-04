const mongoose = require('mongoose');
const env = require('../config/env');

// One mongoose connection for the whole process. Mongoose manages its own
// connection pool (default 100 sockets) behind this single connect() call,
// so this is the MongoDB equivalent of our mysql2 pool.
async function connectMongo() {
  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // fail fast at startup instead of hanging
  });
}

// readyState 1 = connected. Cheap check for /health; the admin ping confirms
// the server is actually answering, not just that we think we're connected.
async function pingMongo() {
  if (mongoose.connection.readyState !== 1) throw new Error('mongoose not connected');
  await mongoose.connection.db.admin().ping();
}

async function disconnectMongo() {
  await mongoose.disconnect();
}

module.exports = { connectMongo, pingMongo, disconnectMongo };
