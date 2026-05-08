<?php
require_once __DIR__ . '/jira_service.php';
require_once __DIR__ . '/cache_helper.php';
require_once __DIR__ . '/auth_helper.php';

authCorsHeaders();

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

try {
    // Mode A — single issue: GET /worklogs.php?issueKey=PROJ-123
    if ($method === 'GET') {
        $issueKey = isset($_GET['issueKey']) ? trim($_GET['issueKey']) : '';
        if ($issueKey === '' || !preg_match('/^[A-Za-z][A-Za-z0-9_]*-\d+$/', $issueKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Valid 'issueKey' query parameter is required"]);
            exit;
        }

        $cacheTtl = 300;
        $key      = cacheKey(['worklog-single', $issueKey]);
        $cached   = cacheGet($key, $cacheTtl);
        if ($cached !== null) {
            echo json_encode(['success' => true, 'cached' => true, 'data' => $cached]);
            exit;
        }

        $url  = JIRA_BASE_URL . '/rest/api/3/issue/' . urlencode($issueKey) . '/worklog';
        $resp = jiraCurlRequest('GET', $url);
        if (!$resp['success']) {
            http_response_code($resp['code']);
            echo json_encode(['success' => false, 'message' => 'Jira request failed', 'details' => $resp['data']]);
            exit;
        }

        $worklogs = $resp['data']['worklogs'] ?? [];
        cacheSet($key, $worklogs);
        echo json_encode(['success' => true, 'cached' => false, 'data' => $worklogs]);
        exit;
    }

    // Mode B — bulk:
    //   POST /worklogs.php
    //   Body: { "issueKeys": ["A-1","A-2"], "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "author": "<displayName|email|accountId>" }
    if ($method === 'POST') {
        $input     = json_decode(file_get_contents('php://input'), true) ?: [];
        $issueKeys = $input['issueKeys'] ?? [];
        $startDate = $input['startDate'] ?? null;
        $endDate   = $input['endDate']   ?? null;
        $author    = isset($input['author']) ? trim($input['author']) : null;

        if (empty($issueKeys) || !is_array($issueKeys)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "'issueKeys' must be a non-empty array"]);
            exit;
        }

        // Cap to protect Jira API rate limits
        $issueKeys = array_slice(array_unique($issueKeys), 0, 500);

        $cacheTtl = 300;
        $key      = cacheKey(['worklog-bulk', $issueKeys, $startDate, $endDate, $author]);
        $cached   = cacheGet($key, $cacheTtl);
        if ($cached !== null) {
            echo json_encode(['success' => true, 'cached' => true] + $cached);
            exit;
        }

        $bulk = jiraFetchWorklogsBulk($issueKeys);

        $startTs = $startDate ? strtotime($startDate . ' 00:00:00') : null;
        $endTs   = $endDate   ? strtotime($endDate   . ' 23:59:59') : null;

        $allWorklogs = [];
        foreach ($bulk['data'] as $issueKey => $worklogs) {
            foreach ($worklogs as $wl) {
                if ($startTs !== null && $endTs !== null) {
                    $when = strtotime($wl['started'] ?? $wl['created'] ?? '');
                    if ($when === false || $when < $startTs || $when > $endTs) continue;
                }
                if ($author) {
                    $a = $wl['author'] ?? [];
                    $matchesAuthor =
                        ($a['displayName']  ?? '') === $author ||
                        ($a['emailAddress'] ?? '') === $author ||
                        ($a['accountId']    ?? '') === $author;
                    if (!$matchesAuthor) continue;
                }
                $wl['issueKey'] = $issueKey;
                $allWorklogs[]  = $wl;
            }
        }

        $payload = [
            'data'  => $allWorklogs,
            'count' => count($allWorklogs),
        ];
        cacheSet($key, $payload);
        echo json_encode(['success' => true, 'cached' => false] + $payload);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
