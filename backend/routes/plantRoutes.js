const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const upload = require('../middleware/upload');
const {
  createPlant,
  getPlantById,
  getPlantByQrCode,
  uploadPlantPhoto,
  getPlantHistory,
  updatePlant,
  updateVisibility
} = require('../controllers/plantController');

// All routes here require login (Botanist/Officer/Admin)
router.use(authenticate);

router.post('/', createPlant);                          // Register new plant
router.get('/qr/:qr_code', getPlantByQrCode);            // QR scan lookup (staff)
router.get('/:id', getPlantById);                        // View record (filtered for External Botanists)
router.patch('/:id', updatePlant);                       // Direct edit (External Botanists are refused in the controller)
router.get('/:id/history', getPlantHistory);              // Audit trail for this plant
router.post('/:id/photos', upload.single('photo'), uploadPlantPhoto); // Attach photo
router.patch('/:id/visibility', requireRole('Conservation Officer', 'Admin'), updateVisibility); // Publish / location visibility

module.exports = router;
