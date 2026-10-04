const { z } = require('zod');

const activityQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    application_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

module.exports = { activityQuerySchema };
