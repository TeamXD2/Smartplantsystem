// Checks plant fields against the database column limits (see plants table),
// so bad input gets a clear 400 message instead of a MySQL error / 500.

// Max length per text column. VARCHAR sizes come from the schema; TEXT
// columns are capped at 10000 characters to stay well under MySQL's 64KB.
const TEXT_LIMITS = {
  common_name: 150,
  scientific_name: 150,
  family: 100,
  genus: 100,
  species: 100,
  conservation_status: 100,
  morphological_notes: 10000,
  surrounding_environment: 10000,
  ecological_role: 10000,
  medicinal_use: 10000,
  cultural_significance: 10000
};

// [min, max] per numeric column. Height/width are DECIMAL(6,2) -> max 9999.99.
const NUMBER_RANGES = {
  height_cm: [0, 9999.99],
  width_cm: [0, 9999.99],
  latitude: [-90, 90],
  longitude: [-180, 180]
};

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// Validates only the fields present in `input` (unknown fields are ignored).
// Returns { errors, values }: `values` has blanks turned into null, text
// trimmed and numeric strings (e.g. "150") turned into numbers.
function validatePlantFields(input) {
  const errors = [];
  const values = {};

  for (const [field, raw] of Object.entries(input)) {
    if (field in TEXT_LIMITS) {
      if (isBlank(raw)) {
        values[field] = null;
      } else if (typeof raw !== 'string') {
        errors.push(`${field} must be text`);
      } else if (raw.trim().length > TEXT_LIMITS[field]) {
        errors.push(`${field} must be at most ${TEXT_LIMITS[field]} characters`);
      } else {
        values[field] = raw.trim();
      }
    } else if (field in NUMBER_RANGES) {
      const [min, max] = NUMBER_RANGES[field];
      const number = typeof raw === 'string' ? Number(raw.trim()) : raw;
      if (isBlank(raw)) {
        values[field] = null;
      } else if (typeof number !== 'number' || !Number.isFinite(number)) {
        errors.push(`${field} must be a number`);
      } else if (number < min || number > max) {
        errors.push(`${field} must be between ${min} and ${max}`);
      } else {
        values[field] = number;
      }
    }
  }

  // scientific_name is NOT NULL in the database.
  if ('scientific_name' in input && isBlank(input.scientific_name)) {
    errors.push('scientific_name is required');
  }

  // A GPS point needs both halves - only checked when both are being set.
  if ('latitude' in values && 'longitude' in values &&
      (values.latitude === null) !== (values.longitude === null)) {
    errors.push('latitude and longitude must be provided together');
  }

  return { errors, values };
}

module.exports = { validatePlantFields };
