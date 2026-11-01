const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { listAuditLogs } = require('../controllers/auditController');

// Audit log - Admin only
router.get('/', authenticate, requireRole('Admin'), listAuditLogs);

module.exports = router;
