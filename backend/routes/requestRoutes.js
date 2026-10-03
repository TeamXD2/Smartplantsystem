const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { submitRequest, listRequests, reviewRequest } = require('../controllers/requestController');

router.use(authenticate);

// Botanist submits an edit/delete request
router.post('/', requireRole('Botanist'), submitRequest);

// Conservation Officer / Admin view and review requests
router.get('/', requireRole('Conservation Officer', 'Admin'), listRequests);
router.patch('/:id/review', requireRole('Conservation Officer', 'Admin'), reviewRequest);

module.exports = router;
