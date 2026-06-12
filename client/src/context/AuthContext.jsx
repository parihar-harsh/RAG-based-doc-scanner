import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  setAuthToken,
  signup as apiSignup,
} from '../services/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'talk-to-my-doc-token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const persistSession = useCallback((authData) => {
    localStorage.setItem(TOKEN_KEY, authData.token);
    setAuthToken(authData.token);
    setToken(authData.token);
    setUser(authData.user);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthToken(token);

    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadUser() {
      try {
        const res = await getCurrentUser();
        if (!cancelled) setUser(res.data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [token, clearSession]);

  const login = useCallback(async (credentials) => {
    const res = await apiLogin(credentials);
    persistSession(res.data);
    return res.data.user;
  }, [persistSession]);

  const signup = useCallback(async (payload) => {
    const res = await apiSignup(payload);
    persistSession(res.data);
    return res.data.user;
  }, [persistSession]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Local logout should still complete if the token is already invalid.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    signup,
    logout,
  }), [user, token, loading, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
