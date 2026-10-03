const pool = require('../config/db');

// Only these columns ever reach the public - new columns stay private by
// default. Height/width/appearance are included since they don't
// meaningfully help someone locate the plant.
const PUBLIC_FIELDS = [
  'qr_code', 'common_name', 'scientific_name', 'family', 'genus', 'species',
  'height_cm', 'width_cm', 'morphological_notes', 'conservation_status',
  'ecological_role', 'medicinal_use', 'cultural_significance'
];

// GET /api/public/plants/qr/:qr_code
// No authentication - this is what a Park Visitor hits when they scan a
// QR code in the park.
async function getPublicPlantByQrCode(req, res) {
  try {
    const { qr_code } = req.params;

    const [rows] = await pool.query('SELECT * FROM plants WHERE qr_code = ?', [qr_code]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No plant found for this QR code' });
    }

    const plant = rows[0];

    // Step 1: not published yet -> public sees nothing, regardless of
    // location_visibility.
    if (plant.publication_status !== 'Published') {
      return res.status(404).json({ error: 'This plant record is not yet published' });
    }

    const publicView = {};
    PUBLIC_FIELDS.forEach((field) => { publicView[field] = plant[field]; });

    // Location is opt-in: anything other than Public/Approximate (Hidden,
    // NULL, a typo) shows no location at all.
    if (plant.location_visibility === 'Public') {
      publicView.latitude = plant.latitude;
      publicView.longitude = plant.longitude;
      publicView.surrounding_environment = plant.surrounding_environment;
      publicView.general_location = plant.general_location;
    } else if (plant.location_visibility === 'Approximate') {
      publicView.general_location = plant.general_location; // e.g. "Bakor Forest Area"
    }

    res.json(publicView);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while looking up QR code' });
  }
}

module.exports = { getPublicPlantByQrCode };
