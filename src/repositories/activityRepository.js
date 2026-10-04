const ActivityLog = require('../models/ActivityLog');

// Same contract as the MySQL repositories: plain data in, plain data out.
// Callers never see mongoose documents or query builders.

async function record({ applicationId, userId, action, from = null, to = null }) {
  await ActivityLog.create({
    application_id: applicationId,
    user_id: userId,
    action,
    from,
    to,
  });
}

async function listForUser(userId, { limit, applicationId }) {
  const filter = { user_id: userId };
  if (applicationId) filter.application_id = applicationId;

  return ActivityLog.find(filter)
    .sort({ at: -1, _id: -1 })
    .limit(limit)
    .lean(); // plain objects, not mongoose documents: faster, JSON-ready
}

module.exports = { record, listForUser };
