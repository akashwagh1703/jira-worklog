<?php
require_once __DIR__ . '/jira_config.php';

function jiraCurlRequest($method, $url, $payload = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, getDefaultJiraHeaders());

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }
    } elseif ($method === 'PUT' || $method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }
    }

    $body       = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'error' => $curlError, 'code' => 500, 'data' => null];
    }

    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $data = $body;
    }

    return [
        'success' => $statusCode >= 200 && $statusCode < 300,
        'code'    => $statusCode,
        'data'    => $data,
        'raw'     => $body
    ];
}

// ─── CHANGE-2046 Migration ────────────────────────────────────────────────────
// Old removed: GET /rest/api/3/search?jql=...&maxResults=N
// New correct: GET /rest/api/3/search/jql?jql=...&maxResults=N
//
// Key facts from Atlassian CHANGE-2046:
// 1. New endpoint path is /rest/api/3/search/jql
// 2. GET method still works on the NEW path (POST also works)
// 3. GET with maxResults=0 returns total count without fetching issue bodies
// 4. Response shape is IDENTICAL to old endpoint: { total, issues, startAt, maxResults }
// 5. Only the PATH changed — everything else (params, response) stays the same
// ─────────────────────────────────────────────────────────────────────────────

function jiraSearchJql($jql) {
    // POST to /rest/api/3/search/jql
    // Use maxResults=5000 (Jira max) so response always includes 'total'
    // When all results fit in one page, Jira returns total reliably.
    // We only read response['total'], not the issues array.
    $url = JIRA_BASE_URL . '/rest/api/3/search/jql';
    $payload = [
        'jql'        => $jql,
        'maxResults' => 5000,
        'fields'     => ['id']
    ];

    $result = jiraCurlRequest('POST', $url, $payload);

    if ($result['success'] && isset($result['data'])) {
        // total is at response root — if missing count issues array as last resort
        if (!isset($result['data']['total'])) {
            $result['data']['total'] = count($result['data']['issues'] ?? []);
        }
    }

    return $result;
}

// Generic JQL search returning full issue records. Used by issues.php / users.php.
function jiraSearchIssues($jql, $fields = ['summary', 'status', 'assignee', 'project', 'issuetype', 'created', 'updated', 'duedate', 'priority'], $maxResults = 100, $startAt = 0) {
    $url = JIRA_BASE_URL . '/rest/api/3/search/jql';
    $payload = [
        'jql'        => $jql,
        'fields'     => is_array($fields) ? $fields : explode(',', $fields),
        'maxResults' => max(1, min(100, intval($maxResults))),
        'startAt'    => max(0, intval($startAt)),
    ];
    return jiraCurlRequest('POST', $url, $payload);
}

// Fetch worklogs for many issues in parallel using curl_multi.
// Returns: ['success' => bool, 'data' => [issueKey => [worklog,...]]]
function jiraFetchWorklogsBulk($issueKeys) {
    if (empty($issueKeys) || !is_array($issueKeys)) {
        return ['success' => true, 'data' => []];
    }

    $multi = curl_multi_init();
    $handles = [];

    foreach ($issueKeys as $issueKey) {
        // Defensive: only allow Jira-shaped keys (PROJ-123)
        if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*-\d+$/', $issueKey)) {
            continue;
        }
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => JIRA_BASE_URL . '/rest/api/3/issue/' . urlencode($issueKey) . '/worklog',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => getDefaultJiraHeaders(),
            CURLOPT_TIMEOUT        => 30,
        ]);
        curl_multi_add_handle($multi, $ch);
        $handles[$issueKey] = $ch;
    }

    $running = null;
    do {
        $status = curl_multi_exec($multi, $running);
        if ($running) {
            curl_multi_select($multi, 0.5);
        }
    } while ($running > 0 && $status === CURLM_OK);

    $result = [];
    foreach ($handles as $issueKey => $ch) {
        $body       = curl_multi_getcontent($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);

        if ($statusCode >= 200 && $statusCode < 300) {
            $decoded = json_decode($body, true);
            $result[$issueKey] = $decoded['worklogs'] ?? [];
        } else {
            $result[$issueKey] = []; // soft-fail per issue, don't kill the whole batch
        }
    }
    curl_multi_close($multi);

    return ['success' => true, 'data' => $result];
}

function fetchAllJiraProjects($startAt = 0, $maxResults = 50) {
    $url = JIRA_BASE_URL . '/rest/api/3/project/search'
         . '?startAt='    . intval($startAt)
         . '&maxResults=' . intval($maxResults)
         . '&action=browse';
    return jiraCurlRequest('GET', $url);
}

function fetchJiraProjectByKey($projectKey) {
    $url = JIRA_BASE_URL . '/rest/api/3/project/' . urlencode($projectKey);
    return jiraCurlRequest('GET', $url);
}

