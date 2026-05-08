<?php
require_once __DIR__ . '/../auth_helper.php';

// IdP redirects the browser here after the user signs in. We end up redirecting
// back into the SPA, so all error paths use 302 + ?error= rather than JSON.

function loginRedirect($error = null, $next = '/') {
    $url = APP_URL . 'login';
    $params = [];
    if ($error) $params['error'] = $error;
    if (!empty($params)) $url .= '?' . http_build_query($params);
    header('Location: ' . $url);
    exit;
}

if (!OIDC_ENABLED) loginRedirect('sso_disabled');

startSession();

if (isset($_GET['error'])) {
    // IdP-side error (user denied consent etc.)
    loginRedirect('idp_' . preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['error']));
}

$code  = $_GET['code']  ?? '';
$state = $_GET['state'] ?? '';

$expectedState    = $_SESSION['oidc_state']    ?? '';
$expectedVerifier = $_SESSION['oidc_verifier'] ?? '';
$next             = $_SESSION['oidc_next']     ?? '/';

unset($_SESSION['oidc_state'], $_SESSION['oidc_verifier'], $_SESSION['oidc_next']);

if ($code === '' || $state === '' || $expectedState === '' || !hash_equals($expectedState, $state)) {
    loginRedirect('bad_state');
}

$exchange = exchangeOidcCode($code, $expectedVerifier);
if (!$exchange['ok']) {
    error_log('[oidc] token exchange failed: ' . json_encode($exchange));
    loginRedirect('token_exchange_failed');
}

$userinfo = fetchOidcUserinfo($exchange['tokens']['access_token']);
if (!$userinfo['ok']) {
    error_log('[oidc] userinfo failed: ' . json_encode($userinfo));
    loginRedirect('userinfo_failed');
}

$email = strtolower(trim($userinfo['info']['email'] ?? ''));
if ($email === '') loginRedirect('no_email');

if (!isEmailDomainAllowed($email)) {
    loginRedirect('domain_not_allowed');
}

// First-login bootstrap: this also seeds the initial admin if OIDC_INITIAL_ADMIN matches.
$displayName = $userinfo['info']['name']
            ?? trim(($userinfo['info']['given_name'] ?? '') . ' ' . ($userinfo['info']['family_name'] ?? ''))
            ?: $email;

$user = upsertUser($email, $displayName);

// Promote the freshly-installed login into a real session.
session_regenerate_id(true);
$_SESSION['user_email']  = $user['email'];
$_SESSION['login_at']    = time();
$_SESSION['login_via']   = 'oidc';

// Clean redirect into the SPA. `next` was validated when stored in login.php.
$dest = APP_URL . ltrim($next, '/');
header('Location: ' . $dest);
exit;
