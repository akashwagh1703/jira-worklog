import axios from 'axios';
import {
  PROXY_URL,
  API_ENDPOINTS,
  DEFAULT_FIELDS,
  MAX_RESULTS,
  DEFAULT_JQL_DAYS,
  API_BASE_URL,
  USE_BACKEND_JIRA,
} from '../config/constants';
import { getAllowedProjects } from '../config/scope';

// ---------- helpers ----------

const createAuthHeader = (email, apiToken) => {
  const auth = btoa(`${email}:${apiToken}`);
  return `Basic ${auth}`;
};

const getProxiedUrl = (url, useCorsProxy, proxyUrl) => {
  if (useCorsProxy) {
    return proxyUrl || PROXY_URL;
  }
  return url;
};

const makeRequest = async (url, config, originalUrl) => {
  if (config.useCorsProxy) {
    return await axios.post(url, {
      url: originalUrl,
      headers: {
        Authorization: createAuthHeader(config.email, config.apiToken),
        'Content-Type': 'application/json',
      },
    });
  }
  return await axios.get(url, {
    headers: {
      Authorization: createAuthHeader(config.email, config.apiToken),
      'Content-Type': 'application/json',
    },
  });
};

// True when this user's data fetches should be served by the backend service
// account instead of the user's own Jira credentials.
//
// Phase 2 policy: only management users get the backend path. Employees keep
// using their personal credentials so they can only see their own data.
// (Phase 4 will swap this out for proper RBAC enforcement on the server.)
const useBackendFor = (currentUser) =>
  USE_BACKEND_JIRA && currentUser?.userType === 'management';

// ---------- connection test (always uses user's own creds) ----------

export const testConnection = async (config) => {
  try {
    const originalUrl = `${config.baseUrl}${API_ENDPOINTS.MYSELF}`;
    const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
    const response = await makeRequest(url, config, originalUrl);
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    return { success: false, error: errorMsg };
  }
};

// ---------- issues ----------

export const fetchIssues = async (currentUser, jiraConfig, projectKey, customJql) => {
  let jql;
  if (customJql) {
    jql = customJql;
  } else if (projectKey) {
    jql = `project=${projectKey} ORDER BY created DESC`;
  } else if (currentUser?.email) {
    jql = `assignee = "${currentUser.email}" ORDER BY created DESC`;
  } else {
    jql = `created >= -${DEFAULT_JQL_DAYS}d ORDER BY created DESC`;
  }

  if (useBackendFor(currentUser)) {
    try {
      const response = await axios.get(`${API_BASE_URL}/issues.php`, {
        params: { jql, fields: DEFAULT_FIELDS, maxResults: MAX_RESULTS },
      });
      if (response.data?.success === false) {
        return { success: false, error: response.data.message || 'Backend error', data: [], total: 0 };
      }
      return {
        success: true,
        data: response.data.issues || [],
        total: response.data.total || 0,
        cached: response.data.cached === true,
      };
    } catch (error) {
      console.error('fetchIssues (backend) error:', error.message);
      return { success: false, error: error.message, data: [], total: 0 };
    }
  }

  // Legacy path: user's own credentials via proxy
  const config = currentUser?.jiraCredentials || jiraConfig;
  try {
    const originalUrl = `${config.baseUrl}${API_ENDPOINTS.SEARCH}?jql=${encodeURIComponent(jql)}&fields=${DEFAULT_FIELDS}&maxResults=${MAX_RESULTS}`;
    const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
    const response = await makeRequest(url, config, originalUrl);
    return { success: true, data: response.data.issues || [], total: response.data.total || 0 };
  } catch (error) {
    console.error('fetchIssues error:', error.message);
    return { success: false, error: error.message, data: [], total: 0 };
  }
};

