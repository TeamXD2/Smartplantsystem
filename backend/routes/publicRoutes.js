const express = require('express');
const router = express.Router();
const { getPublicPlantByQrCode } = require('../controllers/publicController');

// No authenticate middleware here - this is deliberately open for Park Visitors
router.get('/plants/qr/:qr_code', getPublicPlantByQrCode);

module.exports = router;
