// An error we *expect* and know how to turn into an HTTP response.
// Anything that is NOT an AppError is treated as a bug -> generic 500.
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details; // optional, e.g. zod validation issues
    this.isOperational = true;
  }

  static badRequest(message, details) { return new AppError(400, message, details); }
  static unauthorized(message = 'Unauthorized') { return new AppError(401, message); }
  static forbidden(message = 'Forbidden') { return new AppError(403, message); }
  static notFound(message = 'Not found') { return new AppError(404, message); }
  static conflict(message) { return new AppError(409, message); }
}

module.exports = AppError;