export const fetchIssuesWithPagination = async (currentUser, jiraConfig, jql, onProgress) => {
  if (useBackendFor(currentUser)) {
    try {
      const response = await axios.get(`${API_BASE_URL}/issues.php`, {
        params: { jql, fields: DEFAULT_FIELDS, paginate: 'true' },
        timeout: 120000,
      });
      if (response.data?.success === false) {
        return { success: false, error: response.data.message || 'Backend error', data: [], total: 0 };
      }
      const issues = response.data.issues || [];
      const total = response.data.total || issues.length;
      if (onProgress) onProgress(issues.length, total);
      return { success: true, data: issues, total, cached: response.data.cached === true };
    } catch (error) {
      console.error('fetchIssuesWithPagination (backend) error:', error.message);
      return { success: false, error: error.message, data: [], total: 0 };
    }
  }

  // Legacy: walk pages from the browser
  const config = currentUser?.jiraCredentials || jiraConfig;
  let allIssues = [];
  let startAt = 0;
  let total = 0;

  try {
    do {
      const originalUrl = `${config.baseUrl}${API_ENDPOINTS.SEARCH}?jql=${encodeURIComponent(jql)}&fields=${DEFAULT_FIELDS}&maxResults=${MAX_RESULTS}&startAt=${startAt}`;
      const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
      const response = await makeRequest(url, config, originalUrl);

      const issues = response.data.issues || [];
      total = response.data.total || 0;
      allIssues = allIssues.concat(issues);
      startAt += MAX_RESULTS;

      if (onProgress) onProgress(allIssues.length, total);
      if (issues.length < MAX_RESULTS) break;
    } while (allIssues.length < total);

    return { success: true, data: allIssues, total };
  } catch (error) {
    console.error('fetchIssuesWithPagination error:', error.message);
    return { success: false, error: error.message, data: allIssues, total };
  }
};

// ---------- worklogs ----------

export const fetchWorklogsByDateRange = async (currentUser, jiraConfig, startDate, endDate) => {
  // (Used rarely; kept on the user-cred path for compatibility.)
  const config = currentUser?.jiraCredentials || jiraConfig;
  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime();

  try {
    const originalUrl = `${config.baseUrl}${API_ENDPOINTS.WORKLOG_UPDATED}?since=${startTimestamp}`;
    const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
    const response = await makeRequest(url, config, originalUrl);

    const worklogIds = response.data.values || [];
    const filteredIds = worklogIds.filter((wl) => {
      const updated = wl.updated || wl.created;
      return updated >= startTimestamp && updated <= endTimestamp;
    });
    return { success: true, data: filteredIds };
  } catch (error) {
    console.error('fetchWorklogsByDateRange error:', error.message);
    return { success: false, error: error.message, data: [] };
  }
};

export const fetchWorklogs = async (currentUser, jiraConfig, issueKey) => {
  if (useBackendFor(currentUser)) {
    try {
      const response = await axios.get(`${API_BASE_URL}/worklogs.php`, {
        params: { issueKey },
      });
      if (response.data?.success === false) {
        return { success: false, error: response.data.message || 'Backend error', data: [] };
      }
      return { success: true, data: response.data.data || [], cached: response.data.cached === true };
    } catch (error) {
      console.error(`fetchWorklogs (backend) error for ${issueKey}:`, error.message);
      return { success: false, error: error.message, data: [] };
    }
  }

  const config = currentUser?.jiraCredentials || jiraConfig;
  try {
    const originalUrl = `${config.baseUrl}${API_ENDPOINTS.WORKLOG(issueKey)}`;
    const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
    const response = await makeRequest(url, config, originalUrl);
    return { success: true, data: response.data.worklogs || [] };
  } catch (error) {
    console.error(`fetchWorklogs error for ${issueKey}:`, error.message);
    return { success: false, error: error.message, data: [] };
  }
};

