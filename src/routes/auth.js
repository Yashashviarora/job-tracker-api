const { Router } = require('express');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema, refreshSchema } = require('../schemas/authSchemas');
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.post('/register', validate({ body: registerSchema }), ctrl.register);
router.post('/login', validate({ body: loginSchema }), ctrl.login);
router.post('/refresh', validate({ body: refreshSchema }), ctrl.refresh);
router.post('/logout', validate({ body: refreshSchema }), ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
