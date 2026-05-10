<?php
// Phase 3-5 auth framework.
//
// Responsibilities:
//   1. Session management (PHP native sessions, HttpOnly + Secure cookies).
//   2. OIDC client primitives shared by login.php / callback.php.
//   3. requireAuth() / requireRole() middleware for protected endpoints.
//   4. Phase 4 scope enforcement helpers (applyScopeToJql, etc).
//   5. Phase 4/5 audit logging — delegated to audit_store (file or DB).
//
// Phase 5 split out:
//   - user_store.php  — user CRUD with file-or-DB driver.
//   - audit_store.php — audit log read/write with file-or-DB driver.
//   - db.php          — PDO singleton.
//
// Public API used by other endpoints stays the same; this file is now mostly
// a thin policy layer over those stores.

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/user_store.php';
require_once __DIR__ . '/audit_store.php';

// ---------------------------------------------------------------------------
// Configuration (all values read from env; sensible local defaults below).
// ---------------------------------------------------------------------------

// OIDC provider config — IT plugs these in. See SSO_SETUP.md for presets.
define('OIDC_ENABLED',         filter_var(getenv('OIDC_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN));
define('OIDC_CLIENT_ID',       getenv('OIDC_CLIENT_ID')     ?: '');
define('OIDC_CLIENT_SECRET',   getenv('OIDC_CLIENT_SECRET') ?: '');
define('OIDC_AUTH_URL',        getenv('OIDC_AUTH_URL')      ?: '');
define('OIDC_TOKEN_URL',       getenv('OIDC_TOKEN_URL')     ?: '');
define('OIDC_USERINFO_URL',    getenv('OIDC_USERINFO_URL')  ?: '');
define('OIDC_REDIRECT_URI',    getenv('OIDC_REDIRECT_URI')  ?: '');
define('OIDC_SCOPES',          getenv('OIDC_SCOPES')        ?: 'openid email profile');
define('OIDC_ALLOWED_DOMAINS', getenv('OIDC_ALLOWED_DOMAINS') ?: '');
define('OIDC_INITIAL_ADMIN',   getenv('OIDC_INITIAL_ADMIN') ?: '');

// Where the SPA lives so callback can redirect back into it after login.
define('APP_URL', getenv('APP_URL') ?: '/esds-worklogs/');

// True when IT has set every env var required for login.php → callback.php.
function oidcSpaConfigured() {
    if (!OIDC_ENABLED) return false;
    return OIDC_CLIENT_ID !== ''
        && OIDC_AUTH_URL !== ''
        && OIDC_REDIRECT_URI !== ''
        && OIDC_TOKEN_URL !== ''
        && OIDC_USERINFO_URL !== '';
}

// Atlassian OAuth 2.0 (3LO) is not generic OIDC+PKCE — see buildOidcAuthUrl / exchangeOidcCode.
function isOidcAtlassian() {
    return stripos(OIDC_AUTH_URL, 'auth.atlassian.com') !== false;
}

// When AUTH_REQUIRED=true every Phase 2 endpoint will reject anonymous traffic.
// Default is false so we don't break existing deployments before SSO is wired up.
define('AUTH_REQUIRED', filter_var(getenv('AUTH_REQUIRED') ?: 'false', FILTER_VALIDATE_BOOLEAN));

// ---------------------------------------------------------------------------
// Session bootstrap (HttpOnly / Secure / Lax cookies).
// ---------------------------------------------------------------------------

function startSession() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['SERVER_PORT'] ?? null) == 443
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24,        // 24 hours
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('ESDS_WLD_SESSION');
    @session_start();
}

// ---------------------------------------------------------------------------
// OIDC bootstrap helper used by callback.php.
//
// Creates the user if missing, applies the initial-admin policy on first
// login, and touches last_login (for the DB driver).
// ---------------------------------------------------------------------------

function bootstrapOidcUser($email, $displayName) {
    $email     = strtolower(trim((string)$email));
    $existed   = (bool) findUser($email);
    $user      = upsertUser($email, $displayName);

    if (!$existed && OIDC_INITIAL_ADMIN !== '' && strtolower(OIDC_INITIAL_ADMIN) === $email) {
        $resp = setUserRole($email, 'admin');
        if ($resp['ok']) $user = $resp['user'];
    }

    touchUserLogin($email);
    return $user;
}

// ---------------------------------------------------------------------------
// Domain whitelist (OIDC users from non-allowed domains are rejected).
// ---------------------------------------------------------------------------

function isEmailDomainAllowed($email) {
    if (OIDC_ALLOWED_DOMAINS === '') return true;
    $email = strtolower($email);
    $at    = strrpos($email, '@');
    if ($at === false) return false;
    $domain = substr($email, $at + 1);
    foreach (explode(',', OIDC_ALLOWED_DOMAINS) as $allowed) {
        $allowed = strtolower(trim($allowed));
        if ($allowed !== '' && $allowed === $domain) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// OIDC client primitives.
// ---------------------------------------------------------------------------

function generateSecureToken($bytes = 32) {
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function pkceChallenge($verifier) {
    return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
}

function buildOidcAuthUrl($state, $codeChallenge) {
    if (isOidcAtlassian()) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
        // Requires audience + prompt=consent; does not use PKCE in the documented flow.
        $params = [
            'audience'      => 'api.atlassian.com',
            'client_id'     => OIDC_CLIENT_ID,
            'scope'         => OIDC_SCOPES,
            'redirect_uri'  => OIDC_REDIRECT_URI,
            'state'         => $state,
            'response_type' => 'code',
            'prompt'        => 'consent',
        ];
        return OIDC_AUTH_URL . (strpos(OIDC_AUTH_URL, '?') !== false ? '&' : '?') . http_build_query($params);
    }

    $params = [
        'response_type'         => 'code',
        'client_id'             => OIDC_CLIENT_ID,
        'redirect_uri'          => OIDC_REDIRECT_URI,
        'scope'                 => OIDC_SCOPES,
        'state'                 => $state,
        'code_challenge'        => $codeChallenge,
        'code_challenge_method' => 'S256',
        'access_type'           => 'online',
        'prompt'                => 'select_account',
    ];
    return OIDC_AUTH_URL . (strpos(OIDC_AUTH_URL, '?') !== false ? '&' : '?') . http_build_query($params);
}

function exchangeOidcCode($code, $codeVerifier) {
    if (isOidcAtlassian()) {
        $body = json_encode([
            'grant_type'    => 'authorization_code',
            'client_id'     => OIDC_CLIENT_ID,
            'client_secret' => OIDC_CLIENT_SECRET,
            'code'          => $code,
            'redirect_uri'  => OIDC_REDIRECT_URI,
        ]);
        $ch = curl_init(OIDC_TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT        => 15,
        ]);
    } else {
        $body = http_build_query([
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'redirect_uri'  => OIDC_REDIRECT_URI,
            'client_id'     => OIDC_CLIENT_ID,
            'client_secret' => OIDC_CLIENT_SECRET,
            'code_verifier' => $codeVerifier,
        ]);

        $ch = curl_init(OIDC_TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT        => 15,
        ]);
    }
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($err)            return ['ok' => false, 'error' => 'token exchange transport error: ' . $err];
    if ($status >= 400)  return ['ok' => false, 'error' => 'token exchange failed', 'http' => $status, 'body' => $resp];

    $tok = json_decode($resp, true);
    if (!is_array($tok) || empty($tok['access_token'])) {
        return ['ok' => false, 'error' => 'malformed token response'];
    }
    return ['ok' => true, 'tokens' => $tok];
}

function fetchOidcUserinfo($accessToken) {
    $ch = curl_init(OIDC_USERINFO_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken, 'Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($err || $status >= 400) {
        return ['ok' => false, 'error' => 'userinfo failed', 'http' => $status, 'body' => $resp, 'transport' => $err];
    }
    $info = json_decode($resp, true);
    if (!is_array($info)) {
        return ['ok' => false, 'error' => 'userinfo not json'];
    }
    if (empty($info['email']) && !empty($info['extended_profile']['email'])) {
        $info['email'] = $info['extended_profile']['email'];
    }
    if (empty($info['email'])) {
        return ['ok' => false, 'error' => 'userinfo missing email'];
    }
    return ['ok' => true, 'info' => $info];
}

// ---------------------------------------------------------------------------
// Middleware helpers used by every protected endpoint.
// ---------------------------------------------------------------------------

function currentSessionUser() {
    startSession();
    if (empty($_SESSION['user_email'])) return null;
    return findUser($_SESSION['user_email']);
}

function jsonError($message, $code = 401) {
    header('Content-Type: application/json');
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function requireAuth() {
    if (!AUTH_REQUIRED) {
        // While SSO is being rolled out the gate is opt-in; just expose the user
        // record (or null) so endpoints can use it for personalization without
        // hard-failing on anonymous access.
        return currentSessionUser();
    }
    $user = currentSessionUser();
    if (!$user) jsonError('Authentication required', 401);
    return $user;
}

function requireRole($roles) {
    $roles = is_array($roles) ? $roles : [$roles];
    $user  = currentSessionUser();
    if (!$user) jsonError('Authentication required', 401);
    if (!in_array($user['role'], $roles, true)) {
        jsonError('Forbidden — required role: ' . implode('|', $roles), 403);
    }
    return $user;
}

// ---------------------------------------------------------------------------
// Phase 4: scope enforcement.
//
// The user store records per-user "scope" — either '*' (all projects) or an
// allow-list of project names. Endpoints call these helpers BEFORE talking to
// Jira so a determined manager can't craft a JQL that escapes their assigned
// projects.
//
// Strategy: never trust client input. We always wrap caller-supplied JQL with
// our own `project IN (...)` clause and intersect any caller-supplied project
// list with the user's scope.
// ---------------------------------------------------------------------------

// Returns the user's effective project list ('*' OR string[]).
function effectiveScopeProjects($user) {
    if (!$user || !is_array($user) || !isset($user['scope'])) return '*';
    $projects = $user['scope']['projects'] ?? '*';
    if ($projects === '*' || $projects === ['*']) return '*';
    if (!is_array($projects)) return '*';
    $clean = [];
    foreach ($projects as $p) {
        if (is_string($p)) {
            $p = trim($p);
            if ($p !== '' && $p !== '*' && !in_array($p, $clean, true)) $clean[] = $p;
        }
    }
    return empty($clean) ? '*' : $clean;
}

// Wrap caller-supplied JQL with the user's scope. Return value is always a
// string usable as JQL. When scope is '*' (or no auth gate / no user) we
// return the original JQL unchanged.
function applyScopeToJql($jql, $user) {
    $jql = is_string($jql) ? trim($jql) : '';
    if (!AUTH_REQUIRED) return $jql; // scope only enforced when auth is on
    $projects = effectiveScopeProjects($user);
    if ($projects === '*') return $jql;

    $escaped = array_map(function ($p) {
        return '"' . str_replace('"', '\\"', $p) . '"';
    }, $projects);
    $clause = 'project IN (' . implode(', ', $escaped) . ')';

    if ($jql === '') return $clause;
    return $clause . ' AND (' . $jql . ')';
}

// Intersect a caller-supplied project list with the user's scope.
// `$projects` may be '*' or a string[]. Returns a string[] (possibly empty)
// OR '*' when scope is unrestricted.
function applyScopeToProjectList($projects, $user) {
    if (!AUTH_REQUIRED) {
        // No auth gate => caller wins
        if ($projects === '*' || $projects === ['*']) return '*';
        if (!is_array($projects)) return '*';
        return $projects;
    }
    $userScope = effectiveScopeProjects($user);
    if ($userScope === '*') {
        if ($projects === '*' || $projects === ['*']) return '*';
        return is_array($projects) ? $projects : '*';
    }
    // Scoped user: clamp to intersection.
    if ($projects === '*' || $projects === ['*'] || $projects === null || $projects === []) {
        return $userScope;
    }
    if (!is_array($projects)) return $userScope;
    $intersect = array_values(array_intersect($projects, $userScope));
    return $intersect; // may be empty -> caller should treat as "no access"
}

// True if the user is authorized for this Jira issue key (e.g. "FAMRUT-123").
// Returns true when scope is '*' OR when the issue's project prefix is in scope.
function isIssueKeyInScope($issueKey, $user) {
    if (!AUTH_REQUIRED) return true;
    if (!preg_match('/^([A-Za-z][A-Za-z0-9_]*)-\d+$/', $issueKey, $m)) return false;
    $projects = effectiveScopeProjects($user);
    if ($projects === '*') return true;
    foreach ($projects as $p) {
        if ($p === $m[1]) return true; // exact key match
        // Accept name-style scope entries; Jira's permission system is the second line of defense.
        if (preg_match('/[\s\-_.]/', $p)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Audit logging — Phase 4 writer + Phase 5 store.
//
// Writer signature unchanged so callers don't need to be touched. Storage
// (file vs DB) is decided by audit_store.php based on db() availability.
// ---------------------------------------------------------------------------

function auditLog($action, $details = []) {
    $user = currentSessionUser();
    $entry = [
        'ts'      => gmdate('Y-m-d\\TH:i:s\\Z'),
        'user'    => $user['email'] ?? null,
        'role'    => $user['role']  ?? null,
        'action'  => $action,
        'ip'      => $_SERVER['REMOTE_ADDR']     ?? null,
        'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
        'details' => $details,
    ];
    auditWrite($entry);
}

function auditTail($limit = 200, $filterAction = null, $filterUser = null) {
    $limit = max(1, min(2000, intval($limit)));
    return auditTailDriver(
        $limit,
        ($filterAction !== null && $filterAction !== '') ? $filterAction : null,
        ($filterUser   !== null && $filterUser   !== '') ? $filterUser   : null
    );
}

// ---------------------------------------------------------------------------
// CORS helper used by every auth endpoint. Matches existing project style.
// ---------------------------------------------------------------------------

function authCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
