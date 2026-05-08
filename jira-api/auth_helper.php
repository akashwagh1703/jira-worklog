<?php
// Phase 3 auth framework.
//
// Responsibilities:
//   1. Session management (PHP native sessions, HttpOnly + Secure cookies).
//   2. User store (JSON file at jira-api/users.json — gitignored).
//   3. OIDC client primitives shared by login.php / callback.php.
//   4. requireAuth() / requireRole() middleware for protected endpoints.
//
// Phase 4 will move the user store to a real DB and add audit logs; the API
// surface in this file will not change so callers won't need to rewrite.

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
define('APP_URL', getenv('APP_URL') ?: '/famrut-team-logs/logs/');

// User store location.
if (!defined('USERS_FILE')) {
    define('USERS_FILE', __DIR__ . '/users.json');
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
// User store: simple JSON file.
//
// File shape:
//   {
//     "users": {
//       "user@esds.co.in": {
//         "email": "user@esds.co.in",
//         "displayName": "User Name",
//         "role": "admin" | "manager" | "employee",
//         "scope": { "projects": ["FAMRUT", ...] | "*" },
//         "createdAt": 1715000000,
//         "lastLogin": 1715000000
//       }
//     }
//   }
// ---------------------------------------------------------------------------

function loadUsers() {
    if (!file_exists(USERS_FILE)) {
        return ['users' => []];
    }
    $raw = @file_get_contents(USERS_FILE);
    if ($raw === false) return ['users' => []];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !isset($decoded['users']) || !is_array($decoded['users'])) {
        return ['users' => []];
    }
    return $decoded;
}

function saveUsers($store) {
    $tmp = USERS_FILE . '.tmp';
    @file_put_contents($tmp, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    @rename($tmp, USERS_FILE);
}

function findUser($email) {
    $email = strtolower(trim($email));
    if ($email === '') return null;
    $store = loadUsers();
    return $store['users'][$email] ?? null;
}

function upsertUser($email, $displayName) {
    $email = strtolower(trim($email));
    if ($email === '') return null;

    $store = loadUsers();
    $now   = time();

    if (isset($store['users'][$email])) {
        $store['users'][$email]['lastLogin'] = $now;
        if ($displayName) {
            $store['users'][$email]['displayName'] = $displayName;
        }
    } else {
        // Bootstrap admin: the first email matching OIDC_INITIAL_ADMIN gets admin role.
        $isInitialAdmin = OIDC_INITIAL_ADMIN !== ''
            && strtolower(OIDC_INITIAL_ADMIN) === $email;

        $store['users'][$email] = [
            'email'       => $email,
            'displayName' => $displayName ?: $email,
            'role'        => $isInitialAdmin ? 'admin' : 'employee',
            'scope'       => ['projects' => '*'], // empty scope = "all visible projects"
            'createdAt'   => $now,
            'lastLogin'   => $now,
        ];
    }

    saveUsers($store);
    return $store['users'][$email];
}

function setUserRole($email, $role) {
    $email = strtolower(trim($email));
    if (!in_array($role, ['admin', 'manager', 'employee'], true)) {
        return ['ok' => false, 'error' => 'Invalid role'];
    }
    $store = loadUsers();
    if (!isset($store['users'][$email])) {
        return ['ok' => false, 'error' => 'User not found'];
    }
    $store['users'][$email]['role'] = $role;
    saveUsers($store);
    return ['ok' => true, 'user' => $store['users'][$email]];
}

function setUserScope($email, $projects) {
    $email = strtolower(trim($email));
    $store = loadUsers();
    if (!isset($store['users'][$email])) {
        return ['ok' => false, 'error' => 'User not found'];
    }
    if ($projects === '*' || $projects === ['*']) {
        $store['users'][$email]['scope'] = ['projects' => '*'];
    } elseif (is_array($projects)) {
        // Sanitize: trim, drop empties, dedupe, cap.
        $clean = [];
        foreach ($projects as $p) {
            $p = is_string($p) ? trim($p) : '';
            if ($p !== '' && !in_array($p, $clean, true)) $clean[] = $p;
        }
        $store['users'][$email]['scope'] = ['projects' => array_slice($clean, 0, 200)];
    } else {
        return ['ok' => false, 'error' => 'projects must be array or "*"'];
    }
    saveUsers($store);
    return ['ok' => true, 'user' => $store['users'][$email]];
}

function deleteUser($email) {
    $email = strtolower(trim($email));
    $store = loadUsers();
    if (!isset($store['users'][$email])) {
        return ['ok' => false, 'error' => 'User not found'];
    }
    unset($store['users'][$email]);
    saveUsers($store);
    return ['ok' => true];
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
    return OIDC_AUTH_URL . (str_contains(OIDC_AUTH_URL, '?') ? '&' : '?') . http_build_query($params);
}

function exchangeOidcCode($code, $codeVerifier) {
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
    if (!is_array($info) || empty($info['email'])) {
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
