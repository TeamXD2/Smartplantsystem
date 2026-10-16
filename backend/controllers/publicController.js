const pool = require('../config/db');
const { parsePaging, likePattern } = require('../utils/listQuery');
const { isPublished, buildPublicView, buildPublicListItem, COVER_PHOTO_SQL } = require('../utils/publicView');

// GET /api/public/plants?search=&page=&limit=
// No authentication - the public species catalog. Published plants only,
// and never any coordinates: a list would let someone collect the GPS of
// every plant at once. Only the area name is shown, and only when the
// Officer allowed location to be shown at all. Each plant has its first
// photo as cover_photo_url.
// Open a plant with GET /api/public/plants/qr/:qr_code for the full view.
async function listPublicPlants(req, res) {
  try {
    const paging = parsePaging(req.query);
    if (paging.error) {
      return res.status(400).json({ error: paging.error });
    }

    const params = [];
    let searchCondition = '';
    if (req.query.search && req.query.search.trim()) {
      params.push(likePattern(req.query.search));
      searchCondition = `AND (scientific_name ILIKE $1 ESCAPE '\\' OR common_name ILIKE $1 ESCAPE '\\' OR family ILIKE $1 ESCAPE '\\')`;
    }
    params.push(paging.limit, paging.offset);

    const { rows } = await pool.query(
      `SELECT p.qr_code, p.common_name, p.scientific_name, p.family, p.genus, p.species, p.conservation_status,
              p.location_visibility, p.general_location, ${COVER_PHOTO_SQL} AS cover_photo_url,
              COUNT(*) OVER () AS total
       FROM plants p
       WHERE p.publication_status = 'Published' ${searchCondition}
       ORDER BY COALESCE(p.common_name, p.scientific_name), p.plant_id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      plants: rows.map(buildPublicListItem),
      total: rows.length > 0 ? Number(rows[0].total) : 0,
      page: paging.page,
      limit: paging.limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching plants' });
  }
}

// GET /api/public/plants/qr/:qr_code
// No authentication - this is what a Park Visitor hits when they scan a
// QR code in the park.
async function getPublicPlantByQrCode(req, res) {
  try {
    const { qr_code } = req.params;

    const { rows } = await pool.query('SELECT * FROM plants WHERE qr_code = $1', [qr_code]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No plant found for this QR code' });
    }

    const plant = rows[0];

    // Not published yet -> public sees nothing, regardless of location_visibility.
    if (!isPublished(plant)) {
      return res.status(404).json({ error: 'This plant record is not yet published' });
    }

    const { rows: photos } = await pool.query(
      'SELECT photo_id, photo_url FROM plant_photos WHERE plant_id = $1 ORDER BY uploaded_at, photo_id',
      [plant.plant_id]
    );
    res.json(buildPublicView(plant, photos));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while looking up QR code' });
  }
}

module.exports = { listPublicPlants, getPublicPlantByQrCode };
