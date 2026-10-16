const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { register, login, me } = require('../controllers/authController');

// Slows down password guessing: max 10 failed login attempts per IP every
// 15 minutes. Successful logins don't count, so normal use is never blocked.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 15 minutes' }
});

// Only an Admin can create accounts. The first Admin is created with `npm run create-admin`.
router.post('/register', authenticate, requireRole('Admin'), register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
