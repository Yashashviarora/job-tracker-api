const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const webhookService = require('../services/webhookService');

const router = Router();

// No requireAuth: the sender is a mail service, not a logged-in user.
// The HMAC signature is the authentication.
router.post(
  '/email',
  asyncHandler(async (req, res) => {
    const { duplicate } = await webhookService.ingestEmail({
      rawBody: req.rawBody,
      timestamp: req.get('x-timestamp'),
      signature: req.get('x-signature'),
      body: req.body,
    });
    res.status(200).json({ received: true, duplicate });
  }),
);

module.exports = router;
