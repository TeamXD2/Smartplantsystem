const fs = require('fs/promises');
const pool = require('../config/db');
const { generateQrCodeString, generateQrCodeImage } = require('../utils/qrcode');
const { logAction } = require('../utils/auditLog');
const { validatePlantFields } = require('../utils/validatePlant');
const { pickEditableFields, applyPlantChanges } = require('../utils/plantChanges');

// Fields considered "full detail" - restricted for an External Botanist
// unless they are assigned to this specific plant (see botanist_assignments).
const FULL_DETAIL_FIELDS = [
  'morphological_notes', 'surrounding_environment', 'latitude', 'longitude',
  'height_cm', 'width_cm', 'general_location'
];

// mysql2 returns JSON columns already parsed, TEXT columns as strings.
function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

// Returns true if this user is allowed to see full detail on this plant.
// Internal Botanist / Conservation Officer / Admin -> always true.
// External Botanist -> true only if assigned to this plant_id.
async function canSeeFullDetail(user, plant_id) {
  if (user.role_name !== 'Botanist' || user.botanist_type !== 'External') {
    return true;
  }
  const [rows] = await pool.query(
    'SELECT 1 FROM botanist_assignments WHERE botanist_id = ? AND plant_id = ?',
    [user.user_id, plant_id]
  );
  return rows.length > 0;
}

// Strips the full-detail fields from a plant row (used for unassigned
// External Botanists viewing a plant outside their assignment).
function stripToBasicInfo(plantRow) {
  const basic = { ...plantRow };
  FULL_DETAIL_FIELDS.forEach((field) => delete basic[field]);
  return basic;
}

// POST /api/plants
// New plants start as 'Under Research' (schema default), so nothing is public
// until a Conservation Officer/Admin publishes it via /visibility.
// An External Botanist is automatically assigned to the plant they register,
// so they can keep working on it (full detail, photos, edit requests).
async function createPlant(req, res) {
  let connection;
  try {
    const { errors, values } = validatePlantFields({
      common_name: req.body.common_name,
      scientific_name: req.body.scientific_name,
      family: req.body.family,
      genus: req.body.genus,
      species: req.body.species,
      height_cm: req.body.height_cm,
      width_cm: req.body.width_cm,
      morphological_notes: req.body.morphological_notes,
      surrounding_environment: req.body.surrounding_environment,
      latitude: req.body.latitude,
      longitude: req.body.longitude
    });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }
    const {
      common_name, scientific_name, family, genus, species,
      height_cm, width_cm, morphological_notes, surrounding_environment,
      latitude, longitude
    } = values;

    const qr_code = generateQrCodeString();
    const registered_by = req.user.user_id;
    const isExternalBotanist = req.user.role_name === 'Botanist' && req.user.botanist_type === 'External';

    // Plant + assignment are written together, so an External Botanist never
    // ends up with a plant they registered but can't access.
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO plants
        (qr_code, common_name, scientific_name, family, genus, species,
         height_cm, width_cm, morphological_notes, surrounding_environment,
         latitude, longitude, registered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qr_code, common_name, scientific_name, family, genus, species,
        height_cm, width_cm, morphological_notes, surrounding_environment,
        latitude, longitude, registered_by
      ]
    );

    if (isExternalBotanist) {
      await connection.query(
        'INSERT INTO botanist_assignments (botanist_id, plant_id, assigned_by) VALUES (?, ?, ?)',
        [registered_by, result.insertId, registered_by]
      );
    }

    await connection.commit();

    const qrImage = await generateQrCodeImage(qr_code);

    await logAction({
      user_id: registered_by,
      action: 'CREATE_PLANT',
      target_table: 'plants',
      target_id: result.insertId,
      details: { scientific_name, qr_code, auto_assigned: isExternalBotanist }
    });

    res.status(201).json({
      message: 'Plant registered successfully',
      plant_id: result.insertId,
      qr_code,
      qr_code_image: qrImage,
      publication_status: 'Under Research'
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error while registering plant' });
  } finally {
    if (connection) connection.release();
  }
}

