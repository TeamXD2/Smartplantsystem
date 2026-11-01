// The columns of the species CSV, shared by the Reports page and "Export selected".
export const PLANT_COLUMNS = [
  { label: 'QR code', value: 'qr_code' },
  { label: 'Scientific name', value: 'scientific_name' },
  { label: 'Common name', value: 'common_name' },
  { label: 'Family', value: 'family' },
  { label: 'Genus', value: 'genus' },
  { label: 'Species', value: 'species' },
  { label: 'Conservation status', value: 'conservation_status' },
  { label: 'Publication status', value: 'publication_status' },
  { label: 'Location visibility', value: 'location_visibility' },
  { label: 'General location', value: 'general_location' },
  { label: 'Latitude', value: 'latitude' },
  { label: 'Longitude', value: 'longitude' },
  { label: 'Registered by', value: 'registered_by_name' },
  { label: 'Registered on', value: (r) => (r.created_at ? r.created_at.slice(0, 10) : '') },
  { label: 'Last updated', value: (r) => (r.updated_at ? r.updated_at.slice(0, 10) : '') },
];
