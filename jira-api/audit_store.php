<?php
// Phase 5: pluggable audit store.
//
// Public API:
//   auditWrite($entry): void                — append a fully-formed entry
//   auditTailDriver($limit, $action, $user) — read newest-first, optional filters
//
// Driver auto-selects: DB if PDO available, else file (audit.log JSONL).
// Schema rotation / retention is handled by the migration script (Phase 5
// `migrate.php prune`); the writer side is fast and fire-and-forget.

require_once __DIR__ . '/db.php';

if (!defined('AUDIT_LOG_FILE')) {
    define('AUDIT_LOG_FILE', __DIR__ . '/audit.log');
}
if (!defined('AUDIT_LOG_MAX_BYTES')) {
    define('AUDIT_LOG_MAX_BYTES', 10 * 1024 * 1024); // 10 MB
}

// -----------------------------------------------------------------------------
// File driver
// -----------------------------------------------------------------------------

function _auditFileWrite($entry) {
    $line = json_encode($entry, JSON_UNESCAPED_SLASHES) . "\n";
    if (file_exists(AUDIT_LOG_FILE) && @filesize(AUDIT_LOG_FILE) >= AUDIT_LOG_MAX_BYTES) {
        @rename(AUDIT_LOG_FILE, AUDIT_LOG_FILE . '.' . time());
    }
    @file_put_contents(AUDIT_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

function _auditFileTail($limit, $filterAction = null, $filterUser = null) {
    if (!file_exists(AUDIT_LOG_FILE)) return [];
    $raw = @file_get_contents(AUDIT_LOG_FILE);
    if ($raw === false) return [];
    $lines = preg_split("/\\r?\\n/", $raw);
    $rows = [];
    for ($i = count($lines) - 1; $i >= 0 && count($rows) < $limit * 5; $i--) {
        $line = trim($lines[$i]);
        if ($line === '') continue;
        $row = json_decode($line, true);
        if (!is_array($row)) continue;
        if ($filterAction && ($row['action'] ?? '') !== $filterAction) continue;
        if ($filterUser   && strcasecmp($row['user'] ?? '', $filterUser) !== 0) continue;
        $rows[] = $row;
        if (count($rows) >= $limit) break;
    }
    return $rows;
}

// -----------------------------------------------------------------------------
// DB driver
// -----------------------------------------------------------------------------

function _auditDbWrite($entry) {
    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO audit_events(ts, user_email, user_role, action, ip, ua, details)
         VALUES (:ts, :ue, :ur, :ac, :ip, :ua, :de)'
    );
    // Convert ISO-8601 'Z' timestamps to MySQL-friendly 'YYYY-MM-DD HH:MM:SS'
    $ts = $entry['ts'] ?? gmdate('Y-m-d\TH:i:s\Z');
    $ts = str_replace(['T', 'Z'], [' ', ''], $ts);
    $stmt->execute([
        ':ts' => $ts,
        ':ue' => $entry['user']   ?? null,
        ':ur' => $entry['role']   ?? null,
        ':ac' => $entry['action'] ?? 'unknown',
        ':ip' => $entry['ip']     ?? null,
        ':ua' => $entry['ua']     ?? null,
        ':de' => isset($entry['details']) ? json_encode($entry['details'], JSON_UNESCAPED_SLASHES) : null,
    ]);
}

function _auditDbTail($limit, $filterAction = null, $filterUser = null) {
    $pdo = db();
    $sql = 'SELECT ts, user_email, user_role, action, ip, ua, details FROM audit_events';
    $where = [];
    $params = [];
    if ($filterAction) { $where[] = 'action = :ac';      $params[':ac'] = $filterAction; }
    if ($filterUser)   { $where[] = 'user_email = :ue';  $params[':ue'] = strtolower($filterUser); }
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY id DESC LIMIT ' . max(1, min(2000, intval($limit)));
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $details = $row['details'] ? json_decode($row['details'], true) : [];
        // Re-shape to match Phase 4 file-driver output so the frontend doesn't care.
        $ts = $row['ts'];
        if ($ts && strpos($ts, 'T') === false) $ts = str_replace(' ', 'T', $ts) . 'Z';
        $out[] = [
            'ts'      => $ts,
            'user'    => $row['user_email'],
            'role'    => $row['user_role'],
            'action'  => $row['action'],
            'ip'      => $row['ip'],
            'ua'      => $row['ua'],
            'details' => $details ?: [],
        ];
    }
    return $out;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

function auditWrite($entry) {
    if (db()) {
        try { _auditDbWrite($entry); return; }
        catch (Throwable $e) {
            error_log('[audit_store] DB write failed, falling back to file: ' . $e->getMessage());
            // Fall through to file write so we never lose an audit event.
        }
    }
    _auditFileWrite($entry);
}

function auditTailDriver($limit = 200, $filterAction = null, $filterUser = null) {
    return db()
        ? _auditDbTail($limit, $filterAction, $filterUser)
        : _auditFileTail($limit, $filterAction, $filterUser);
}

// Retention helper used by the migration script's `prune` action.
function auditPrune($keepDays = null) {
    $keepDays = $keepDays === null ? DB_AUDIT_RETENTION_DAYS : intval($keepDays);
    if ($keepDays <= 0) return ['deleted' => 0];
    $pdo = db();
    if (!$pdo) return ['deleted' => 0, 'note' => 'file driver: rotation handled at write time'];

    $cutoff = gmdate('Y-m-d H:i:s', time() - ($keepDays * 86400));
    $stmt = $pdo->prepare('DELETE FROM audit_events WHERE ts < :c');
    $stmt->execute([':c' => $cutoff]);
    return ['deleted' => $stmt->rowCount(), 'cutoff' => $cutoff];
}