// GET /api/plants/:id  (authenticated staff)
async function getPlantById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query('SELECT * FROM plants WHERE plant_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    let plant = rows[0];

    const fullDetail = await canSeeFullDetail(req.user, id);
    if (!fullDetail) {
      plant = stripToBasicInfo(plant);
    }

    const [photos] = await pool.query(
      'SELECT photo_id, photo_url, uploaded_at FROM plant_photos WHERE plant_id = ?',
      [id]
    );

    res.json({ ...plant, photos, full_detail: fullDetail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching plant' });
  }
}

// GET /api/plants/qr/:qr_code  (authenticated staff - internal QR lookup)
async function getPlantByQrCode(req, res) {
  try {
    const { qr_code } = req.params;

    const [rows] = await pool.query('SELECT * FROM plants WHERE qr_code = ?', [qr_code]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No plant found for this QR code' });
    }

    let plant = rows[0];
    const fullDetail = await canSeeFullDetail(req.user, plant.plant_id);
    if (!fullDetail) {
      plant = stripToBasicInfo(plant);
    }

    res.json({ ...plant, full_detail: fullDetail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while looking up QR code' });
  }
}

// PATCH /api/plants/:id  (Internal Botanist / Conservation Officer / Admin)
// Direct edit, no approval needed - every change is recorded in audit_logs
// with old and new values. External Botanists must submit an EDIT request
// via POST /api/requests instead.
async function updatePlant(req, res) {
  const { id } = req.params;

  if (req.user.role_name === 'Botanist' && req.user.botanist_type === 'External') {
    return res.status(403).json({ error: 'External Botanists must submit an edit request via POST /api/requests' });
  }

  const changes = pickEditableFields(req.body || {});
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: 'No valid editable fields provided' });
  }
  const { errors, values } = validatePlantFields(changes);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const fieldChanges = await applyPlantChanges(connection, id, values);
    if (!fieldChanges) {
      await connection.rollback();
      return res.status(404).json({ error: 'Plant not found' });
    }

    await connection.commit();

    await logAction({
      user_id: req.user.user_id,
      action: 'UPDATE_PLANT',
      target_table: 'plants',
      target_id: id,
      details: { changes: fieldChanges }
    });

    res.json({ message: 'Plant updated', changes: fieldChanges });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error while updating plant' });
  } finally {
    if (connection) connection.release();
  }
}

// POST /api/plants/:id/photos
async function uploadPlantPhoto(req, res) {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file uploaded' });
    }

    const [plantRows] = await pool.query('SELECT plant_id FROM plants WHERE plant_id = ?', [id]);
    if (plantRows.length === 0) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Plant not found' });
    }

    if (!(await canSeeFullDetail(req.user, id))) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'You are not assigned to this plant' });
    }

    const photo_url = `/uploads/${req.file.filename}`;
    const uploaded_by = req.user.user_id;

    const [result] = await pool.query(
      'INSERT INTO plant_photos (plant_id, photo_url, uploaded_by) VALUES (?, ?, ?)',
      [id, photo_url, uploaded_by]
    );

    await logAction({
      user_id: uploaded_by,
      action: 'UPLOAD_PHOTO',
      target_table: 'plants',
      target_id: id,
      details: { photo_id: result.insertId, photo_url }
    });

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo_id: result.insertId,
      photo_url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while uploading photo' });
  }
}

