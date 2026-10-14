// Plant fields as the backend names them (see the "Data model" section of the root README).

// Fields accepted when registering a plant (POST /api/plants).
export const BASE_FIELDS = [
  'scientific_name', 'common_name', 'family', 'genus', 'species',
  'height_cm', 'width_cm', 'morphological_notes', 'surrounding_environment',
  'latitude', 'longitude',
];

// Extra fields that can only be set by editing an existing plant.
export const EXTRA_FIELDS = ['conservation_status', 'ecological_role', 'medicinal_use', 'cultural_significance'];

const NUMERIC = ['height_cm', 'width_cm', 'latitude', 'longitude'];

export const FIELD_LABELS = {
  scientific_name: 'Scientific name',
  common_name: 'Common name',
  family: 'Family',
  genus: 'Genus',
  species: 'Species',
  height_cm: 'Height (cm)',
  width_cm: 'Width (cm)',
  morphological_notes: 'Morphological notes',
  surrounding_environment: 'Surrounding environment',
  latitude: 'Latitude',
  longitude: 'Longitude',
  conservation_status: 'Conservation status',
  ecological_role: 'Ecological role',
  medicinal_use: 'Medicinal use',
  cultural_significance: 'Cultural significance',
};

// Record -> strings for form inputs. The API returns decimals as strings ("50.00").
export function toFormValues(source, fields) {
  const values = {};
  fields.forEach((f) => {
    values[f] = source && source[f] != null ? String(source[f]) : '';
  });
  return values;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

// One form string -> the value to send: blank = null, numeric fields = numbers.
function toApiValue(field, value) {
  if (isBlank(value)) return null;
  return NUMERIC.includes(field) ? Number(value) : String(value).trim();
}

// Whole form -> request body (used when registering).
export function buildPayload(values, fields) {
  const payload = {};
  fields.forEach((f) => {
    payload[f] = toApiValue(f, values[f]);
  });
  return payload;
}

// Only what the user actually changed (used for edits and edit requests), so the
// history doesn't fill up with "X -> X" entries.
export function diffPayload(initial, values, fields) {
  const changes = {};
  fields.forEach((f) => {
    const before = toApiValue(f, initial[f]);
    const after = toApiValue(f, values[f]);
    if (before !== after) changes[f] = after;
  });
  // A GPS point is always sent as a pair.
  if ('latitude' in changes || 'longitude' in changes) {
    changes.latitude = toApiValue('latitude', values.latitude);
    changes.longitude = toApiValue('longitude', values.longitude);
  }
  return changes;
}
