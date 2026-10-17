// Builds and configures the Express app. No listening here, so tests (later)
// can import the app without opening a port.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const adminRouter = require('./routes/admin');
const { requireAuth, requireRole } = require('./middleware/auth');
const webhooksRouter = require('./routes/webhooks');
const deadLetterRouter = require('./routes/deadLetter');

const requestId = require('./middleware/requestId');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const applicationsRouter = require('./routes/applications');
const activityRouter = require('./routes/activity');

const app = express();

// Behind the host's reverse proxy (Render, nginx): trust X-Forwarded-* so
// req.ip and req.protocol reflect the real client. 1 = exactly one proxy hop.
app.set('trust proxy', 1);

// ---- global middleware (order matters: runs top to bottom) ----
app.use(requestId);        // first, so every later log line has req.id
app.use(helmet());         // sets security headers
app.use(cors());
// Parse JSON into req.body, and also keep the exact original bytes in
// req.rawBody. Webhook signatures are computed over the raw bytes, and
// re-serialising req.body would not reproduce them.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// tiny request logger
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

// ---- routes ----
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/admin', requireAuth, requireRole('admin'), adminRouter);
app.use('/applications', applicationsRouter);
app.use('/activity', activityRouter);
app.use('/events', webhooksRouter);
app.use('/dead-letter', requireAuth, requireRole('admin'), deadLetterRouter);

// ---- fallthrough ----
app.use(notFound);      // nothing above matched
app.use(errorHandler);  // must be LAST

module.exports = app;
