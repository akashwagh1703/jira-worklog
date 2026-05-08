// API Configuration
export const API_BASE_URL = 'https://dev.famrut.com/famrut-team-logs/api';
// export const API_BASE_URL = 'http://localhost/jira-api';

export const PROXY_URL = `${API_BASE_URL}/proxy.php`;

// Jira API Endpoints
export const API_ENDPOINTS = {
  MYSELF: '/rest/api/3/myself',
  SEARCH: '/rest/api/3/search/jql',
  WORKLOG: (issueKey) => `/rest/api/3/issue/${issueKey}/worklog`,
  WORKLOG_UPDATED: '/rest/api/3/worklog/updated',
  BOARDS: '/rest/agile/1.0/board'
};

export const DEFAULT_FIELDS = 'summary,status,assignee,project,issuetype,created,updated,duedate,priority';
export const MAX_RESULTS = 100;
export const DEFAULT_JQL_DAYS = 90;