function fetchActiveSprint($projectKey) {
    // Step 1: find board for this project
    $boardUrl = JIRA_BASE_URL . '/rest/agile/1.0/board?projectKeyOrId=' . urlencode($projectKey) . '&maxResults=1';
    $boardResp = jiraCurlRequest('GET', $boardUrl);
    if (!$boardResp['success'] || empty($boardResp['data']['values'])) {
        return ['success' => false, 'data' => null]; // no board — non-fatal
    }

    $boardId = $boardResp['data']['values'][0]['id'];

    // Step 2: get active sprint on that board
    $sprintUrl = JIRA_BASE_URL . '/rest/agile/1.0/board/' . intval($boardId) . '/sprint?state=active&maxResults=1';
    $sprintResp = jiraCurlRequest('GET', $sprintUrl);
    if (!$sprintResp['success'] || empty($sprintResp['data']['values'])) {
        return ['success' => false, 'data' => null]; // no active sprint — non-fatal
    }

    $sprint = $sprintResp['data']['values'][0];
    $sprintId = $sprint['id'];

    // Step 3: get issue counts for this sprint
    $sprintJql      = 'project = "' . $projectKey . '" AND sprint = ' . intval($sprintId);
    $sprintDoneJql  = $sprintJql . ' AND statusCategory = Done';

    $sprintTotalResp = jiraSearchJql($sprintJql);
    $sprintDoneResp  = jiraSearchJql($sprintDoneJql);

    $sprintTotal = $sprintTotalResp['success'] ? (int)($sprintTotalResp['data']['total'] ?? 0) : 0;
    $sprintDone  = $sprintDoneResp['success']  ? (int)($sprintDoneResp['data']['total']  ?? 0) : 0;
    $sprintCompletion = $sprintTotal > 0 ? round(($sprintDone / $sprintTotal) * 100, 2) : 0;

    return ['success' => true, 'data' => [
        'id'         => $sprintId,
        'name'       => $sprint['name']       ?? 'Active Sprint',
        'state'      => $sprint['state']      ?? 'active',
        'startDate'  => $sprint['startDate']  ?? null,
        'endDate'    => $sprint['endDate']    ?? null,
        'goal'       => $sprint['goal']       ?? null,
        'total'      => $sprintTotal,
        'done'       => $sprintDone,
        'completion' => $sprintCompletion,
    ]];
}

function fetchJiraProjectIssueCounts($projectKey, $issueTypes = []) {
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $projectKey)) {
        return ['success' => false, 'error' => 'Invalid project key', 'code' => 400, 'data' => null];
    }

    $baseJql       = 'project = "' . $projectKey . '"';
    $doneJql       = $baseJql . ' AND statusCategory = Done';
    $inProgressJql = $baseJql . ' AND statusCategory = "In Progress"';

    // --- Status counts ---
    $totalResp = jiraSearchJql($baseJql);
    if (!$totalResp['success']) return $totalResp;
    $total = (int)($totalResp['data']['total'] ?? 0);

    if ($total === 0) {
        return ['success' => true, 'data' => [
            'total'      => 0, 'done' => 0, 'inProgress' => 0, 'todo' => 0, 'completion' => 0,
            'priority'   => ['high' => 0, 'medium' => 0, 'low' => 0],
            'issueTypes' => []
        ]];
    }

    $doneResp = jiraSearchJql($doneJql);
    if (!$doneResp['success']) return $doneResp;
    $done = (int)($doneResp['data']['total'] ?? 0);

    $inProgressResp = jiraSearchJql($inProgressJql);
    if (!$inProgressResp['success']) return $inProgressResp;
    $inProgress = (int)($inProgressResp['data']['total'] ?? 0);

    $todo       = max(0, $total - $done - $inProgress);
    $completion = round(($done / $total) * 100, 2);

    // --- Priority counts ---
    $highResp   = jiraSearchJql($baseJql . ' AND priority = High');
    $mediumResp = jiraSearchJql($baseJql . ' AND priority = Medium');
    $lowResp    = jiraSearchJql($baseJql . ' AND priority = Low');
    $high   = $highResp['success']   ? (int)($highResp['data']['total']   ?? 0) : 0;
    $medium = $mediumResp['success'] ? (int)($mediumResp['data']['total'] ?? 0) : 0;
    $low    = $lowResp['success']    ? (int)($lowResp['data']['total']    ?? 0) : 0;

    // --- Issue type counts (dynamic from project issueTypes, parent types only) ---
    $issueTypeCounts = [];
    foreach ($issueTypes as $type) {
        if (!empty($type['subtask'])) continue; // skip sub-tasks
        $name     = $type['name'];
        $typeResp = jiraSearchJql($baseJql . ' AND issuetype = "' . addslashes($name) . '"');
        $issueTypeCounts[$name] = $typeResp['success'] ? (int)($typeResp['data']['total'] ?? 0) : 0;
    }

    return ['success' => true, 'data' => [
        'total'      => $total,
        'done'       => $done,
        'inProgress' => $inProgress,
        'todo'       => $todo,
        'completion' => $completion,
        'priority'   => ['high' => $high, 'medium' => $medium, 'low' => $low],
        'issueTypes' => $issueTypeCounts,
    ]];
}

function sendJson($payload, $httpCode = 200) {
    header('Content-Type: application/json');
    http_response_code($httpCode);
    echo json_encode($payload);
    exit;
}
