import axios from 'axios';
import { PROXY_URL, API_ENDPOINTS, DEFAULT_FIELDS, MAX_RESULTS, DEFAULT_JQL_DAYS, API_BASE_URL } from '../config/constants';

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
  try {
    if (config.useCorsProxy) {
      return await axios.post(url, {
        url: originalUrl,
        headers: {
          'Authorization': createAuthHeader(config.email, config.apiToken),
          'Content-Type': 'application/json'
        }
      });
    }
    return await axios.get(url, {
      headers: {
        'Authorization': createAuthHeader(config.email, config.apiToken),
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    throw error;
  }
};

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

export const fetchIssues = async (currentUser, jiraConfig, projectKey, customJql) => {
  const config = currentUser?.jiraCredentials || jiraConfig;
  try {
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
      
      if (onProgress) {
        onProgress(allIssues.length, total);
      }
      
      if (issues.length < MAX_RESULTS) break;
    } while (allIssues.length < total);
    
    return { success: true, data: allIssues, total };
  } catch (error) {
    console.error('fetchIssuesWithPagination error:', error.message);
    return { success: false, error: error.message, data: allIssues, total };
  }
};

export const fetchWorklogsByDateRange = async (currentUser, jiraConfig, startDate, endDate) => {
  const config = currentUser?.jiraCredentials || jiraConfig;
  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime();
  
  try {
    const originalUrl = `${config.baseUrl}${API_ENDPOINTS.WORKLOG_UPDATED}?since=${startTimestamp}`;
    const url = getProxiedUrl(originalUrl, config.useCorsProxy, config.proxyUrl);
    const response = await makeRequest(url, config, originalUrl);
    
    const worklogIds = response.data.values || [];
    const filteredIds = worklogIds.filter(wl => {
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

// Projects module — PHP backend API
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
