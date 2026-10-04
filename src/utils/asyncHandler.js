// Wraps an async route handler so a rejected promise is passed to next(err)
// and reaches the central error handler instead of hanging the request.
//
// Express 5 does this automatically for async functions, but Express 4 (which
// most codebases and interview questions still assume) does not. Keeping the
// wrapper makes the intent explicit and the code portable.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
