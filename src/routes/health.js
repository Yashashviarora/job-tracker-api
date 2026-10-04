const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { ping: pingMysql } = require('../db/mysql');
const { pingMongo } = require('../db/mongo');

const router = Router();

// Each dependency is checked independently and reported by name. 200 only
// when all are up; 503 tells a load balancer to stop routing traffic here.
async function check(name, fn, req) {
  try {
    await fn();
    return 'ok';
  } catch (err) {
    console.error(`[${req.id}] ${name} check failed: ${err.message}`);
    return 'down';
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [mysql, mongo] = await Promise.all([
      check('mysql', pingMysql, req),
      check('mongo', pingMongo, req),
    ]);

    const healthy = mysql === 'ok' && mongo === 'ok';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      checks: { mysql, mongo },
    });
  }),
);

module.exports = router;
