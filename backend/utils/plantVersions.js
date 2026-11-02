// Plant versions: a full copy of a plant's editable fields after every change,
// kept in plant_versions (see schema.sql). Used when a plant is registered,
// edited directly, or changed by an approved edit request.

const { EDITABLE_FIELDS } = require('./plantChanges');

const SOURCES = ['REGISTER', 'EDIT', 'REQUEST', 'BACKFILL'];
const FIELD_LIST = EDITABLE_FIELDS.join(', ');
const PLANT_FIELD_LIST = EDITABLE_FIELDS.map((f) => `p.${f}`).join(', ');

// Copies the plant's current row into plant_versions as the next version.
// Must run inside the caller's transaction, after the plant row is written,
// so the plant and its version are saved together or not at all. Edits lock
// the plant row first (applyPlantChanges uses FOR UPDATE), so two edits can't
// pick the same version number.
async function saveVersion(connection, plantId, { source, changedBy, approvedBy = null, requestId = null, note = null }) {
  if (!SOURCES.includes(source)) {
    throw new Error(`Unknown plant version source: ${source}`);
  }
  await connection.query(
    `INSERT INTO plant_versions
       (plant_id, version_no, qr_code, ${FIELD_LIST}, source, changed_by, approved_by, request_id, note)
     SELECT p.plant_id,
            COALESCE((SELECT MAX(v.version_no) FROM plant_versions v WHERE v.plant_id = p.plant_id), 0) + 1,
            p.qr_code, ${PLANT_FIELD_LIST}, $2, $3, $4, $5, $6
     FROM plants p
     WHERE p.plant_id = $1`,
    [plantId, source, changedBy, approvedBy, requestId, note]
  );
}

// Makes sure a plant has a version 1 before it is changed. Plants registered
// before plant_versions existed (or while a backend without it was running)
// have none, and without this their first edit would become "version 1" and
// the record as it was before the edit would be lost. Call it before
// applyPlantChanges, inside the same transaction.
async function ensureFirstVersion(connection, plantId) {
  // Lock the plant row first, so two edits arriving together can't both add a version 1.
  await connection.query('SELECT 1 FROM plants WHERE plant_id = $1 FOR UPDATE', [plantId]);
  await connection.query(
    `INSERT INTO plant_versions
       (plant_id, version_no, qr_code, ${FIELD_LIST}, source, changed_by, created_at)
     SELECT p.plant_id, 1, p.qr_code, ${PLANT_FIELD_LIST}, 'BACKFILL', p.registered_by, p.updated_at
     FROM plants p
     WHERE p.plant_id = $1
       AND NOT EXISTS (SELECT 1 FROM plant_versions v WHERE v.plant_id = p.plant_id)`,
    [plantId]
  );
}

module.exports = { saveVersion, ensureFirstVersion };
