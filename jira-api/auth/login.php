<?php
require_once __DIR__ . '/../auth_helper.php';

// Browsers hit this directly (top-level navigation), so we don't return JSON —
// we 302-redirect to the IdP. If SSO isn't configured we send the user back to
// the login page with an error param so the SPA can show a useful message.

if (!OIDC_ENABLED) {
    header('Location: ' . APP_URL . 'login?error=sso_disabled');
    exit;
}
if (OIDC_CLIENT_ID === '' || OIDC_AUTH_URL === '' || OIDC_REDIRECT_URI === '') {
    header('Location: ' . APP_URL . 'login?error=sso_not_configured');
    exit;
}

startSession();

$state    = generateSecureToken(24);
$verifier = generateSecureToken(32);

$_SESSION['oidc_state']    = $state;
$_SESSION['oidc_verifier'] = $verifier;

// Where to send the user after successful login (client passes ?next=/path).
$next = $_GET['next'] ?? '/';
if (!preg_match('#^/[A-Za-z0-9._/\-?=&%]*$#', $next)) {
    $next = '/';
}
$_SESSION['oidc_next'] = $next;

$challenge = pkceChallenge($verifier);
$authUrl   = buildOidcAuthUrl($state, $challenge);

header('Location: ' . $authUrl);
exit;
