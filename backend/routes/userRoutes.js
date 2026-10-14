const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const { listUsers, updateUser } = require('../controllers/userController');

// Account management - Admin only
// Reject non-numeric ids before they reach Postgres
router.param('id', validateId);

router.use(authenticate, requireRole('Admin'));

router.get('/', listUsers);           // List all accounts
router.patch('/:id', updateUser);     // Deactivate/reactivate, change role or botanist_type

module.exports = router;
