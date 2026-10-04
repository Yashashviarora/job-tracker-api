const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  idParam,
  createSchema,
  updateSchema,
  listQuerySchema,
} = require('../schemas/applicationSchemas');
const ctrl = require('../controllers/applicationController');

const router = Router();

// Everything in this router requires a logged-in user.
router.use(requireAuth);

router.get('/', validate({ query: listQuerySchema }), ctrl.list);
router.post('/', validate({ body: createSchema }), ctrl.create);

// Static paths MUST be registered before /:id. Express matches in order, and
// "/stats" would otherwise be captured as id="stats" and fail validation.
router.get('/stats', ctrl.stats);

router.get('/:id', validate({ params: idParam }), ctrl.getById);
router.patch('/:id', validate({ params: idParam, body: updateSchema }), ctrl.update);
router.delete('/:id', validate({ params: idParam }), ctrl.remove);

module.exports = router;
