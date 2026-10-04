const AppError = require('../utils/AppError');
const repo = require('../repositories/applicationRepository');
const activityRepo = require('../repositories/activityRepository');
const { STATUSES } = require('../schemas/applicationSchemas');
const { encodeCursor, decodeCursor } = require('../utils/cursor');

// The activity log is an audit trail, not part of the transaction. If Mongo
// is down we still want the MySQL write to succeed, so log and move on.
async function logActivity(entry) {
  try {
    await activityRepo.record(entry);
  } catch (err) {
    console.error('activity log write failed:', err.message);
  }
}

async function create(userId, data) {
  const id = await repo.create(userId, data);
  const app = await repo.findByIdForUser(id, userId);
  await logActivity({ applicationId: id, userId, action: 'created', to: app.status });
  return app;
}

async function list(userId, query) {
  let after = null;
  if (query.cursor) {
    after = decodeCursor(query.cursor);
    if (!after) throw AppError.badRequest('Invalid cursor');
  }

  const rows = await repo.listForUser(userId, { ...query, after });

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;

  let nextCursor = null;
  if (hasMore) {
    const last = data[data.length - 1];
    let v = last[query.sort];
    if (v instanceof Date) v = v.toISOString().slice(0, 19).replace('T', ' ');
    nextCursor = encodeCursor({ v, id: last.id });
  }

  return { data, nextCursor };
}

async function getById(userId, id) {
  const app = await repo.findByIdForUser(id, userId);
  if (!app) throw AppError.notFound('Application not found');
  return app;
}

async function update(userId, id, patch) {
  // Read before write so we know the previous status for the audit entry.
  const before = await repo.findByIdForUser(id, userId);
  if (!before) throw AppError.notFound('Application not found');

  const updated = await repo.updateForUser(id, userId, patch);
  if (!updated) throw AppError.notFound('Application not found');

  if (patch.status && patch.status !== before.status) {
    await logActivity({
      applicationId: id,
      userId,
      action: 'status_changed',
      from: before.status,
      to: patch.status,
    });
  }

  return repo.findByIdForUser(id, userId);
}

async function remove(userId, id) {
  const before = await repo.findByIdForUser(id, userId);
  if (!before) throw AppError.notFound('Application not found');

  const deleted = await repo.deleteForUser(id, userId);
  if (!deleted) throw AppError.notFound('Application not found');

  await logActivity({ applicationId: id, userId, action: 'deleted', from: before.status });
}

async function stats(userId) {
  const rows = await repo.countByStatus(userId);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = Number(row.count);
    total += Number(row.count);
  }
  return { total, byStatus };
}

module.exports = { create, list, getById, update, remove, stats };
