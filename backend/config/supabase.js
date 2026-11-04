const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Server-side Supabase client, used for photo storage (Supabase Storage).
// It uses the service_role key, which bypasses all security rules - it must
// only ever live in this backend's .env, never in the mobile or web app.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Public bucket: the metadata-free copies that visitors see.
const PHOTO_BUCKET = process.env.SUPABASE_PHOTO_BUCKET || 'plant-photos';
// PRIVATE bucket: the untouched uploads (EXIF and GPS included), opened by staff only
// through short-lived signed links.
const ORIGINAL_BUCKET = process.env.SUPABASE_ORIGINAL_BUCKET || 'plant-photos-original';

module.exports = { supabase, PHOTO_BUCKET, ORIGINAL_BUCKET };
