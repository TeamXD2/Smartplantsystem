const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const upload = require('../middleware/upload');
const {
  createPlant,
  listPlants,
  getPlantById,
  getPlantByQrCode,
  uploadPlantPhoto,
  getOriginalPhoto,
  getPlantHistory,
  getPlantVersions,
  updatePlant,
  updateVisibility,
  deletePlant
} = require('../controllers/plantController');

// All routes here require login (Botanist/Officer/Admin)
// Reject non-numeric ids before they reach Postgres
router.param('id', validateId);
router.param('photoId', validateId);

router.use(authenticate);

router.post('/', createPlant);                          // Register new plant
router.get('/', listPlants);                            // Plant list (search, filter, "mine")
router.get('/qr/:qr_code', getPlantByQrCode);            // QR scan lookup (staff)
router.get('/:id', getPlantById);                        // View record (filtered for External Botanists)
router.patch('/:id', updatePlant);                       // Direct edit (External Botanists are refused in the controller)
router.get('/:id/history', getPlantHistory);              // Audit trail for this plant
router.get('/:id/versions', getPlantVersions);            // Every saved version of this plant
router.post('/:id/photos', upload.single('photo'), uploadPlantPhoto); // Attach photo (public copy has no GPS; original kept private)
router.get('/:id/photos/:photoId/original', getOriginalPhoto);         // Short-lived link to the private original (Officer/Admin, or the uploader)
router.patch('/:id/visibility', requireRole('Conservation Officer', 'Admin'), updateVisibility); // Publish / location visibility
router.delete('/:id', requireRole('Conservation Officer', 'Admin'), deletePlant);                 // Direct delete (Botanists use POST /api/requests)

module.exports = router;
