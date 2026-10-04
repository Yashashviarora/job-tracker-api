const crypto = require('node:crypto');

// Gives every request a unique id so a log line, an error response and a
// client bug report can all be tied together. Honour an incoming header if a
// proxy/gateway already set one; otherwise generate a UUID.
function requestId(req, res, next) {
  const id = req.get('x-request-id') || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestId;
