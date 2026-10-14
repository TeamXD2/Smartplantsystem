const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Server-side Supabase client, used for photo storage (Supabase Storage).
// It uses the service_role key, which bypasses all security rules - it must
// only ever live in this backend's .env, never in the mobile or web app.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const PHOTO_BUCKET = process.env.SUPABASE_PHOTO_BUCKET || 'plant-photos';

module.exports = { supabase, PHOTO_BUCKET };
