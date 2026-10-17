const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const AppError = require('../utils/AppError');
const { idParam } = require('../schemas/applicationSchemas');
const deadLetterRepo = require('../repositories/deadLetterRepository');

const router = Router();

const listQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();

// requireAuth + requireRole('admin') are applied where this router is mounted.
router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    res.json({ data: await deadLetterRepo.listOpen(req.validated.query) });
  }),
);

router.post(
  '/:id/replay',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await deadLetterRepo.replay(req.validated.params.id);
    if (result === 'not_found') throw AppError.notFound('Dead-letter entry not found');
    if (result === 'already_replayed') throw AppError.conflict('Already replayed');
    // 202 Accepted: queued again; the worker will process it shortly.
    res.status(202).json({ replayed: true });
  }),
);

module.exports = router;
