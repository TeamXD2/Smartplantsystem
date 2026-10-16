const crypto = require('crypto');
const pool = require('../config/db');
const { supabase, PHOTO_BUCKET } = require('../config/supabase');
const { MIME_TO_EXT } = require('../middleware/upload');
const { detectImageType } = require('../utils/imageType');
const { removePhotoFiles } = require('../utils/photoStorage');
const { generateQrCodeString, generateQrCodeImage } = require('../utils/qrcode');
const { logAction } = require('../utils/auditLog');
const { validatePlantFields } = require('../utils/validatePlant');
const { pickEditableFields, applyPlantChanges } = require('../utils/plantChanges');
const { parsePaging, likePattern } = require('../utils/listQuery');
const { isPublished, buildPublicView, buildPublicListItem, COVER_PHOTO_SQL } = require('../utils/publicView');

// pg returns JSON/JSONB columns already parsed, TEXT columns as strings.
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
  const { rows } = await pool.query(
    'SELECT 1 FROM botanist_assignments WHERE botanist_id = $1 AND plant_id = $2',
    [user.user_id, plant_id]
  );
  return rows.length > 0;
}

// What an External Botanist sees of a plant they aren't assigned to:
// exactly what a Park Visitor sees (published plants only, location as the
// Officer allowed, with photos). Returns null for unpublished plants, which
// the caller answers with a plain 404 so it doesn't reveal the plant exists.
function restrictedView(plant, photos) {
  if (!isPublished(plant)) {
    return null;
  }
  return { plant_id: plant.plant_id, ...buildPublicView(plant, photos), full_detail: false };
}

// A plant's photos, oldest first.
async function getPhotos(plantId) {
  const { rows } = await pool.query(
    'SELECT photo_id, photo_url, uploaded_at FROM plant_photos WHERE plant_id = $1 ORDER BY uploaded_at, photo_id',
    [plantId]
  );
  return rows;
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
    connection = await pool.connect();
    await connection.query('BEGIN');

    const { rows: [created] } = await connection.query(
      `INSERT INTO plants
        (qr_code, common_name, scientific_name, family, genus, species,
         height_cm, width_cm, morphological_notes, surrounding_environment,
         latitude, longitude, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING plant_id`,
      [
        qr_code, common_name, scientific_name, family, genus, species,
        height_cm, width_cm, morphological_notes, surrounding_environment,
        latitude, longitude, registered_by
      ]
    );

    if (isExternalBotanist) {
      await connection.query(
        'INSERT INTO botanist_assignments (botanist_id, plant_id, assigned_by) VALUES ($1, $2, $3)',
        [registered_by, created.plant_id, registered_by]
      );
    }

    await connection.query('COMMIT');

    const qrImage = await generateQrCodeImage(qr_code);

    await logAction({
      user_id: registered_by,
      action: 'CREATE_PLANT',
      target_table: 'plants',
      target_id: created.plant_id,
      details: { scientific_name, qr_code, auto_assigned: isExternalBotanist }
    });

    res.status(201).json({
      message: 'Plant registered successfully',
      plant_id: created.plant_id,
      qr_code,
      qr_code_image: qrImage,
      publication_status: 'Under Research'
    });
  } catch (err) {
    if (connection) await connection.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error while registering plant' });
  } finally {
    if (connection) connection.release();
  }
}

