const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const env = require('../config/env');

// Access token: proves identity on every request. Short-lived, never stored.
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL, algorithm: 'HS256' },
  );
}

// Refresh token: permission slip to get a new pair. Carries a jti that is also
// stored server-side so it can be revoked / made single-use.
function signRefreshToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: String(user.id), jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL, algorithm: 'HS256' },
  );
  // exp is seconds since epoch; the DATETIME column wants a JS Date
  const { exp } = jwt.decode(token);
  return { token, jti, expiresAt: new Date(exp * 1000) };
}

// Both throw on bad signature / expiry; callers map that to 401.
// Pinning algorithms blocks "alg: none" and algorithm-confusion attacks.
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
