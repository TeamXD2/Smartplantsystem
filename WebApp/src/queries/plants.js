// Plant records, all through the backend API. The backend decides who may see or
// change what (roles, External Botanist assignments, publication rules); these
// functions only call it.
import { api } from '../api';

// ---- Public catalog (no login). Published plants only: no photos, and GPS only
// when an Officer set the location to "Public". Plants are identified by QR code.

export function fetchPublicPlants({ search, page, limit } = {}) {
  return api('/api/public/plants', { auth: false, params: { search, page, limit } });
}

export function fetchPublicPlant(qrCode) {
  return api(`/api/public/plants/qr/${encodeURIComponent(qrCode)}`, { auth: false });
}

// ---- Staff ----

// params: { search, publication_status, mine: 'true', page, limit }
export function fetchPlants(params) {
  return api('/api/plants', { params });
}

export function fetchPlant(id) {
  return api(`/api/plants/${id}`);
}

export function fetchPlantHistory(id) {
  return api(`/api/plants/${id}/history`);
}

export function uploadPhoto(plantId, file) {
  const form = new FormData();
  form.append('photo', file);
  return api(`/api/plants/${plantId}/photos`, { method: 'POST', form });
}

// Registers a plant, then uploads the photo (two requests in the API). If only
// the photo fails the record still exists, so that's reported separately.
// Returns { plant_id, qr_code, qr_code_image, photoError }.
export async function registerPlant(fields, imageFile) {
  const created = await api('/api/plants', { method: 'POST', body: fields });
  let photoError = null;
  if (imageFile) {
    try {
      await uploadPhoto(created.plant_id, imageFile);
    } catch (err) {
      photoError = err.message;
    }
  }
  return { ...created, photoError };
}

// Direct edit: Internal Botanist, Conservation Officer, Admin.
export function updatePlant(id, changes) {
  return api(`/api/plants/${id}`, { method: 'PATCH', body: changes });
}

// Officer / Admin: publish or unpublish and choose how much location visitors see.
export function setVisibility(id, { publication_status, location_visibility, general_location }) {
  return api(`/api/plants/${id}/visibility`, {
    method: 'PATCH',
    body: { publication_status, location_visibility, general_location },
  });
}

// Officer / Admin only. Botanists send a delete request instead (queries/requests.js).
export function deletePlant(id) {
  return api(`/api/plants/${id}`, { method: 'DELETE' });
}
