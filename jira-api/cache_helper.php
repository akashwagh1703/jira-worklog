<?php
// Lightweight file-based cache for Jira responses.
// Phase 2: keeps the deployment self-contained (no Redis/MySQL dependency).
// Phase 4 will replace this with a proper cache-store + audit trail.

if (!defined('JIRA_CACHE_DIR')) {
    define('JIRA_CACHE_DIR', __DIR__ . '/cache');
}

function ensureCacheDir() {
    if (!is_dir(JIRA_CACHE_DIR)) {
        @mkdir(JIRA_CACHE_DIR, 0755, true);
    }
}

function cacheKey($parts) {
    return md5(json_encode($parts));
}

function cacheGet($key, $ttlSeconds) {
    ensureCacheDir();
    $file = JIRA_CACHE_DIR . '/' . $key . '.json';
    if (!file_exists($file)) {
        return null;
    }
    if (time() - filemtime($file) > $ttlSeconds) {
        @unlink($file);
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    return $decoded === null ? null : $decoded;
}

function cacheSet($key, $value) {
    ensureCacheDir();
    $file = JIRA_CACHE_DIR . '/' . $key . '.json';
    @file_put_contents($file, json_encode($value), LOCK_EX);
}

function cacheClear() {
    if (!is_dir(JIRA_CACHE_DIR)) return 0;
    $files = glob(JIRA_CACHE_DIR . '/*.json') ?: [];
    $count = 0;
    foreach ($files as $f) {
        if (@unlink($f)) $count++;
    }
    return $count;
}
