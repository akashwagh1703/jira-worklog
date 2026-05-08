<?php
require_once __DIR__ . '/jira_service.php';
require_once __DIR__ . '/cache_helper.php';
require_once __DIR__ . '/auth_helper.php';

authCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Becomes a 401 only when AUTH_REQUIRED=true. Until then this is a no-op.
requireAuth();

$jql        = isset($_GET['jql'])        ? trim($_GET['jql'])              : '';
$fields     = isset($_GET['fields'])     ? trim($_GET['fields'])           : 'summary,status,assignee,project,issuetype,created,updated,duedate,priority';
$maxResults = isset($_GET['maxResults']) ? max(1, min(100, intval($_GET['maxResults']))) : 100;
$startAt    = isset($_GET['startAt'])    ? max(0, intval($_GET['startAt'])) : 0;
$paginate   = isset($_GET['paginate'])   && $_GET['paginate'] === 'true';

if ($jql === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "'jql' query parameter is required"]);
    exit;
}

// JQL has a practical length cap; protect server from abuse
if (strlen($jql) > 4000) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'JQL too long']);
    exit;
}

try {
    $cacheTtl = 300; // 5 minutes
    $key      = cacheKey(['issues', $jql, $fields, $maxResults, $startAt, $paginate]);
    $cached   = cacheGet($key, $cacheTtl);

    if ($cached !== null) {
        echo json_encode(['success' => true, 'cached' => true] + $cached);
        exit;
    }

    if ($paginate) {
        // Walk all pages server-side. Capped at 5000 issues to protect Jira & memory.
        $allIssues = [];
        $cursor    = $startAt;
        $total     = 0;
        $cap       = 5000;

        while (count($allIssues) < $cap) {
            $resp = jiraSearchIssues($jql, $fields, 100, $cursor);
            if (!$resp['success']) {
                http_response_code($resp['code']);
                echo json_encode(['success' => false, 'message' => 'Jira request failed', 'details' => $resp['data']]);
                exit;
            }
            $page  = $resp['data']['issues'] ?? [];
            $total = (int)($resp['data']['total'] ?? count($page));
            $allIssues = array_merge($allIssues, $page);
            if (count($page) < 100) break;
            $cursor += 100;
            if ($cursor >= $total) break;
        }

        $payload = [
            'total'      => $total,
            'issues'     => $allIssues,
            'startAt'    => $startAt,
            'maxResults' => count($allIssues),
        ];
    } else {
        $resp = jiraSearchIssues($jql, $fields, $maxResults, $startAt);
        if (!$resp['success']) {
            http_response_code($resp['code']);
            echo json_encode(['success' => false, 'message' => 'Jira request failed', 'details' => $resp['data']]);
            exit;
        }
        $data    = $resp['data'] ?? [];
        $payload = [
            'total'      => (int)($data['total'] ?? 0),
            'issues'     => $data['issues'] ?? [],
            'startAt'    => $startAt,
            'maxResults' => $maxResults,
        ];
    }

    cacheSet($key, $payload);
    echo json_encode(['success' => true, 'cached' => false] + $payload);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
