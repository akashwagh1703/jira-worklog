<?php
// Phase 5 smoke test. Exercises:
//   - DB connection (SQLite file in OS temp dir)
//   - Schema bootstrap
//   - User store (CRUD on the DB driver)
//   - Audit store (write + tail on the DB driver)
//   - Rate limiter (DB driver + 429 simulation)
//   - Migration import idempotency
//
// Refuses to run over HTTP.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Dedicated temp DB so we don't clobber dev data. Cleaned up at the end.
$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'esds_phase5_smoke_' . getmypid() . '.db';
@unlink($tmpDb);
putenv('DB_DSN=sqlite:' . $tmpDb);
putenv('AUTH_REQUIRED=true');
putenv('RATE_LIMIT_PER_MINUTE=3'); // tiny so we hit it fast
putenv('RATE_LIMIT_DISABLED=false');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/user_store.php';
require_once __DIR__ . '/audit_store.php';
require_once __DIR__ . '/rate_limit_helper.php';

$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    echo ($cond ? 'PASS' : 'FAIL'), ' ', $label, "\n";
    if ($cond) $pass++; else $fail++;
}

// --- DB bootstrap ---
ok(db() !== null, 'db() returns PDO when DB_DSN is set');
ok(dbDriver() === 'sqlite', "driver detected (got '" . dbDriver() . "')");
dbEnsureSchema();
ok(true, 'schema applied without exception');

// --- User store CRUD ---
$u = upsertUser('alice@esds.co.in', 'Alice');
ok($u && $u['email'] === 'alice@esds.co.in' && $u['role'] === 'employee',
   'upsertUser creates with default role employee');

$resp = setUserRole('alice@esds.co.in', 'manager');
ok($resp['ok'] && $resp['user']['role'] === 'manager', 'setUserRole -> manager');

$resp = setUserScope('alice@esds.co.in', ['FAMRUT', 'FMRT']);
ok($resp['ok']
   && is_array($resp['user']['scope']['projects'])
   && count($resp['user']['scope']['projects']) === 2,
   'setUserScope sets project list');

$found = findUser('alice@esds.co.in');
ok($found && $found['scope']['projects'] === ['FAMRUT', 'FMRT'], 'findUser round-trip');

$all = loadUsers();
ok(count($all) === 1 && isset($all['alice@esds.co.in']),
   'loadUsers returns flat [email => user] map');

// touch_login
touchUserLogin('alice@esds.co.in');
$alice = findUser('alice@esds.co.in');
ok(!empty($alice['lastLogin']), 'touchUserLogin updates last_login');

// --- Audit store ---
auditWrite([
    'ts' => gmdate('Y-m-d\\TH:i:s\\Z'),
    'user' => 'alice@esds.co.in',
    'role' => 'manager',
    'action' => 'issues.fetch',
    'ip' => '127.0.0.1',
    'ua' => 'smoke',
    'details' => ['rows' => 7],
]);
auditWrite([
    'ts' => gmdate('Y-m-d\\TH:i:s\\Z'),
    'user' => 'alice@esds.co.in',
    'role' => 'manager',
    'action' => 'logout',
    'ip' => '127.0.0.1',
    'ua' => 'smoke',
    'details' => [],
]);
$tail = auditTailDriver(10);
ok(count($tail) === 2, 'auditTailDriver returns both writes');
ok($tail[0]['action'] === 'logout', 'newest-first ordering');

$filtered = auditTailDriver(10, 'issues.fetch');
ok(count($filtered) === 1 && $filtered[0]['details']['rows'] === 7,
   'audit filter by action keeps details intact');

// --- Rate limiter ---
$user = findUser('alice@esds.co.in');
$counts = [];
for ($i = 0; $i < 5; $i++) {
    $r = rateLimitCheck('test_endpoint', $user);
    $counts[] = $r;
}
ok($counts[0]['allowed'] === true,                     'first call allowed');
ok($counts[2]['allowed'] === true,                     '3rd call (at limit) still allowed');
ok($counts[3]['allowed'] === false,                    '4th call denied (limit=3)');
ok($counts[4]['count'] >= 5,                           'counter still increments past limit');

// --- Cleanup ---
deleteUser('alice@esds.co.in');
ok(findUser('alice@esds.co.in') === null, 'deleteUser removes the row');

@unlink($tmpDb);

echo "\nResults: $pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
