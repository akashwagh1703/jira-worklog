// Branding & deployment configuration. All values can be overridden via Vite env vars
// (VITE_*) at build time. Defaults match the ESDS-wide deployment layout:
//   SPA  →  /esds-worklogs/
//   API  →  /esds-worklogs/jira-api/
// Override via VITE_APP_BASE_PATH / VITE_API_BASE_URL when self-hosting.

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'ESDS Worklog Dashboard';
export const APP_TAGLINE = import.meta.env.VITE_APP_TAGLINE || 'Employee Analytics Dashboard';

// Public base path the SPA is served from (must match vite.config.js `base` and .htaccess RewriteBase).
// Trailing slash is required.
export const APP_BASE_PATH = import.meta.env.VITE_APP_BASE_PATH || '/esds-worklogs/';

// React Router basename never ends with a slash.
export const APP_ROUTER_BASENAME = APP_BASE_PATH.replace(/\/$/, '');

// PHP backend (proxy + projects API + Phase 2-5 endpoints).
// Convention: SPA at https://dev.famrut.com/esds-worklogs/login → API at
// https://dev.famrut.com/esds-worklogs/jira-api (no trailing slash).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://dev.famrut.com/esds-worklogs/jira-api';

export const PROXY_URL = `${API_BASE_URL}/proxy.php`;

// Phase 2 feature flag: when true, management users fetch issues/worklogs/users
// through the backend (issues.php, worklogs.php, users.php) using the system
// Jira service account. Employees keep using their own credentials via proxy.php
// until SSO + RBAC land in Phase 3/4.
//
// Default: false (so deployments stay on the legacy path until they're ready).
// Set VITE_USE_BACKEND_JIRA=true in .env.production to enable.
export const USE_BACKEND_JIRA =
  String(import.meta.env.VITE_USE_BACKEND_JIRA || '').toLowerCase() === 'true';

// Jira REST API endpoints (path only — joined with each user's base URL at request time).
export const API_ENDPOINTS = {
  MYSELF: '/rest/api/3/myself',
  SEARCH: '/rest/api/3/search/jql',
  WORKLOG: (issueKey) => `/rest/api/3/issue/${issueKey}/worklog`,
  WORKLOG_UPDATED: '/rest/api/3/worklog/updated',
  BOARDS: '/rest/agile/1.0/board',
};

export const DEFAULT_FIELDS =
  'summary,status,assignee,project,issuetype,created,updated,duedate,priority';
export const MAX_RESULTS = 100;
export const DEFAULT_JQL_DAYS = 90;
