const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const { submitRequest, listRequests, listMyRequests, reviewRequest } = require('../controllers/requestController');

// Reject non-numeric ids before they reach Postgres
router.param('id', validateId);

router.use(authenticate);

// Botanist submits an edit/delete request
router.post('/', requireRole('Botanist'), submitRequest);

// Botanist checks the status / review comment of their own requests
router.get('/mine', requireRole('Botanist'), listMyRequests);

// Conservation Officer / Admin view and review requests
router.get('/', requireRole('Conservation Officer', 'Admin'), listRequests);
router.patch('/:id/review', requireRole('Conservation Officer', 'Admin'), reviewRequest);

module.exports = router;
