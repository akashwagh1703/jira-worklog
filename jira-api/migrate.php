<?php
// Phase 5 migration / maintenance CLI.
//
// Usage:
//   php jira-api/migrate.php init        Create schema (no-op if it already exists)
//   php jira-api/migrate.php status      Show driver, table row counts
//   php jira-api/migrate.php import      Import users.json + audit.log into the DB
//   php jira-api/migrate.php prune       Apply retention windows (see env vars)
//   php jira-api/migrate.php all         init + import + prune
//
// Requires DB_DSN (and DB_USER / DB_PASS for MySQL) to be set in the
// environment. For dev: DB_DSN=sqlite:./jira-api/data.db.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/audit_store.php';

$action = $argv[1] ?? '';

if (!in_array($action, ['init', 'status', 'import', 'prune', 'all'], true)) {
    fwrite(STDERR, "Usage: php migrate.php <init|status|import|prune|all>\n");
    exit(2);
}

$pdo = db();
if (!$pdo) {
    fwrite(STDERR, "ERROR: DB_DSN is not configured. Set DB_DSN (and DB_USER/DB_PASS for MySQL) and retry.\n");
    fwrite(STDERR, "       For local dev: DB_DSN=sqlite:" . __DIR__ . "/data.db\n");
    exit(1);
}

$driver = dbDriver();
echo "DB driver: $driver\n";

if ($action === 'init' || $action === 'all') {
    echo "Ensuring schema...\n";
    dbEnsureSchema();
    echo "  done\n";
}

if ($action === 'import' || $action === 'all') {
    importUsersJson();
    importAuditLog();
}

if ($action === 'prune' || $action === 'all') {
    pruneOldEvents();
    pruneRateLimits();
}

if ($action === 'status') {
    showStatus();
}

exit(0);

// -----------------------------------------------------------------------------

function importUsersJson() {
    global $pdo;
    $file = __DIR__ . '/users.json';
    if (!file_exists($file)) {
        echo "users.json: not present, skipping\n";
        return;
    }
    $raw = @file_get_contents($file);
    $decoded = $raw ? json_decode($raw, true) : null;
    if (!is_array($decoded)) {
        echo "users.json: malformed, skipping\n";
        return;
    }
    // Phase 3 wrote {"users": {...}}; Phase 5 user_store reads flat. Accept both.
    $users = isset($decoded['users']) && is_array($decoded['users'])
        ? $decoded['users']
        : $decoded;

    $count = 0;
    foreach ($users as $email => $u) {
        if (!is_array($u)) continue;
        $email = strtolower($u['email'] ?? $email);
        if (!$email) continue;
        $stmt = $pdo->prepare(
            'INSERT INTO users(email, display_name, role, scope_projects, last_login)
             VALUES(:e, :n, :r, :s, :l)'
        );
        // Skip if exists (idempotent import).
        $check = $pdo->prepare('SELECT 1 FROM users WHERE email = :e');
        $check->execute([':e' => $email]);
        if ($check->fetch()) continue;

        $stmt->execute([
            ':e' => $email,
            ':n' => $u['displayName'] ?? $email,
            ':r' => $u['role']        ?? 'employee',
            ':s' => json_encode($u['scope']['projects'] ?? '*'),
            ':l' => isset($u['lastLogin']) ? (is_int($u['lastLogin']) ? gmdate('Y-m-d H:i:s', $u['lastLogin']) : $u['lastLogin']) : null,
        ]);
        $count++;
    }
    echo "users.json: imported $count new users\n";
}

function importAuditLog() {
    global $pdo;
    $file = __DIR__ . '/audit.log';
    if (!file_exists($file)) {
        echo "audit.log: not present, skipping\n";
        return;
    }

    // Avoid double-imports: tag the import with a marker entry.
    $marker = $pdo->prepare("SELECT id FROM audit_events WHERE action = 'migrate.audit_imported' LIMIT 1");
    $marker->execute();
    if ($marker->fetch()) {
        echo "audit.log: already imported (marker present), skipping\n";
        return;
    }

    $count = 0;
    $fh = @fopen($file, 'r');
    if (!$fh) {
        echo "audit.log: cannot open, skipping\n";
        return;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO audit_events(ts, user_email, user_role, action, ip, ua, details)
         VALUES(:ts, :ue, :ur, :ac, :ip, :ua, :de)'
    );
    while (($line = fgets($fh)) !== false) {
        $line = trim($line);
        if ($line === '') continue;
        $row = json_decode($line, true);
        if (!is_array($row)) continue;
        $ts = $row['ts'] ?? gmdate('Y-m-d\\TH:i:s\\Z');
        $ts = str_replace(['T', 'Z'], [' ', ''], $ts);
        $stmt->execute([
            ':ts' => $ts,
            ':ue' => $row['user']   ?? null,
            ':ur' => $row['role']   ?? null,
            ':ac' => $row['action'] ?? 'unknown',
            ':ip' => $row['ip']     ?? null,
            ':ua' => $row['ua']     ?? null,
            ':de' => isset($row['details']) ? json_encode($row['details']) : null,
        ]);
        $count++;
    }
    fclose($fh);

    // Marker so we don't re-import on subsequent runs.
    $stmt->execute([
        ':ts' => gmdate('Y-m-d H:i:s'),
        ':ue' => null,
        ':ur' => null,
        ':ac' => 'migrate.audit_imported',
        ':ip' => null,
        ':ua' => null,
        ':de' => json_encode(['rows' => $count]),
    ]);
    echo "audit.log: imported $count entries\n";
}

function pruneOldEvents() {
    $r = auditPrune();
    echo "audit prune: deleted " . ($r['deleted'] ?? 0) . " events older than " . DB_AUDIT_RETENTION_DAYS . " days\n";
}

function pruneRateLimits() {
    global $pdo;
    $cutoff = (int) floor((time() - (DB_RATE_LIMIT_RETENTION_HOURS * 3600)) / 60);
    $stmt = $pdo->prepare('DELETE FROM rate_limits WHERE window_start < :w');
    $stmt->execute([':w' => $cutoff]);
    echo "rate_limits prune: deleted " . $stmt->rowCount() . " expired buckets\n";
}

function showStatus() {
    global $pdo;
    $tables = ['users', 'audit_events', 'rate_limits'];
    foreach ($tables as $t) {
        try {
            $row = $pdo->query("SELECT COUNT(*) AS c FROM $t")->fetch();
            echo "  $t: " . ($row['c'] ?? '?') . " rows\n";
        } catch (Throwable $e) {
            echo "  $t: missing (run `php migrate.php init`)\n";
        }
    }
}
