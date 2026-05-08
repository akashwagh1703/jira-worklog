// Phase 3 auth client. Talks to /api/auth/* endpoints over the existing
// API_BASE_URL. Always sends credentials (session cookie).

import axios from 'axios';
import { API_BASE_URL, APP_BASE_PATH } from '../config/constants';

// Important: every auth-related request needs the cookie to flow.
// Setting it once globally means jiraService.js (issues.php / worklogs.php /
// users.php) also gets the session cookie when the gate is enabled later.
axios.defaults.withCredentials = true;

// Top-level GET to /auth/login.php triggers the OIDC redirect; we replace
// window.location so the browser follows the chain (this app -> IdP -> back).
export const ssoLoginRedirect = (next = '/') => {
  const url = `${API_BASE_URL}/auth/login.php?next=${encodeURIComponent(next)}`;
  window.location.href = url;
};

export const ssoLogout = async () => {
  try {
    await axios.post(`${API_BASE_URL}/auth/logout.php`);
  } catch {
    // ignore — we still want the client-side cleanup to happen
  }
};

// Returns: { authenticated, user, oidcEnabled, oidcConfigured }
// `user` shape: { email, displayName, role, scope: { projects: '*'|[...] }, lastLogin }
export const fetchMe = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/auth/me.php`);
    return res.data;
  } catch {
    return { authenticated: false, user: null, oidcEnabled: false, oidcConfigured: false };
  }
};

// Admin user-management API.
export const listUsers = async () => {
  const res = await axios.get(`${API_BASE_URL}/auth/admin_users.php`);
  return res.data;
};

export const upsertUser = async ({ email, displayName, role, scope }) => {
  const res = await axios.post(`${API_BASE_URL}/auth/admin_users.php`, {
    email, displayName, role, scope,
  });
  return res.data;
};

export const updateUser = async (email, patch) => {
  const res = await axios.put(
    `${API_BASE_URL}/auth/admin_users.php?email=${encodeURIComponent(email)}`,
    patch
  );
  return res.data;
};

export const deleteUser = async (email) => {
  const res = await axios.delete(
    `${API_BASE_URL}/auth/admin_users.php?email=${encodeURIComponent(email)}`
  );
  return res.data;
};

// Helper used by App.jsx after legacy logout to send the user back to the
// SPA login screen on the right base path.
export const goToLogin = () => {
  window.location.href = APP_BASE_PATH + 'login';
};
