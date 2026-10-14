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
  // This also catches a token that expired or an account that was deactivated.
  useEffect(() => {
    if (!tokenStore.get()) {
      setInitialized(true);
      return;
    }
    api('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setInitialized(true));
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
