const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { activityQuerySchema } = require('../schemas/activitySchemas');
const activityRepo = require('../repositories/activityRepository');

const router = Router();

router.use(requireAuth);

// GET /activity?limit=20&application_id=3 — my recent changes, newest first.
// Read-only with no business rules, so the route calls the repository directly.
router.get(
  '/',
  validate({ query: activityQuerySchema }),
  asyncHandler(async (req, res) => {
    const { limit, application_id: applicationId } = req.validated.query;
    const data = await activityRepo.listForUser(req.user.id, { limit, applicationId });
    res.json({ data });
  }),
);

module.exports = router;
