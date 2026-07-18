import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from '@/api/auth';
import { setAccessToken, setSessionExpiredHandler } from '@/api/client';

const AuthContext = createContext(null);

/**
 * Holds the authenticated user and the in-memory access token.
 *
 * On boot it attempts a silent refresh: if the HTTP-only refresh cookie is
 * still valid, the session is restored without the user re-entering
 * credentials. Otherwise the app renders signed-out.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const applySession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Let the axios layer drop us to signed-out when a refresh ultimately fails.
  useEffect(() => {
    setSessionExpiredHandler(() => clearSession());
  }, [clearSession]);

  // Restore the session once on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await authApi.refresh();
        if (cancelled) return;
        setAccessToken(session.accessToken);
        // Fetch the freshest user record rather than trusting the refresh body.
        const currentUser = await authApi.me();
        if (cancelled) return;
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        if (!cancelled) clearSession();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const session = await authApi.login(credentials);
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload) => {
      const session = await authApi.register(payload);
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  /** Merge server-sourced fields into the cached user (profile edits, verify). */
  const patchUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      register,
      logout,
      patchUser,
      applySession,
    }),
    [user, status, login, register, logout, patchUser, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
