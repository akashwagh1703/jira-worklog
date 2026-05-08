<?php
require_once __DIR__ . '/jira_service.php';
require_once __DIR__ . '/cache_helper.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/rate_limit_helper.php';

authCorsHeaders();

$me = requireAuth();
requireRateLimit('worklogs', $me);

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

        // Phase 4: deny issues outside the user's scope (best-effort — Jira's
        // permission model is the second line of defense).
        if (!isIssueKeyInScope($issueKey, $me)) {
            auditLog('worklogs.scope_denied', ['issueKey' => $issueKey]);
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Issue is outside your project scope']);
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
        auditLog('worklogs.fetch_single', ['issueKey' => $issueKey, 'rows' => count($worklogs)]);
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

        // Phase 4: drop issue keys outside the user's scope. We don't 403 here
        // because callers commonly pass a mixed-project list; we just return
        // worklogs only for the keys they're allowed to see.
        $beforeCount = count($issueKeys);
        $issueKeys   = array_values(array_filter($issueKeys, fn($k) => isIssueKeyInScope($k, $me)));
        $droppedKeys = $beforeCount - count($issueKeys);
        if ($droppedKeys > 0) {
            auditLog('worklogs.scope_filtered', ['dropped' => $droppedKeys, 'kept' => count($issueKeys)]);
        }

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
        auditLog('worklogs.fetch_bulk', [
            'issueCount' => count($issueKeys),
            'rows'       => count($allWorklogs),
            'startDate'  => $startDate,
            'endDate'    => $endDate,
            'author'     => $author,
        ]);
        echo json_encode(['success' => true, 'cached' => false] + $payload);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
} catch (Throwable $e) {
    auditLog('worklogs.error', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
