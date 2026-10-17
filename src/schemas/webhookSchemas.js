const { z } = require('zod');

// Our normalised email event. Not .strict(): real email services send extra
// fields we don't use, and zod simply drops them.
const emailEventSchema = z.object({
  event_id: z.string().trim().min(1).max(255),
  from: z.email().transform((e) => e.toLowerCase()),
  to: z.email().transform((e) => e.toLowerCase()),
  subject: z.string().max(1000).default(''),
  text: z.string().max(100000).default(''),
});

module.exports = { emailEventSchema };
