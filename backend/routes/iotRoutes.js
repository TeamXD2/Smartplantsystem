const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const {
  requireDeviceKey, postReading, listSensors, updateSensor, listReadings, listAlerts, acknowledgeAlert
} = require('../controllers/iotController');

router.param('id', validateId);

// ESP32 boards (X-Device-Key header). One reading every few seconds per board
// is normal; this only stops a broken loop from flooding the database.
const deviceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many readings, slow down the send interval' }
});
router.post('/readings', deviceLimiter, requireDeviceKey, postReading);

// Monitoring dashboard - Conservation Officers and Admins.
const staff = [authenticate, requireRole('Conservation Officer', 'Admin')];
router.get('/sensors', staff, listSensors);
router.patch('/sensors/:id', staff, updateSensor);
router.get('/readings', staff, listReadings);
router.get('/alerts', staff, listAlerts);
router.patch('/alerts/:id/acknowledge', staff, acknowledgeAlert);

module.exports = router;
