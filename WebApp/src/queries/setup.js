// First-run admin setup. See the "FIRST-RUN ADMIN SETUP" section of
// supabase/schema.sql for the two database functions this calls - the
// actual "has an admin been created yet?" check and the one-time
// promotion both happen in the database, not here, so the browser can
// never grant admin access on its own.
import { supabase } from '../supabaseClient';

// Anyone, even a signed-out visitor, can check whether the admin
// account has been set up yet.
export async function checkAdminExists() {
  const { data, error } = await supabase.rpc('admin_exists');
  if (error) throw error;
  return data;
}

// Promotes the currently signed-in user to admin. Only succeeds if no
// admin account exists yet - enforced by the database, not this code.
export async function claimFirstAdmin() {
  const { error } = await supabase.rpc('claim_first_admin');
  if (error) throw error;
}
