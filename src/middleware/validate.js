const AppError = require('../utils/AppError');

// validate({ body: schema, query: schema, params: schema }) -> middleware.
// Parsed + coerced values land on req.validated so controllers never read
// raw input. (Express 5 makes req.query read-only, so we don't overwrite it.)
function validate(schemas) {
  return (req, res, next) => {
    req.validated = {};
    for (const key of ['body', 'query', 'params']) {
      if (!schemas[key]) continue;
      const result = schemas[key].safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          field: i.path.join('.') || key,
          message: i.message,
        }));
        return next(AppError.badRequest(`Invalid ${key}`, details));
      }
      req.validated[key] = result.data;
    }
    next();
  };
}

module.exports = validate;
