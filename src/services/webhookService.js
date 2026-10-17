const env = require('../config/env');
const AppError = require('../utils/AppError');
const { verify } = require('../utils/signature');
const { emailEventSchema } = require('../schemas/webhookSchemas');
const eventRepo = require('../repositories/eventRepository');

// 1. prove the sender knows the secret, 2. check the shape, 3. store + queue.
async function ingestEmail({ rawBody, timestamp, signature, body }) {
  if (!verify(rawBody, timestamp, signature, env.WEBHOOK_SECRET)) {
    throw AppError.unauthorized('Invalid or expired signature');
  }

  const result = emailEventSchema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      message: i.message,
    }));
    throw AppError.badRequest('Invalid event', details);
  }

  const event = result.data;
  return eventRepo.insertEventWithJob({
    eventId: event.event_id,
    source: 'email',
    payload: event,
  });
}

module.exports = { ingestEmail };
