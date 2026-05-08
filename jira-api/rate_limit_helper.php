<?php
// Phase 5: per-user, per-endpoint rate limiting.
//
// Bucket key = "<endpoint>:<userOrIp>:<minute>"  ->  count
//
// When a PDO is available we increment with INSERT...ON DUPLICATE KEY UPDATE
// (MySQL) / INSERT OR REPLACE (SQLite). When no DB is configured we fall back
// to a small JSON file (rate_limits.json) protected with flock.
//
// Limits and windows are configurable via env:
//   RATE_LIMIT_PER_MINUTE  default 120  (per user, per endpoint)
//   RATE_LIMIT_DISABLED    set to 'true' to skip enforcement entirely.

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/audit_store.php';

if (!defined('RATE_LIMIT_PER_MINUTE')) {
    define('RATE_LIMIT_PER_MINUTE', max(1, intval(getenv('RATE_LIMIT_PER_MINUTE') ?: 120)));
}
if (!defined('RATE_LIMIT_DISABLED')) {
    define('RATE_LIMIT_DISABLED', filter_var(getenv('RATE_LIMIT_DISABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN));
}
if (!defined('RATE_LIMIT_FILE')) {
    define('RATE_LIMIT_FILE', __DIR__ . '/rate_limits.json');
}

// Returns ['allowed' => bool, 'count' => int, 'remaining' => int, 'reset' => epoch seconds]
function rateLimitCheck($endpoint, $user) {
    if (RATE_LIMIT_DISABLED) {
        return ['allowed' => true, 'count' => 0, 'remaining' => RATE_LIMIT_PER_MINUTE, 'reset' => time() + 60];
    }

    $window     = (int) floor(time() / 60); // minute bucket
    $identity   = $user['email'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'anon');
    $bucketKey  = $endpoint . ':' . $identity . ':' . $window;
    $resetAt    = ($window + 1) * 60;

    $count = db()
        ? _rateLimitDbIncrement($bucketKey, $window)
        : _rateLimitFileIncrement($bucketKey, $window);

    $limit     = RATE_LIMIT_PER_MINUTE;
    $allowed   = $count <= $limit;
    $remaining = max(0, $limit - $count);

    return ['allowed' => $allowed, 'count' => $count, 'remaining' => $remaining, 'reset' => $resetAt];
}

// Convenience wrapper: enforces the limit and writes audit + 429 if exceeded.
// Returns the user (passthrough) when allowed.
function requireRateLimit($endpoint, $user) {
    $r = rateLimitCheck($endpoint, $user);
    header('X-RateLimit-Limit: '     . RATE_LIMIT_PER_MINUTE);
    header('X-RateLimit-Remaining: ' . $r['remaining']);
    header('X-RateLimit-Reset: '     . $r['reset']);

    if (!$r['allowed']) {
        $retryAfter = max(1, $r['reset'] - time());
        header('Retry-After: ' . $retryAfter);

        // Audit the violation. Cap at one event per minute per user/endpoint
        // (we let it fire; volume is naturally bounded by the rate limit itself).
        auditWrite([
            'ts'      => gmdate('Y-m-d\\TH:i:s\\Z'),
            'user'    => $user['email'] ?? null,
            'role'    => $user['role']  ?? null,
            'action'  => 'ratelimit.exceeded',
            'ip'      => $_SERVER['REMOTE_ADDR'] ?? null,
            'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
            'details' => ['endpoint' => $endpoint, 'count' => $r['count'], 'limit' => RATE_LIMIT_PER_MINUTE],
        ]);

        http_response_code(429);
        echo json_encode([
            'success'    => false,
            'message'    => 'Rate limit exceeded. Try again in a few seconds.',
            'retryAfter' => $retryAfter,
        ]);
        exit;
    }
    return $user;
}

// -----------------------------------------------------------------------------
// DB driver. Atomic upsert + read.
// -----------------------------------------------------------------------------

function _rateLimitDbIncrement($bucketKey, $window) {
    $pdo    = db();
    $driver = dbDriver();

    // Best-effort opportunistic cleanup of expired buckets (1% chance per call).
    if (random_int(0, 99) === 0) {
        $cutoff = $window - max(1, intval(DB_RATE_LIMIT_RETENTION_HOURS * 60)); // minutes
        $pdo->prepare('DELETE FROM rate_limits WHERE window_start < :w')->execute([':w' => $cutoff]);
    }

    if ($driver === 'mysql') {
        $sql = 'INSERT INTO rate_limits(bucket_key, count, window_start) VALUES(:k, 1, :w)
                ON DUPLICATE KEY UPDATE count = count + 1';
        $pdo->prepare($sql)->execute([':k' => $bucketKey, ':w' => $window]);
    } else {
        // SQLite (UPSERT since 3.24) and PostgreSQL (since 9.5) share the same
        // ON CONFLICT...DO UPDATE syntax.
        $sql = 'INSERT INTO rate_limits(bucket_key, count, window_start) VALUES(:k, 1, :w)
                ON CONFLICT(bucket_key) DO UPDATE SET count = rate_limits.count + 1';
        $pdo->prepare($sql)->execute([':k' => $bucketKey, ':w' => $window]);
    }

    $stmt = $pdo->prepare('SELECT count FROM rate_limits WHERE bucket_key = :k');
    $stmt->execute([':k' => $bucketKey]);
    $row = $stmt->fetch();
    return (int) ($row['count'] ?? 1);
}

// -----------------------------------------------------------------------------
// File driver. flock-protected JSON dictionary keyed by bucket.
// -----------------------------------------------------------------------------

function _rateLimitFileIncrement($bucketKey, $window) {
    $fp = @fopen(RATE_LIMIT_FILE, 'c+');
    if (!$fp) return 1; // can't open => fail open (don't 429 due to FS errors)

    @flock($fp, LOCK_EX);
    rewind($fp);
    $raw = stream_get_contents($fp);
    $map = $raw ? (json_decode($raw, true) ?: []) : [];

    // Drop expired entries (anything not in the current window).
    foreach (array_keys($map) as $k) {
        if (!isset($map[$k]['w']) || ($window - (int)$map[$k]['w']) > 0) unset($map[$k]);
    }

    if (!isset($map[$bucketKey])) {
        $map[$bucketKey] = ['c' => 0, 'w' => $window];
    }
    $map[$bucketKey]['c']++;
    $count = $map[$bucketKey]['c'];

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($map));
    fflush($fp);
    @flock($fp, LOCK_UN);
    fclose($fp);

    return $count;
}
