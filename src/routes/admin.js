const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const userRepo = require('../repositories/userRepository');

const router = Router();

// Auth + role guard are applied in app.js when this router is mounted,
// so every route in here is admin-only without repeating the guards.
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    res.json(await userRepo.findAll());
  }),
);

module.exports = router;
