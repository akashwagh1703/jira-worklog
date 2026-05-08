import axios from 'axios';
import { PROXY_URL, API_ENDPOINTS, DEFAULT_FIELDS, MAX_RESULTS, DEFAULT_JQL_DAYS } from '../config/constants';

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
    return axios.post(url, {
      url: originalUrl,
      headers: {
        'Authorization': createAuthHeader(config.email, config.apiToken),
        'Content-Type': 'application/json'
      }
    });
  }
  return axios.get(url, {
    headers: {
      'Authorization': createAuthHeader(config.email, config.apiToken),
      'Content-Type': 'application/json'
    }
  });
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
    return { success: true, data: response.data.issues || [] };
  } catch (error) {
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
    return { success: false, error: error.message, data: [] };
  }
};
