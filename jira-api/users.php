<?php
require_once __DIR__ . '/jira_service.php';
require_once __DIR__ . '/cache_helper.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/rate_limit_helper.php';

authCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$me = requireAuth();
requireRateLimit('users', $me);

$days          = isset($_GET['days']) ? max(1, min(365, intval($_GET['days']))) : 90;
$projectsParam = isset($_GET['projects']) ? trim($_GET['projects']) : '';

// Parse comma-separated project list. Allow letters, digits, dash, underscore,
// space, dot and unicode letters (Jira project names support i18n).
$rawProjects = [];
if ($projectsParam !== '') {
    foreach (explode(',', $projectsParam) as $p) {
        $p = trim($p);
        if ($p === '') continue;
        if (mb_strlen($p) > 200) continue;
        if (preg_match('/[\\\\"]/', $p)) continue; // disallow chars that would break our JQL escaping
        $rawProjects[] = $p;
    }
}

// Phase 4: clamp the requested project list to the user's scope.
$scoped = applyScopeToProjectList(empty($rawProjects) ? '*' : $rawProjects, $me);
$projects = $scoped === '*' ? [] : $scoped;
$scopeApplied = ($scoped !== '*' && (empty($rawProjects) || count($scoped) !== count($rawProjects)));

try {
    $cacheTtl = 600; // 10 min
    $key      = cacheKey(['users', $projects, $days]);
    $cached   = cacheGet($key, $cacheTtl);
    if ($cached !== null) {
        echo json_encode(['success' => true, 'cached' => true, 'users' => $cached]);
        exit;
    }

    if (empty($projects)) {
        $jql = 'updated >= -' . $days . 'd ORDER BY updated DESC';
    } else {
        $escaped = array_map(function ($p) {
            return '"' . str_replace('"', '\\"', $p) . '"';
        }, $projects);
        $jql = 'project IN (' . implode(', ', $escaped) . ') AND updated >= -' . $days . 'd ORDER BY updated DESC';
    }

    // Pull just the assignee field. We cap at 5000 issues to balance coverage vs runtime.
    $allIssues = [];
    $cursor    = 0;
    $cap       = 5000;

    while (count($allIssues) < $cap) {
        $resp = jiraSearchIssues($jql, ['assignee'], 100, $cursor);
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

    $byKey = [];
    foreach ($allIssues as $issue) {
        $a = $issue['fields']['assignee'] ?? null;
        if (!$a) continue;
        $key = $a['accountId'] ?? $a['emailAddress'] ?? $a['displayName'] ?? null;
        if (!$key || isset($byKey[$key])) continue;
        $byKey[$key] = [
            'accountId'    => $a['accountId']    ?? null,
            'displayName'  => $a['displayName']  ?? '',
            'emailAddress' => $a['emailAddress'] ?? '',
            'avatar'       => $a['avatarUrls']['48x48'] ?? null,
        ];
    }

    $users = array_values($byKey);
    usort($users, function ($x, $y) {
        return strcasecmp($x['displayName'] ?? '', $y['displayName'] ?? '');
    });

    cacheSet($key, $users);
    auditLog('users.fetch', [
        'days'         => $days,
        'projects'     => $projects,
        'scopeApplied' => $scopeApplied,
        'count'        => count($users),
    ]);
    echo json_encode(['success' => true, 'cached' => false, 'users' => $users]);
} catch (Throwable $e) {
    auditLog('users.error', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
