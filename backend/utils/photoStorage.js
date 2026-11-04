const { supabase, PHOTO_BUCKET, ORIGINAL_BUCKET } = require('../config/supabase');

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
// it, so the files are removed from both buckets too (the public copy and the private
// original). `photos` are plant_photos rows: { photo_url, original_path }.
// A failure here is only logged - the plant is already gone and the request must not
// fail because of it.
async function removePhotoFiles(photos) {
  const publicPaths = photos.map((p) => storagePathFromUrl(p.photo_url)).filter(Boolean);
  const originalPaths = photos.map((p) => p.original_path).filter(Boolean);
  for (const [bucket, paths] of [[PHOTO_BUCKET, publicPaths], [ORIGINAL_BUCKET, originalPaths]]) {
    if (paths.length === 0) continue;
    try {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) console.error(`Could not remove photo files from ${bucket}:`, error);
    } catch (err) {
      console.error(`Could not remove photo files from ${bucket}:`, err);
    }
  }
}

module.exports = { storagePathFromUrl, removePhotoFiles };
