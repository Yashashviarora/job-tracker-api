const { z } = require('zod');

const STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected'];

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

// Shared field rules. No defaults here: a default on `status` would make
// PATCH {} silently become PATCH { status: 'applied' } after .partial().
const fields = {
  company: z.string().trim().min(1).max(255),
  role_title: z.string().trim().min(1).max(255),
  source: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES),
  applied_on: z.iso.date().optional(),          // 'YYYY-MM-DD'
  salary_expected: z.number().int().nonnegative().optional(),
  notes: z.string().max(5000).optional(),
};

const createSchema = z
  .object({ ...fields, status: fields.status.default('applied') })
  .strict();

// Every field optional, but at least one must be present.
const updateSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' });

// Whitelist of columns the client may sort by. The repository maps these
// names to SQL; nothing from the request is ever interpolated directly.
// Only NOT NULL columns: keyset comparisons with NULLs need extra branches.
const SORTABLE = ['created_at', 'company', 'id'];

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(SORTABLE).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
    cursor: z.string().min(1).optional(),
    status: z.enum(STATUSES).optional(),
    company: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

module.exports = { STATUSES, SORTABLE, idParam, createSchema, updateSchema, listQuerySchema };
