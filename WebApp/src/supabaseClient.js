// Every part of the app talks to Supabase through this one client.
// It reads its connection details from .env (copy .env.example to .env
// and fill in your own project's URL + publishable key from the Supabase
// dashboard's Connect dialog, or Settings > API Keys).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// createClient() throws immediately if either value is missing, which
// would otherwise crash the whole app at startup with nothing but a
// console error and a blank white page. We track that state here instead
// and let main.jsx show a clear on-screen message rather than a crash.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-key'
);