// Turns one audit_logs row into a single human-readable sentence, so the
// frontend can just display `summary` without needing to know how each
// action type's `details` is structured. `details` is still returned too,
// in case a screen wants to show the full change list, but most UIs can
// ignore it and only render `summary`.
function buildHistorySummary(log) {
  const who = log.user_name || 'Someone';

  switch (log.action) {
    case 'CREATE_PLANT':
      return `${who} registered this plant`;

    case 'UPLOAD_PHOTO':
      return `${who} uploaded a photo`;

    case 'UPDATE_PLANT': {
      if (log.details && Array.isArray(log.details.changes)) {
        const changeText = log.details.changes.map((c) => c.summary).join(', ');
        return `${who} edited this plant (${changeText})`;
      }
      return `${who} edited this plant`;
    }

    case 'REQUEST_EDIT':
      return `${who} requested an edit`;

    case 'REQUEST_DELETE':
      return `${who} requested deletion`;

    case 'APPROVED_REQUEST': {
      if (log.details && Array.isArray(log.details.changes)) {
        const changeText = log.details.changes.map((c) => c.summary).join(', ');
        return `${who} approved an edit (${changeText})`;
      }
      if (log.details && log.details.deleted_record) {
        return `${who} approved deletion of this plant`;
      }
      return `${who} approved a request`;
    }

    case 'REJECTED_REQUEST':
      return `${who} rejected a request`;

    case 'UPDATE_VISIBILITY':
      return `${who} changed public visibility settings`;

    default:
      return `${who} performed an action (${log.action})`;
  }
}

// GET /api/plants/:id/history  (audit trail for one plant)
// Internal Botanist / Conservation Officer / Admin: always allowed.
// External Botanist: only for plants they are assigned to (see
// botanist_assignments) - not shown in any filtered form for other
// plants, since the audit trail itself (who changed what, when) is
// internal oversight information, not public/partner-facing content.
async function getPlantHistory(req, res) {
  try {
    const { id } = req.params;

    const allowed = await canSeeFullDetail(req.user, id);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this plant\'s history' });
    }

    const [logs] = await pool.query(
      `SELECT a.log_id, a.user_id, u.full_name AS user_name, r.role_name,
              a.action, a.details, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.user_id
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE a.target_table = 'plants' AND a.target_id = ?
       ORDER BY a.created_at DESC`,
      [id]
    );

    const logsWithSummary = logs.map((log) => {
      const parsed = { ...log, details: parseJson(log.details) };
      return { ...parsed, summary: buildHistorySummary(parsed) };
    });

    res.json(logsWithSummary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching plant history' });
  }
}

// PATCH /api/plants/:id/visibility  (Conservation Officer / Admin)
// Controls what Park Visitors see via the public QR endpoint.
async function updateVisibility(req, res) {
  try {
    const { id } = req.params;
    const { publication_status, location_visibility, general_location } = req.body;

    if (publication_status !== undefined && !['Under Research', 'Published'].includes(publication_status)) {
      return res.status(400).json({ error: "publication_status must be 'Under Research' or 'Published'" });
    }
    if (location_visibility !== undefined && !['Public', 'Approximate', 'Hidden'].includes(location_visibility)) {
      return res.status(400).json({ error: "location_visibility must be 'Public', 'Approximate' or 'Hidden'" });
    }
    // The schema defaults location_visibility to 'Public', so publishing without
    // an explicit choice would expose exact GPS. Force the Officer to decide.
    if (publication_status === 'Published' && location_visibility === undefined) {
      return res.status(400).json({
        error: "location_visibility ('Public', 'Approximate' or 'Hidden') must be set when publishing"
      });
    }

    const updates = { publication_status, location_visibility, general_location };
    const fields = Object.keys(updates).filter((f) => updates[f] !== undefined);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const [result] = await pool.query(
      `UPDATE plants SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE plant_id = ?`,
      [...fields.map((f) => updates[f]), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    await logAction({
      user_id: req.user.user_id,
      action: 'UPDATE_VISIBILITY',
      target_table: 'plants',
      target_id: id,
      details: Object.fromEntries(fields.map((f) => [f, updates[f]]))
    });

    res.json({ message: 'Visibility updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while updating visibility' });
  }
}

module.exports = {
  createPlant,
  getPlantById,
  getPlantByQrCode,
  uploadPlantPhoto,
  getPlantHistory,
  updatePlant,
  updateVisibility,
  canSeeFullDetail,
  stripToBasicInfo,
  parseJson
};
