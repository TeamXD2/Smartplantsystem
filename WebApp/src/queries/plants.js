// All reads/writes for plant records go through this file, so components
// never talk to Supabase directly - they just call a function with a
// clear name. Row Level Security (defined in supabase/schema.sql) is what
// actually enforces who can see or change what; these functions don't
// need to check roles themselves.
import { supabase } from '../supabaseClient';

const PHOTO_BUCKET = 'plant-photos';

// Uploads a photo to Supabase Storage and returns its public URL.
// Returns null if no file was given (photo is optional).
async function uploadPhoto(file) {
  if (!file) return null;

  const path = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Adds each plant's submitter name for display in tables.
// This is two simple queries instead of one SQL join, because `plants`
// has two foreign keys pointing at `profiles` (submitted_by and
// reviewed_by), which makes a single embedded Supabase query ambiguous.
async function attachSubmitterNames(plants) {
  const ids = [...new Set(plants.map((p) => p.submitted_by))];
  if (ids.length === 0) return plants;

  const { data: profiles, error } = await supabase.from('profiles').select('id, name').in('id', ids);
  if (error) throw error;

  const nameById = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  return plants.map((p) => ({ ...p, submitted_by_name: nameById[p.submitted_by] || 'Unknown' }));
}

// ---- Public species catalog (no login required) - approved records only ----
// RLS also enforces this server-side; the .eq('status', 'approved') here
// just avoids asking for rows we know we won't get back.

export async function fetchPublicPlants(search = '') {
  let query = supabase.from('plants').select('*').eq('status', 'approved').order('common_name');

  if (search) {
    query = query.or(
      `scientific_name.ilike.%${search}%,common_name.ilike.%${search}%,family.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchPublicPlant(id) {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .single();
  if (error) throw error;
  return data;
}

// ---- Signed-in views ----
// Row Level Security decides what "my plants" actually means: a botanist
// gets back only their own submissions, while a conservation officer or
// admin gets every submission. The query itself is identical either way.

export async function fetchMyPlants({ status, search } = {}) {
  let query = supabase.from('plants').select('*').order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`scientific_name.ilike.%${search}%,common_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return attachSubmitterNames(data);
}

// Submits a new field record. RLS requires submitted_by to match the
// signed-in user, so we always set it from the current session.
export async function submitPlant(fields, imageFile) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const image_path = await uploadPhoto(imageFile);

  const { error } = await supabase.from('plants').insert({ ...fields, image_path, submitted_by: user.id });
  if (error) throw error;
}

// Edits a record's details. RLS only allows this if you're the submitter
// and the record is still 'pending', or you're a conservation officer/admin.
export async function updatePlant(id, fields, imageFile) {
  const updates = { ...fields };
  if (imageFile) updates.image_path = await uploadPhoto(imageFile);

  const { error } = await supabase.from('plants').update(updates).eq('id', id);
  if (error) throw error;
}

// Approves or rejects a submission. RLS restricts this to conservation
// officers and admins.
export async function reviewPlant(id, status, reviewNote) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('plants')
    .update({ status, review_note: reviewNote || null, reviewed_by: user.id })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePlant(id) {
  const { error } = await supabase.from('plants').delete().eq('id', id);
  if (error) throw error;
}
