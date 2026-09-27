// User account management for the admin panel. Row Level Security lets
// conservation officers/admins read every profile, but only admins can
// change one (see the `profiles_update_admin_only` policy in schema.sql).
import { supabase } from '../supabaseClient';

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// updates is a partial object, e.g. { role: 'admin' } or { is_active: false }.
export async function updateUser(id, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', id);
  if (error) throw error;
}
