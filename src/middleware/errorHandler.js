const AppError = require('../utils/AppError');
const env = require('../config/env');

// Runs when no route matched. Converts "no match" into a 404 AppError and
// forwards it, so errorHandler below stays the single place that formats
// error responses.
function notFound(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// Express recognises an error-handling middleware ONLY by its arity:
// exactly four parameters (err, req, res, next). With three params Express
// treats it as normal middleware and would never route errors here.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Two kinds of "expected" errors:
  //   1. our own AppError
  //   2. http-errors thrown by Express internals (e.g. express.json() on bad
  //      JSON) - they carry a 4xx statusCode and expose: true
  const isOperational =
    err instanceof AppError ||
    (err.expose === true && err.statusCode >= 400 && err.statusCode < 500);
  const statusCode = isOperational ? err.statusCode : 500;

  // Operational errors are expected and safe to show. Anything else is a bug:
  // log the full stack, but never leak internals to the client.
  if (!isOperational) {
    console.error(`[${req.id}] UNHANDLED`, err);
  }

  res.status(statusCode).json({
    error: {
      message: isOperational ? err.message : 'Internal server error',
      ...(err.details && { details: err.details }),
      requestId: req.id,
      ...(env.NODE_ENV === 'development' && !isOperational && { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
