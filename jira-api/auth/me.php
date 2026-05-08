<?php
require_once __DIR__ . '/../auth_helper.php';

authCorsHeaders();

$user = currentSessionUser();
if (!$user) {
    echo json_encode([
        'success'         => true,
        'authenticated'   => false,
        'user'            => null,
        'oidcEnabled'     => OIDC_ENABLED,
        'oidcConfigured'  => OIDC_ENABLED && OIDC_CLIENT_ID !== '' && OIDC_AUTH_URL !== '',
    ]);
    exit;
}

echo json_encode([
    'success'        => true,
    'authenticated'  => true,
    'user'           => [
        'email'       => $user['email'],
        'displayName' => $user['displayName'],
        'role'        => $user['role'],
        'scope'       => $user['scope'] ?? ['projects' => '*'],
        'lastLogin'   => $user['lastLogin'] ?? null,
    ],
    'oidcEnabled'    => OIDC_ENABLED,
    'oidcConfigured' => OIDC_ENABLED && OIDC_CLIENT_ID !== '' && OIDC_AUTH_URL !== '',
]);
