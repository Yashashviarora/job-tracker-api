const eventRepo = require('../repositories/eventRepository');
const userRepo = require('../repositories/userRepository');
const appRepo = require('../repositories/applicationRepository');
const activityRepo = require('../repositories/activityRepository');
const {
  detectStatus,
  shouldUpdate,
  matchApplication,
  guessCompanyAndRole,
} = require('../utils/emailClassifier');

// Audit trail. If Mongo is down the MySQL change still stands (same rule as
// applicationService). Throwing would not help: on retry the MySQL change is
// already there, so nothing would be logged anyway.
async function logActivity(entry) {
  try {
    await activityRepo.record({ ...entry, via: 'email' });
  } catch (err) {
    console.error(`activity log write failed for event ${entry.eventId}:`, err.message);
  }
}

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

  if (!app) {
    // Only a "thanks for applying" email may create an application. An
    // interview/rejection with no match is more likely a misread than real.
    if (next !== 'applied') return 'ignored: no matching application';

    const guess = guessCompanyAndRole(email);
    if (!guess) return 'ignored: applied email, company unknown';

    // Safe on retry: next time matchApplication finds this row (its name is in
    // the email), shouldUpdate('applied', 'applied') is false, nothing is created.
    const id = await appRepo.create(user.id, {
      company: guess.company,
      role_title: guess.role,
      source: 'email',
      status: 'applied',
      applied_on: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    });
    await logActivity({ applicationId: id, userId: user.id, action: 'created', to: 'applied', eventId: event.event_id });
    return `created application ${id}: ${guess.company} (${guess.role})`;
  }

  // Forward-only rule: never move interview back to applied, never reopen rejected.
  if (!shouldUpdate(app.status, next)) return `no change: ${app.status} -> ${next} not allowed`;

  // Compare-and-set: only if the status is still what we read above.
  const changed = await appRepo.updateStatusIfUnchanged(app.id, user.id, app.status, next);
  if (!changed) return 'skipped: status changed by someone else meanwhile';

  await logActivity({
    applicationId: app.id,
    userId: user.id,
    action: 'status_changed',
    from: app.status,
    to: next,
    eventId: event.event_id,
  });
  return `updated application ${app.id}: ${app.status} -> ${next}`;
}

module.exports = { processEvent };
