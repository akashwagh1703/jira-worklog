<?php
// Phase 5: PDO singleton + schema bootstrapping.
//
// Three supported drivers, all via the same code path:
//   - SQLite — zero-config default. Set DB_DSN=sqlite:./jira-api/data.db.
//   - MySQL / MariaDB.
//   - PostgreSQL.
//
// Falsy / unset DB_DSN => Phase 4 file-based stores remain authoritative.
// Callers that need the DB should wrap their work in `if ($pdo = db()) { ... }`.

// ---------------------------------------------------------------------------
// .env loader — loads jira-api/.env then jira-api/.env.local into getenv().
// On Apache hosting, IT sets SetEnv directives instead and these files don't
// need to exist. For local CLI / migrate.php runs, this avoids having to
// re-set $env: vars every session.
// ---------------------------------------------------------------------------
if (!function_exists('_loadDotenv')) {
    function _loadDotenv($path) {
        if (!file_exists($path)) return;
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            if (!preg_match('/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i', $line, $m)) continue;
            $key = $m[1];
            $val = trim($m[2]);
            // Strip optional surrounding quotes.
            if (preg_match('/^"(.*)"$/', $val, $q) || preg_match("/^'(.*)'$/", $val, $q)) {
                $val = $q[1];
            }
            // Don't override existing process env (Apache SetEnv wins).
            if (getenv($key) === false || getenv($key) === '') {
                putenv("$key=$val");
            }
        }
    }
    _loadDotenv(__DIR__ . '/.env');
    _loadDotenv(__DIR__ . '/.env.local');
}

if (!defined('DB_DSN')) {
    define('DB_DSN',  getenv('DB_DSN')  ?: '');
    define('DB_USER', getenv('DB_USER') ?: '');
    define('DB_PASS', getenv('DB_PASS') ?: '');
}

// Shared retention windows (days). Used by migration + cleanup tasks.
if (!defined('DB_AUDIT_RETENTION_DAYS')) {
    define('DB_AUDIT_RETENTION_DAYS', intval(getenv('DB_AUDIT_RETENTION_DAYS') ?: 365));
}
if (!defined('DB_RATE_LIMIT_RETENTION_HOURS')) {
    define('DB_RATE_LIMIT_RETENTION_HOURS', intval(getenv('DB_RATE_LIMIT_RETENTION_HOURS') ?: 24));
}

// Returns a PDO instance, or NULL if no DB is configured / connection failed.
// Connection is cached per-process; safe to call repeatedly.
function db() {
    static $pdo = null;
    static $tried = false;

    if ($pdo) return $pdo;
    if ($tried) return null; // last attempt failed; don't keep retrying
    $tried = true;

    $dsn = DB_DSN;
    if ($dsn === '') return null;

    try {
        $pdo = new PDO($dsn, DB_USER ?: null, DB_PASS ?: null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        error_log('[db] connection failed: ' . $e->getMessage());
        return null;
    }

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    // SQLite-friendly defaults: write-ahead log, foreign keys, busy timeout.
    if ($driver === 'sqlite') {
        try {
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA busy_timeout = 5000');
        } catch (Throwable $e) {
            // Non-fatal; PRAGMAs are advisory.
        }
    }

    return $pdo;
}

// Driver name ('mysql' | 'sqlite' | 'pgsql' | '') used by callers that need to
// branch on driver-specific SQL.
function dbDriver() {
    $pdo = db();
    return $pdo ? $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) : '';
}

// Emit driver-appropriate schema. Idempotent (uses CREATE TABLE IF NOT EXISTS).
function dbSchemaSql($driver) {
    if ($driver === 'mysql') {
        return [
            "CREATE TABLE IF NOT EXISTS users (
                email VARCHAR(191) NOT NULL PRIMARY KEY,
                display_name VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'employee',
                scope_projects LONGTEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login DATETIME NULL,
                INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS audit_events (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                ts DATETIME NOT NULL,
                user_email VARCHAR(191) NULL,
                user_role VARCHAR(32) NULL,
                action VARCHAR(64) NOT NULL,
                ip VARCHAR(64) NULL,
                ua VARCHAR(255) NULL,
                details LONGTEXT NULL,
                INDEX idx_ts (ts),
                INDEX idx_user (user_email),
                INDEX idx_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS rate_limits (
                bucket_key VARCHAR(191) NOT NULL PRIMARY KEY,
                count INT NOT NULL DEFAULT 0,
                window_start INT NOT NULL,
                INDEX idx_window (window_start)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];
    }

    if ($driver === 'pgsql') {
        // PostgreSQL: native TIMESTAMPTZ + JSONB + BIGSERIAL.
        return [
            "CREATE TABLE IF NOT EXISTS users (
                email VARCHAR(255) PRIMARY KEY,
                display_name VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'employee',
                scope_projects JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_login TIMESTAMPTZ NULL
            )",
            "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",

            "CREATE TABLE IF NOT EXISTS audit_events (
                id BIGSERIAL PRIMARY KEY,
                ts TIMESTAMPTZ NOT NULL,
                user_email VARCHAR(255) NULL,
                user_role VARCHAR(32) NULL,
                action VARCHAR(64) NOT NULL,
                ip VARCHAR(64) NULL,
                ua VARCHAR(255) NULL,
                details JSONB NULL
            )",
            "CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_events(ts)",
            "CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_events(user_email)",
            "CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action)",

            "CREATE TABLE IF NOT EXISTS rate_limits (
                bucket_key VARCHAR(255) PRIMARY KEY,
                count INT NOT NULL DEFAULT 0,
                window_start INT NOT NULL
            )",
            "CREATE INDEX IF NOT EXISTS idx_ratelimits_window ON rate_limits(window_start)",
        ];
    }

    // SQLite (default fallback).
    return [
        "CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'employee',
            scope_projects TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",

        "CREATE TABLE IF NOT EXISTS audit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            user_email TEXT NULL,
            user_role TEXT NULL,
            action TEXT NOT NULL,
            ip TEXT NULL,
            ua TEXT NULL,
            details TEXT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_events(ts)",
        "CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_events(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action)",

        "CREATE TABLE IF NOT EXISTS rate_limits (
            bucket_key TEXT PRIMARY KEY,
            count INTEGER NOT NULL DEFAULT 0,
            window_start INTEGER NOT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_ratelimits_window ON rate_limits(window_start)",
    ];
}

// Ensures all Phase 5 tables exist. Safe to call on every request (and we do
// from the migration script, but NOT from regular requests for performance).
function dbEnsureSchema() {
    $pdo = db();
    if (!$pdo) return false;
    $driver = dbDriver();
    foreach (dbSchemaSql($driver) as $stmt) {
        $pdo->exec($stmt);
    }
    return true;
}

// Quick health probe used by /api/auth/me.php to surface DB status to admins.
function dbStatus() {
    $pdo = db();
    if (!$pdo) return ['enabled' => false];
    try {
        $pdo->query('SELECT 1');
        return ['enabled' => true, 'driver' => dbDriver()];
    } catch (Throwable $e) {
        return ['enabled' => true, 'driver' => dbDriver(), 'error' => $e->getMessage()];
    }
}
