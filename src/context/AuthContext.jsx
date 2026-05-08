// Phase 3 AuthContext.
//
// On initial mount it asks the server "who am I?" via /api/auth/me.php.
// If the server replies with a user, that user becomes the source of truth
// (ConfigContext.currentUser is hydrated to keep every existing page working
// without code changes).
//
// Legacy login (the local password tab in LoginPage) still uses ConfigContext
// directly; we don't tear it out yet so deployments that haven't wired SSO
// still work end-to-end.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, ssoLogout } from '../services/authService';
import { useConfig } from './ConfigContext';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { saveCurrentUser } = useConfig();

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({
    authenticated: false,
    user: null,                 // { email, displayName, role, scope, lastLogin }
    oidcEnabled: false,
    oidcConfigured: false,
    via: null,                  // 'sso' | 'legacy' | null
  });

  // Translate the server-side user record into the shape the rest of the
  // app already expects (currentUser in ConfigContext).
  const hydrateLegacyShape = useCallback((user) => {
    if (!user) return;
    const userType = user.role === 'employee' ? 'employee' : 'management';
    saveCurrentUser({
      email: user.email,
      role: user.role,
      userType,
      jiraCredentials: null,    // SSO users use the backend; no per-user token
      rememberMe: true,
      scope: user.scope || { projects: '*' },
      displayName: user.displayName,
    });
    localStorage.setItem('isLoggedIn', 'true');
  }, [saveCurrentUser]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchMe();
    if (data?.authenticated && data.user) {
      setMeta({
        authenticated:   true,
        user:            data.user,
        oidcEnabled:     !!data.oidcEnabled,
        oidcConfigured:  !!data.oidcConfigured,
        via:             'sso',
      });
      hydrateLegacyShape(data.user);
    } else {
      setMeta({
        authenticated:   false,
        user:            null,
        oidcEnabled:     !!data?.oidcEnabled,
        oidcConfigured:  !!data?.oidcConfigured,
        via:             null,
      });
    }
    setLoading(false);
  }, [hydrateLegacyShape]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    // Best-effort destroy of the server session.
    await ssoLogout();
    // Hard-clear local state regardless of rememberMe.
    saveCurrentUser({
      email: '', role: '', userType: '', jiraCredentials: null, rememberMe: false,
    });
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
    setMeta((m) => ({ ...m, authenticated: false, user: null, via: null }));
  }, [saveCurrentUser]);

  const value = useMemo(() => ({
    ...meta,
    loading,
    refresh,
    logout,
  }), [meta, loading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
