// Wraps Supabase Auth so the rest of the app can just call useAuth().
//
// Supabase keeps two separate things per user:
//   1. auth.users   - handled entirely by Supabase (email, password, session)
//   2. profiles     - our own table (name, role, is_active) - see schema.sql
// `user` below is those two merged together, which is what every
// component in this app actually wants (id + email + name + role).
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, is_active')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Loads whichever session Supabase already has (e.g. from a previous
  // visit), then keeps `user` in sync with sign-in/sign-out from anywhere.
  useEffect(() => {
    async function loadFromSession(session) {
      setUser(session ? await fetchProfile(session.user.id) : null);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadFromSession(session).finally(() => setInitialized(true));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadFromSession(session);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await fetchProfile(data.user.id);
    setUser(profile);
    return profile;
  }

  // New accounts always start as 'botanist' (enforced by the database
  // default, not by this code - see supabase/schema.sql).
  async function register(name, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    // If your Supabase project has "Confirm email" turned on, signUp
    // does not return a session yet - the person must click the emailed
    // link before they can log in.
    if (!data.session) return { confirmationRequired: true };

    const profile = await fetchProfile(data.user.id);
    setUser(profile);
    return { confirmationRequired: false, profile };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
