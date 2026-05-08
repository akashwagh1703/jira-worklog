<?php
// Jira config values. Override with environment variables in production.
// Example in Apache: SetEnv JIRA_BASE_URL https://your-domain.atlassian.net

define('JIRA_BASE_URL', getenv('JIRA_BASE_URL') ?: '');
define('JIRA_EMAIL',     getenv('JIRA_EMAIL')     ?: '');
define('JIRA_API_TOKEN', getenv('JIRA_API_TOKEN') ?: '');

// For basic auth header
function getJiraAuthorizationHeader() {
    $credentials = JIRA_EMAIL . ':' . JIRA_API_TOKEN;
    return 'Authorization: Basic ' . base64_encode($credentials);
}

function getDefaultJiraHeaders() {
    return [
        getJiraAuthorizationHeader(),
        'Content-Type: application/json',
        'Accept: application/json',
    ];
}
