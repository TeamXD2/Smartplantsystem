const express = require('express');
const rateLimit = require('express-rate-limit');
const { getSetupStatus, createFirstAdmin } = require('../controllers/setupController');

const router = express.Router();

// Creating the first Admin is the most sensitive public action, so it gets a
// tighter limit than the rest of the public endpoints.
const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many setup attempts, please try again later' }
});

router.get('/status', getSetupStatus);
router.post('/admin', setupLimiter, createFirstAdmin);

module.exports = router;
