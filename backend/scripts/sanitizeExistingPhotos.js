// One-off clean-up for photos uploaded BEFORE the public copies were stripped of their
// metadata. Every photo whose original_path is still empty is processed like this:
//
//   1. the file currently in the public bucket (which still has its EXIF/GPS) is copied,
//      untouched, into the private originals bucket;
//   2. the public file is replaced by a re-encoded copy without metadata (same address,
//      so every saved link keeps working);
//   3. plant_photos.original_path is set.
//
// Safe to run again: photos that already have an original are skipped, and an original that
// is already in the private bucket is never overwritten (so a run that stopped half way can
// never replace a real original with an already-cleaned file).
//
//   npm run sanitize-photos -- --dry-run     only report what would happen
//   npm run sanitize-photos                  do it
//
// Note: Supabase serves public files through a cache, so the old version of a replaced
// photo can still be delivered for up to about an hour. Anyone who already downloaded a
// photo keeps the metadata it had.
require('dotenv').config();
const pool = require('../config/db');
const { supabase, PHOTO_BUCKET, ORIGINAL_BUCKET } = require('../config/supabase');
const { storagePathFromUrl } = require('../utils/photoStorage');
const { detectImageType } = require('../utils/imageType');
const { sanitizeImage } = require('../utils/sanitizeImage');

const dryRun = process.argv.includes('--dry-run');

function alreadyExists(error) {
  return error && (String(error.statusCode) === '409' || /already exists|duplicate/i.test(error.message || ''));
}

async function main() {
  const { rows } = await pool.query(
    'SELECT photo_id, photo_url FROM plant_photos WHERE original_path IS NULL ORDER BY photo_id'
  );
  console.log(`${rows.length} photo(s) without a stored original${dryRun ? ' (dry run, nothing will be changed)' : ''}`);

  let done = 0;
  let skipped = 0;
  for (const { photo_id, photo_url } of rows) {
    const path = storagePathFromUrl(photo_url);
    if (!path) {
      console.log(`  #${photo_id}: skipped, the address is not in the "${PHOTO_BUCKET}" bucket`);
      skipped++;
      continue;
    }
    try {
      const { data: blob, error: downloadError } = await supabase.storage.from(PHOTO_BUCKET).download(path);
      if (downloadError) throw new Error(`download failed: ${downloadError.message}`);
      const original = Buffer.from(await blob.arrayBuffer());
      const type = detectImageType(original);
      if (!type) throw new Error('not a JPEG, PNG or WebP image');

      if (dryRun) {
        console.log(`  #${photo_id}: would clean ${path}`);
        continue;
      }

      // 1. keep the original, never overwriting one that is already there
      const { error: keepError } = await supabase.storage
        .from(ORIGINAL_BUCKET)
        .upload(path, original, { contentType: type, upsert: false });
      if (keepError && !alreadyExists(keepError)) throw new Error(`could not keep the original: ${keepError.message}`);

      // 2. replace the public file by the clean copy
      const clean = await sanitizeImage(original, type);
      const { error: replaceError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, clean.buffer, { contentType: clean.contentType, upsert: true });
      if (replaceError) throw new Error(`could not replace the public copy: ${replaceError.message}`);

      // 3. remember where the original is
      await pool.query('UPDATE plant_photos SET original_path = $1 WHERE photo_id = $2', [path, photo_id]);
      console.log(`  #${photo_id}: cleaned ${path}`);
      done++;
    } catch (err) {
      console.log(`  #${photo_id}: skipped, ${err.message}`);
      skipped++;
    }
  }
  console.log(`\nDone: ${done} cleaned, ${skipped} skipped.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
