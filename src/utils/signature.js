const crypto = require('node:crypto');

const MAX_AGE_SECONDS = 300; // reject requests signed more than 5 minutes ago

// Signs "<timestamp>.<raw body>". The timestamp is signed too, so nobody can
// make an old request look fresh without breaking the signature.
function sign(rawBody, timestamp, secret) {
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex')
  );
}

function verify(rawBody, timestamp, header, secret) {
  if (!rawBody || typeof header !== 'string' || !/^\d+$/.test(timestamp || '')) return false;

  // Freshness, using our own clock. abs() also rejects far-future timestamps.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > MAX_AGE_SECONDS) return false;

  // Authenticity, using the timestamp FROM THE HEADER, exactly as the sender did.
  const expected = Buffer.from(sign(rawBody, timestamp, secret));
  const received = Buffer.from(header);

  // timingSafeEqual throws on different lengths. Valid headers always have
  // the same length, so this early return leaks nothing useful.
  if (expected.length !== received.length) return false;

  // Checks every byte, so response time reveals nothing about a forged signature.
  return crypto.timingSafeEqual(expected, received);
}

module.exports = { sign, verify };
