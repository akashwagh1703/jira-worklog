<?php
require_once __DIR__ . '/jira_service.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$path = $_GET['path'] ?? '';
$projectKey = isset($_GET['projectKey']) ? trim($_GET['projectKey']) : null;

// Validate projectKey if provided
if ($projectKey !== null && !preg_match('/^[a-zA-Z0-9_\-]+$/', $projectKey)) {
    sendJson(['success' => false, 'message' => 'Invalid project key'], 400);
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $path === 'list') {
        $startAt    = isset($_GET['startAt'])    ? max(0, intval($_GET['startAt']))    : 0;
        $maxResults = isset($_GET['maxResults']) ? min(50, intval($_GET['maxResults'])) : 50;

        $result = fetchAllJiraProjects($startAt, $maxResults);
        if (!$result['success']) {
            sendJson(['success' => false, 'message' => 'Jira fetch failed', 'details' => $result['data']], $result['code']);
        }
        sendJson(['success' => true, 'data' => $result['data']]);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $path === 'detail' && $projectKey) {
        $projectResp = fetchJiraProjectByKey($projectKey);
        if (!$projectResp['success']) {
            sendJson(['success' => false, 'message' => 'Jira project fetch failed', 'details' => $projectResp['data']], $projectResp['code']);
        }

        // Pass real issueTypes from project so counts are dynamic not hardcoded
        $issueTypes = $projectResp['data']['issueTypes'] ?? [];
        $statsResp  = fetchJiraProjectIssueCounts($projectKey, $issueTypes);
        if (!$statsResp['success']) {
            sendJson(['success' => false, 'message' => 'Jira project stats fetch failed', 'details' => $statsResp['data']], $statsResp['code']);
        }

        $sprintResp = fetchActiveSprint($projectKey);
        $sprint     = $sprintResp['success'] ? $sprintResp['data'] : null;

        sendJson(['success' => true, 'project' => $projectResp['data'], 'stats' => $statsResp['data'], 'sprint' => $sprint]);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $path === 'refresh' && $projectKey) {
        // For refresh, re-fetch project to get issueTypes too
        $projectResp = fetchJiraProjectByKey($projectKey);
        $issueTypes  = $projectResp['success'] ? ($projectResp['data']['issueTypes'] ?? []) : [];

        $statsResp = fetchJiraProjectIssueCounts($projectKey, $issueTypes);
        if (!$statsResp['success']) {
            sendJson(['success' => false, 'message' => 'Jira fetch failed', 'details' => $statsResp['data']], $statsResp['code']);
        }
        $sprintResp = fetchActiveSprint($projectKey);
        $sprint     = $sprintResp['success'] ? $sprintResp['data'] : null;

        sendJson(['success' => true, 'message' => 'Refreshed project stats', 'stats' => $statsResp['data'], 'sprint' => $sprint]);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $path === 'debug' && $projectKey) {
        $raw = jiraSearchJql('project = "' . $projectKey . '"');
        sendJson([
            'success'     => $raw['success'],
            'httpCode'    => $raw['code'],
            'total_found' => $raw['data']['total'] ?? 'MISSING',
            'raw_keys'    => array_keys($raw['data'] ?? []),
            'full_raw'    => $raw['raw'],
        ]);

    } else {
        sendJson(['success' => false, 'message' => 'Invalid API call'], 400);
    }
} catch (Exception $ex) {
    sendJson(['success' => false, 'message' => 'Internal server error'], 500);
}
