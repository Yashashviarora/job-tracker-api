const eventRepo = require('../repositories/eventRepository');
const userRepo = require('../repositories/userRepository');
const appRepo = require('../repositories/applicationRepository');
const activityRepo = require('../repositories/activityRepository');
const { detectStatus, shouldUpdate, matchApplication } = require('../utils/emailClassifier');

// Process one stored email. Returns a short note describing what happened.
// "Nothing to do" outcomes RETURN, so the job is marked done.
// Real failures THROW, so the worker retries with back-off.
async function processEvent(inboundEventId) {
  const event = await eventRepo.findById(inboundEventId);
  if (!event) throw new Error(`inbound event ${inboundEventId} not found`);
  const email = event.payload; // { event_id, from, to, subject, text }

  // Which user? The address the email was sent (forwarded) to.
  const user = await userRepo.findByEmail(email.to);
  if (!user) return 'ignored: no user with this address';

  // What does it say? Cheap, no DB, so do it before loading applications.
  const next = detectStatus(email.subject, email.text);
  if (!next) return 'ignored: no status keywords';

  // Which application is it about?
  const apps = await appRepo.listForMatching(user.id);
  const app = matchApplication(apps, email);
  if (!app) return 'ignored: no matching application';

  // Forward-only rule: never move interview back to applied, never reopen rejected.
  if (!shouldUpdate(app.status, next)) return `no change: ${app.status} -> ${next} not allowed`;

  // Compare-and-set: only if the status is still what we read above.
  const changed = await appRepo.updateStatusIfUnchanged(app.id, user.id, app.status, next);
  if (!changed) return 'skipped: status changed by someone else meanwhile';

  // Audit trail. Same rule as applicationService: if Mongo is down, the MySQL
  // change still stands. Throwing here would not help anyway: on retry the
  // status is already updated, so shouldUpdate() returns false and nothing is logged.
  try {
    await activityRepo.record({
      applicationId: app.id,
      userId: user.id,
      action: 'status_changed',
      from: app.status,
      to: next,
      via: 'email',
      eventId: event.event_id,
    });
  } catch (err) {
    console.error(`activity log write failed for event ${event.event_id}:`, err.message);
  }

  return `updated application ${app.id}: ${app.status} -> ${next}`;
}

module.exports = { processEvent };
