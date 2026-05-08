<?php
require_once __DIR__ . '/../auth_helper.php';

authCorsHeaders();

startSession();

// Capture identity BEFORE we destroy the session so the audit entry has it.
auditLog('logout', []);

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
@session_destroy();

echo json_encode(['success' => true]);
