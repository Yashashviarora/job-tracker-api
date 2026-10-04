const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/tokens');

// Authentication: who are you? Reads "Authorization: Bearer <token>",
// verifies the signature + expiry, and attaches { id, role } to req.user.
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
    next(AppError.unauthorized(message));
  }
}

// Authorization: are you allowed? Factory: requireRole('admin') returns the
// middleware. Must run AFTER requireAuth, which is what populates req.user.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('Insufficient role'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
