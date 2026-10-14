// What someone without full access may see of a plant: Park Visitors, and
// External Botanists looking at a plant they aren't assigned to. Both use
// these same rules, so they always see exactly the same thing.

// Only these columns ever reach the public - new columns stay private by
// default. Height/width/appearance are included since they don't
// meaningfully help someone locate the plant.
const PUBLIC_FIELDS = [
  'qr_code', 'common_name', 'scientific_name', 'family', 'genus', 'species',
  'height_cm', 'width_cm', 'morphological_notes', 'conservation_status',
  'ecological_role', 'medicinal_use', 'cultural_significance'
];

// Fields shown in the public catalog list (no location detail or photos).
const PUBLIC_LIST_FIELDS = [
  'qr_code', 'common_name', 'scientific_name', 'family', 'genus', 'species', 'conservation_status'
];

function isPublished(plant) {
  return plant.publication_status === 'Published';
}

// Location is opt-in: anything other than Public/Approximate (Hidden,
// NULL, a typo) shows no location at all.
function publicGeneralLocation(plant) {
  return ['Public', 'Approximate'].includes(plant.location_visibility) ? plant.general_location : undefined;
}

// Full public view of one published plant (a plants row in, safe object out).
// Callers must check isPublished() first.
function buildPublicView(plant) {
  const view = {};
  PUBLIC_FIELDS.forEach((field) => { view[field] = plant[field]; });

  if (plant.location_visibility === 'Public') {
    view.latitude = plant.latitude;
    view.longitude = plant.longitude;
    view.surrounding_environment = plant.surrounding_environment;
  }
  const generalLocation = publicGeneralLocation(plant);
  if (generalLocation !== undefined) {
    view.general_location = generalLocation; // e.g. "Bakor Forest Area"
  }
  return view;
}

// One row of the public catalog list.
function buildPublicListItem(plant) {
  const item = {};
  PUBLIC_LIST_FIELDS.forEach((field) => { item[field] = plant[field]; });
  item.general_location = publicGeneralLocation(plant) ?? null;
  return item;
}

module.exports = { isPublished, buildPublicView, buildPublicListItem };