// Phase 2 bulk worklog fetch — only available on the backend path.
//
// `issueKeys`: array of Jira keys (e.g. ["FAMRUT-1","FAMRUT-2"]).
// `startDate`/`endDate`: optional YYYY-MM-DD filter window applied server-side.
// `author`: optional displayName / email / accountId filter applied server-side.
// Returns: { success, data: [worklog with .issueKey,...], cached }
//
// When the backend is disabled, this falls back to N parallel calls to
// fetchWorklogs() — same behavior the pages had before — so callers can use
// this function unconditionally.
export const fetchWorklogsBulk = async (
  currentUser,
  jiraConfig,
  issueKeys,
  { startDate = null, endDate = null, author = null } = {}
) => {
  if (!Array.isArray(issueKeys) || issueKeys.length === 0) {
    return { success: true, data: [] };
  }

  if (useBackendFor(currentUser)) {
    try {
      const response = await axios.post(`${API_BASE_URL}/worklogs.php`, {
        issueKeys,
        startDate,
        endDate,
        author,
      });
      if (response.data?.success === false) {
        return { success: false, error: response.data.message || 'Backend error', data: [] };
      }
      return { success: true, data: response.data.data || [], cached: response.data.cached === true };
    } catch (error) {
      console.error('fetchWorklogsBulk (backend) error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Legacy fallback: parallel single-issue calls through user creds.
  const startTs = startDate ? new Date(startDate + 'T00:00:00').getTime() : null;
  const endTs = endDate ? new Date(endDate + 'T23:59:59').getTime() : null;

  const settled = await Promise.all(
    issueKeys.map((issueKey) =>
      fetchWorklogs(currentUser, jiraConfig, issueKey)
        .then((res) => ({ issueKey, res }))
        .catch(() => ({ issueKey, res: { success: false, data: [] } }))
    )
  );

  const collected = [];
  for (const { issueKey, res } of settled) {
    if (!res.success) continue;
    for (const wl of res.data) {
      if (startTs !== null && endTs !== null) {
        const when = new Date(wl.started || wl.created).getTime();
        if (Number.isNaN(when) || when < startTs || when > endTs) continue;
      }
      if (author) {
        const a = wl.author || {};
        const matches =
          a.displayName === author || a.emailAddress === author || a.accountId === author;
        if (!matches) continue;
      }
      collected.push({ ...wl, issueKey });
    }
  }
  return { success: true, data: collected };
};

// ---------- users (Phase 2: backend-only convenience) ----------

// Returns distinct assignees across the configured projects.
// `days` controls how far back we look (default 90). Falls back to
// issue-walking with the user's own creds when the backend is disabled.
export const fetchEmployees = async (currentUser, jiraConfig, days = 90) => {
  if (useBackendFor(currentUser)) {
    try {
      const projects = getAllowedProjects().join(',');
      const response = await axios.get(`${API_BASE_URL}/users.php`, {
        params: { days, projects },
        timeout: 60000,
      });
      if (response.data?.success === false) {
        return { success: false, error: response.data.message || 'Backend error', data: [] };
      }
      return {
        success: true,
        data: response.data.users || [],
        cached: response.data.cached === true,
      };
    } catch (error) {
      console.error('fetchEmployees (backend) error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Legacy: derive from issues we can see with the user's creds.
  const allowed = getAllowedProjects();
  const projectClause =
    allowed && allowed.length
      ? `project IN ("${allowed.map((p) => p.replace(/"/g, '\\"')).join('", "')}") AND `
      : '';
  const jql = `${projectClause}updated >= -${days}d ORDER BY updated DESC`;

  const result = await fetchIssuesWithPagination(currentUser, jiraConfig, jql);
  if (!result.success) {
    return { success: false, error: result.error, data: [] };
  }

  const map = {};
  for (const issue of result.data) {
    const a = issue.fields?.assignee;
    if (!a) continue;
    const key = a.accountId || a.emailAddress || a.displayName;
    if (!key || map[key]) continue;
    map[key] = {
      accountId: a.accountId || null,
      displayName: a.displayName || '',
      emailAddress: a.emailAddress || '',
      avatar: a.avatarUrls?.['48x48'] || null,
    };
  }
  const list = Object.values(map).sort((x, y) => x.displayName.localeCompare(y.displayName));
  return { success: true, data: list };
};

// ---------- boards (legacy, user-cred) ----------

export const fetchBoards = async (config) => {
  try {
    const originalUrl = `${config.baseUrl}${API_ENDPOINTS.BOARDS}`;
    const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
    const response = await makeRequest(url, config, originalUrl);
    return { success: true, data: response.data.values || [] };
  } catch (error) {
    console.error('fetchBoards error:', error.message);
    return { success: false, error: error.message, data: [] };
  }
};

// ---------- projects module (already backend-driven) ----------

export const getAllProjects = async (startAt = 0, maxResults = 50) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects.php?path=list&startAt=${startAt}&maxResults=${maxResults}`);
    return { success: true, data: response.data.data || {}, status: response.status };
  } catch (error) {
    console.error('getAllProjects error:', error.message);
    return { success: false, error: error.response?.data?.message || error.message, status: error.response?.status || 500 };
  }
};

export const getProjectDetails = async (projectKey) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects.php?path=detail&projectKey=${encodeURIComponent(projectKey)}`);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error('getProjectDetails error:', error.message);
    return { success: false, error: error.response?.data?.message || error.message, status: error.response?.status || 500 };
  }
};

export const refreshProject = async (projectKey) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/projects.php?path=refresh&projectKey=${encodeURIComponent(projectKey)}`);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error('refreshProject error:', error.message);
    return { success: false, error: error.response?.data?.message || error.message, status: error.response?.status || 500 };
  }
};
