// Shared logic for changing plant records, used by direct edits
// (plantController) and approved edit requests (requestController).

// Columns that can be changed after registration.
// (qr_code, plant_id, registered_by, timestamps etc. are never editable.)
const EDITABLE_FIELDS = [
  'common_name', 'scientific_name', 'family', 'genus', 'species',
  'height_cm', 'width_cm', 'morphological_notes', 'surrounding_environment',
  'latitude', 'longitude', 'conservation_status', 'ecological_role',
  'medicinal_use', 'cultural_significance'
];

// Human-readable labels for the plant history view, e.g. "Height" instead
// of "height_cm". Any field not listed here just falls back to its column name.
const FIELD_LABELS = {
  common_name: 'Common Name',
  scientific_name: 'Scientific Name',
  family: 'Family',
  genus: 'Genus',
  species: 'Species',
  height_cm: 'Height',
  width_cm: 'Width',
  morphological_notes: 'Morphological Notes',
  surrounding_environment: 'Surrounding Environment',
  latitude: 'Latitude',
  longitude: 'Longitude',
  conservation_status: 'Conservation Status',
  ecological_role: 'Ecological Role',
  medicinal_use: 'Medicinal Use',
  cultural_significance: 'Cultural Significance'
};

function formatValue(field, value) {
  if (value === null || value === undefined) return '(empty)';
  if (field === 'height_cm' || field === 'width_cm') return `${value}cm`;
  return String(value);
}

// Keeps only whitelisted fields from a client-supplied object.
function pickEditableFields(input) {
  const picked = {};
  for (const key of Object.keys(input)) {
    if (EDITABLE_FIELDS.includes(key)) {
      picked[key] = input[key];
    }
  }
  return picked;
}

// Applies `changes` to one plant inside the caller's transaction and returns
// the "old value -> new value" list for the audit log, or null if the plant
// doesn't exist. Field names are re-checked against the whitelist because
// they go straight into the SQL.
async function applyPlantChanges(connection, plantId, changes) {
  const fields = Object.keys(changes).filter((f) => EDITABLE_FIELDS.includes(f));

  const [beforeRows] = await connection.query(
    `SELECT ${fields.join(', ')} FROM plants WHERE plant_id = ? FOR UPDATE`,
    [plantId]
  );
  if (beforeRows.length === 0) {
    return null;
  }
  const before = beforeRows[0];

  await connection.query(
    `UPDATE plants SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE plant_id = ?`,
    [...fields.map((f) => changes[f]), plantId]
  );

  return fields.map((f) => ({
    field: f,
    label: FIELD_LABELS[f] || f,
    old_value: before[f],
    new_value: changes[f],
    summary: `${FIELD_LABELS[f] || f}: ${formatValue(f, before[f])} → ${formatValue(f, changes[f])}`
  }));
}

module.exports = { EDITABLE_FIELDS, pickEditableFields, applyPlantChanges };
