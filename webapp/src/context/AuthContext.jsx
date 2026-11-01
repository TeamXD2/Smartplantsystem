// Signs the user in through the backend (POST /api/auth/login) and keeps the
// returned token. `user` is what the backend says about the logged-in person:
// { user_id, full_name, email, role_name, botanist_type }.
import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // After a page reload: if a token was saved, ask the backend who it belongs to.
  // A rejected token (expired, or the account was deactivated) signs you out - api()
  // already clears it on a 401. A failed connection does NOT: the token is kept and
  // the check is tried once more, so a weak signal in the park doesn't log you out.
  useEffect(() => {
    if (!tokenStore.get()) {
      setInitialized(true);
      return undefined;
    }
    let cancelled = false;
    async function restore(retry) {
      try {
        const data = await api('/api/auth/me');
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          tokenStore.clear();
        } else if (retry && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (!cancelled) return restore(false);
        }
      }
      return undefined;
    }
    restore(true).finally(() => { if (!cancelled) setInitialized(true); });
    return () => { cancelled = true; };
  }, []);

  // api() fires this when the backend rejects the saved token.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  async function login(email, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
