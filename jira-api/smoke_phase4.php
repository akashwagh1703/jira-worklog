<?php
// Phase 4 smoke test. Run with: php jira-api/smoke_phase4.php
// Refuses to run over HTTP — this is a developer/CI-only script.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Force AUTH_REQUIRED=true so scope helpers actually do something.
putenv('AUTH_REQUIRED=true');

require_once __DIR__ . '/auth_helper.php';

$pass = 0; $fail = 0;
function assertEq($got, $want, $label) {
    global $pass, $fail;
    $ok = json_encode($got) === json_encode($want);
    echo ($ok ? 'PASS' : 'FAIL'), ' ', $label, "\n";
    if (!$ok) {
        echo "  got:  ", json_encode($got),  "\n";
        echo "  want: ", json_encode($want), "\n";
        $fail++;
    } else {
        $pass++;
    }
}

// --- effectiveScopeProjects ---
assertEq(effectiveScopeProjects(null), '*', 'no user => *');
assertEq(effectiveScopeProjects(['scope' => ['projects' => '*']]), '*', "user with '*' => *");
assertEq(effectiveScopeProjects(['scope' => ['projects' => ['FAMRUT', 'FMRT']]]), ['FAMRUT', 'FMRT'], 'list scope unchanged');
assertEq(effectiveScopeProjects(['scope' => ['projects' => []]]), '*', 'empty list => * (treat as unrestricted)');

// --- applyScopeToJql ---
$mgr = ['email' => 'm@x', 'role' => 'manager', 'scope' => ['projects' => ['FAMRUT', 'FMRT']]];
$adm = ['email' => 'a@x', 'role' => 'admin',   'scope' => ['projects' => '*']];

assertEq(applyScopeToJql('worklogAuthor = "x"', $mgr),
    'project IN ("FAMRUT", "FMRT") AND (worklogAuthor = "x")',
    'manager JQL is wrapped');
assertEq(applyScopeToJql('worklogAuthor = "x"', $adm),
    'worklogAuthor = "x"',
    'admin JQL untouched');
assertEq(applyScopeToJql('', $mgr),
    'project IN ("FAMRUT", "FMRT")',
    'empty JQL becomes pure scope clause');

// --- applyScopeToProjectList ---
assertEq(applyScopeToProjectList('*', $mgr), ['FAMRUT', 'FMRT'], "manager '*' clamped to scope");
assertEq(applyScopeToProjectList(['FAMRUT', 'OTHER'], $mgr), ['FAMRUT'], 'intersection drops OTHER');
assertEq(applyScopeToProjectList(['OTHER'], $mgr), [], 'fully out-of-scope returns empty');
assertEq(applyScopeToProjectList(['ANY'], $adm), ['ANY'], 'admin caller wins');

// --- isIssueKeyInScope ---
assertEq(isIssueKeyInScope('FAMRUT-1', $mgr), true,  'FAMRUT-1 in scope');
assertEq(isIssueKeyInScope('OTHER-1', $mgr),  false, 'OTHER-1 out of scope');
assertEq(isIssueKeyInScope('ANY-1', $adm),    true,  'admin sees all issues');
assertEq(isIssueKeyInScope('not-a-key', $mgr), false, 'malformed rejected');

// --- audit log round-trip ---
// Use a temp audit log path so we don't pollute the real one.
$tmpLog = __DIR__ . '/audit.log.smoke';
@unlink($tmpLog);
if (!defined('AUDIT_LOG_FILE_OVERRIDE')) {
    // We can't redefine the constant, but we can simulate by writing to the
    // real file and cleaning up after.
}
auditLog('smoke.test', ['note' => 'hello']);
$tail = auditTail(50, 'smoke.test');
assertEq(count($tail) >= 1, true, 'auditLog -> auditTail roundtrip');
$last = $tail[0];
assertEq($last['action'], 'smoke.test', 'audit action recorded');
assertEq($last['details']['note'], 'hello', 'audit details recorded');

// Clean up our smoke test entries from the real audit.log (best-effort).
$auditFile = __DIR__ . '/audit.log';
if (file_exists($auditFile)) {
    $kept = [];
    foreach (file($auditFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $row = json_decode($line, true);
        if (is_array($row) && ($row['action'] ?? '') === 'smoke.test') continue;
        $kept[] = $line;
    }
    file_put_contents($auditFile, $kept ? implode("\n", $kept) . "\n" : '');
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