// GET /api/plants?search=&publication_status=&mine=true&page=&limit=
// (authenticated staff) - plant list for dashboards / "my records".
// Summary columns plus GPS, e.g. for a map (no size or notes). External
// Botanists get their assigned plants plus published ones, and for unassigned
// plants only the public catalog fields (GPS only if the Officer chose Public). full_detail says whether opening the plant with
// GET /api/plants/:id will show everything.
async function listPlants(req, res) {
  try {
    const paging = parsePaging(req.query);
    if (paging.error) {
      return res.status(400).json({ error: paging.error });
    }
    const { search, publication_status, mine } = req.query;
    if (publication_status !== undefined && !['Under Research', 'Published'].includes(publication_status)) {
      return res.status(400).json({ error: "publication_status must be 'Under Research' or 'Published'" });
    }

    const isExternalBotanist = req.user.role_name === 'Botanist' && req.user.botanist_type === 'External';
    const params = [req.user.user_id];
    const conditions = [];

    if (search && search.trim()) {
      params.push(likePattern(search));
      const n = params.length;
      conditions.push(
        `(p.scientific_name ILIKE $${n} ESCAPE '\\' OR p.common_name ILIKE $${n} ESCAPE '\\' OR p.family ILIKE $${n} ESCAPE '\\')`
      );
    }
    if (publication_status) {
      params.push(publication_status);
      conditions.push(`p.publication_status = $${params.length}`);
    }
    if (mine === 'true') {
      conditions.push('p.registered_by = $1');
    }
    if (isExternalBotanist) {
      conditions.push("(p.publication_status = 'Published' OR ba.assignment_id IS NOT NULL)");
    }
    params.push(paging.limit, paging.offset);

    const { rows } = await pool.query(
      `SELECT p.plant_id, p.qr_code, p.common_name, p.scientific_name, p.family, p.genus, p.species,
              p.conservation_status, p.publication_status, p.location_visibility, p.general_location,
              p.latitude, p.longitude,
              p.registered_by, u.full_name AS registered_by_name, p.created_at, p.updated_at,
              ${COVER_PHOTO_SQL} AS cover_photo_url,
              (ba.assignment_id IS NOT NULL) AS assigned_to_me,
              COUNT(*) OVER () AS total
       FROM plants p
       JOIN users u ON u.user_id = p.registered_by
       LEFT JOIN botanist_assignments ba ON ba.plant_id = p.plant_id AND ba.botanist_id = $1
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY p.created_at DESC, p.plant_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const plants = rows.map(({ total, assigned_to_me, ...plant }) => (
      isExternalBotanist && !assigned_to_me
        ? { plant_id: plant.plant_id, ...buildPublicListItem(plant), full_detail: false }
        : { ...plant, full_detail: true }
    ));

    res.json({
      plants,
      total: rows.length > 0 ? Number(rows[0].total) : 0,
      page: paging.page,
      limit: paging.limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching plants' });
  }
}

// GET /api/plants/:id  (authenticated staff)
async function getPlantById(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query('SELECT * FROM plants WHERE plant_id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = rows[0];
    const photos = await getPhotos(id);

    if (!(await canSeeFullDetail(req.user, id))) {
      const view = restrictedView(plant, photos);
      return view ? res.json(view) : res.status(404).json({ error: 'Plant not found' });
    }

    res.json({ ...plant, photos, full_detail: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching plant' });
  }
}

// GET /api/plants/qr/:qr_code  (authenticated staff - internal QR lookup)
async function getPlantByQrCode(req, res) {
  try {
    const { qr_code } = req.params;

    const { rows } = await pool.query('SELECT * FROM plants WHERE qr_code = $1', [qr_code]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No plant found for this QR code' });
    }

    const plant = rows[0];
    const photos = await getPhotos(plant.plant_id);
    if (!(await canSeeFullDetail(req.user, plant.plant_id))) {
      const view = restrictedView(plant, photos);
      return view ? res.json(view) : res.status(404).json({ error: 'No plant found for this QR code' });
    }

    res.json({ ...plant, photos, full_detail: true });
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
    connection = await pool.connect();
    await connection.query('BEGIN');

    const fieldChanges = await applyPlantChanges(connection, id, values);
    if (!fieldChanges) {
      await connection.query('ROLLBACK');
      return res.status(404).json({ error: 'Plant not found' });
    }

    await connection.query('COMMIT');

    await logAction({
      user_id: req.user.user_id,
      action: 'UPDATE_PLANT',
      target_table: 'plants',
      target_id: id,
      details: { changes: fieldChanges }
    });

    res.json({ message: 'Plant updated', changes: fieldChanges });
  } catch (err) {
    if (connection) await connection.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error while updating plant' });
  } finally {
    if (connection) connection.release();
  }
}

// Most photos one plant can have, so a single account can't fill the bucket.
const MAX_PHOTOS_PER_PLANT = 20;

// POST /api/plants/:id/photos
// The file's real type is read from its first bytes (the type the client
// claims is not trusted), and that real type decides the stored extension and
// content type. The image data itself is stored untouched: EXIF metadata,
// including GPS, is intentionally kept.
async function uploadPlantPhoto(req, res) {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file uploaded' });
    }

    const realType = detectImageType(req.file.buffer);
    if (!realType) {
      return res.status(400).json({ error: 'The file is not a valid JPEG, PNG or WebP image' });
    }

    const { rows: plantRows } = await pool.query('SELECT plant_id FROM plants WHERE plant_id = $1', [id]);
    if (plantRows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    if (!(await canSeeFullDetail(req.user, id))) {
      return res.status(403).json({ error: 'You are not assigned to this plant' });
    }

    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) AS count FROM plant_photos WHERE plant_id = $1', [id]);
    if (Number(count) >= MAX_PHOTOS_PER_PLANT) {
      return res.status(409).json({ error: `A plant can have at most ${MAX_PHOTOS_PER_PLANT} photos` });
    }

    // Upload to Supabase Storage as plants/<id>/<time>-<random>.<ext>
    const storagePath = `plants/${id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${MIME_TO_EXT[realType]}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, req.file.buffer, { contentType: realType });
    if (uploadError) {
      console.error('Supabase Storage upload failed:', uploadError);
      return res.status(502).json({ error: 'Could not store the photo, please try again' });
    }

    const photo_url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
    const uploaded_by = req.user.user_id;

    let created;
    try {
      ({ rows: [created] } = await pool.query(
        'INSERT INTO plant_photos (plant_id, photo_url, uploaded_by) VALUES ($1, $2, $3) RETURNING photo_id',
        [id, photo_url, uploaded_by]
      ));
    } catch (err) {
      // Don't leave an orphaned file in the bucket if the database insert fails.
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => {});
      throw err;
    }

    await logAction({
      user_id: uploaded_by,
      action: 'UPLOAD_PHOTO',
      target_table: 'plants',
      target_id: id,
      details: { photo_id: created.photo_id, photo_url }
    });

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo_id: created.photo_id,
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

    case 'DELETE_PLANT':
      return `${who} deleted this plant`;

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

    const { rows: logs } = await pool.query(
      `SELECT a.log_id, a.user_id, u.full_name AS user_name, r.role_name,
              a.action, a.details, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.user_id
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE a.target_table = 'plants' AND a.target_id = $1
       ORDER BY a.created_at DESC, a.log_id DESC`,
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
    if (general_location !== undefined && general_location !== null &&
        (typeof general_location !== 'string' || general_location.length > 150)) {
      return res.status(400).json({ error: 'general_location must be text of at most 150 characters' });
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

    const result = await pool.query(
      `UPDATE plants SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE plant_id = $${fields.length + 1}`,
      [...fields.map((f) => updates[f]), id]
    );
    if (result.rowCount === 0) {
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

// DELETE /api/plants/:id  (Conservation Officer / Admin)
// Direct delete, no request needed. The full record is kept in the audit log
// and the photo files are removed from Storage. Botanists can't call this:
// they ask for a deletion via POST /api/requests instead.
async function deletePlant(req, res) {
  const { id } = req.params;
  let connection;
  let photoUrls = [];
  let deleted;

  try {
    connection = await pool.connect();
    await connection.query('BEGIN');

    const { rows } = await connection.query('SELECT * FROM plants WHERE plant_id = $1 FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.query('ROLLBACK');
      return res.status(404).json({ error: 'Plant not found' });
    }
    deleted = rows[0];

    const { rows: photos } = await connection.query('SELECT photo_url FROM plant_photos WHERE plant_id = $1', [id]);
    photoUrls = photos.map((p) => p.photo_url);

    // plant_photos and botanist_assignments go with it (ON DELETE CASCADE);
    // change requests keep their snapshot and just lose the plant_id.
    await connection.query('DELETE FROM plants WHERE plant_id = $1', [id]);
    await connection.query('COMMIT');
  } catch (err) {
    if (connection) await connection.query('ROLLBACK').catch(() => {});
    console.error(err);
    return res.status(500).json({ error: 'Server error while deleting plant' });
  } finally {
    if (connection) connection.release();
  }

  await logAction({
    user_id: req.user.user_id,
    action: 'DELETE_PLANT',
    target_table: 'plants',
    target_id: id,
    details: { deleted_record: deleted }
  });
  await removePhotoFiles(photoUrls);

  res.json({ message: 'Plant deleted' });
}

module.exports = {
  createPlant,
  listPlants,
  getPlantById,
  getPlantByQrCode,
  uploadPlantPhoto,
  getPlantHistory,
  updatePlant,
  updateVisibility,
  deletePlant,
  canSeeFullDetail,
  parseJson
};
