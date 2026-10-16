const { supabase, PHOTO_BUCKET } = require('../config/supabase');

// plant_photos.photo_url is the public link; Storage needs the path inside the
// bucket (e.g. "plants/12/1739...-ab12.jpg"). Returns null for foreign URLs.
function storagePathFromUrl(url) {
  const marker = `/object/public/${PHOTO_BUCKET}/`;
  const index = String(url).indexOf(marker);
  if (index === -1) return null;
  try {
    return decodeURIComponent(String(url).slice(index + marker.length).split('?')[0]);
  } catch {
    return null;
  }
}

// Best effort: when a plant is deleted its plant_photos rows disappear with
// it, so the files are removed from the bucket too. A failure here is only
// logged - the plant is already gone and the request must not fail because of it.
async function removePhotoFiles(photoUrls) {
  const paths = photoUrls.map(storagePathFromUrl).filter(Boolean);
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) console.error('Could not remove photo files from Storage:', error);
  } catch (err) {
    console.error('Could not remove photo files from Storage:', err);
  }
}

module.exports = { storagePathFromUrl, removePhotoFiles };
