<?php
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../rate_limit_helper.php';

authCorsHeaders();

$user = currentSessionUser();
if (!$user) {
    echo json_encode([
        'success'         => true,
        'authenticated'   => false,
        'user'            => null,
        'oidcEnabled'     => OIDC_ENABLED,
        'oidcConfigured'  => oidcSpaConfigured(),
    ]);
    exit;
}

$payload = [
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
    'oidcConfigured' => oidcSpaConfigured(),
];

// Phase 5: surface backend health to admins so they can see at a glance
// whether the DB is reachable and rate-limiting is on.
if (($user['role'] ?? '') === 'admin') {
    $payload['backend'] = [
        'db'              => dbStatus(),
        'authRequired'    => AUTH_REQUIRED,
        'rateLimitPerMin' => RATE_LIMIT_PER_MINUTE,
        'rateLimitOff'    => RATE_LIMIT_DISABLED,
    ];
}

echo json_encode($payload);
