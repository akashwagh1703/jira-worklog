<?php
require_once __DIR__ . '/../auth_helper.php';

authCorsHeaders();

// Admin-only API:
//   GET                                   list all users
//   PUT  ?email=<email>  body { role, scope }   update role and/or scope
//   DELETE ?email=<email>                 remove a user (revokes their access on next /me)
//   POST                  body { email, displayName?, role?, scope? }   manually create a user
//
// The session must belong to a user with role=admin.

$me = currentSessionUser();
if (!$me) jsonError('Authentication required', 401);
if (($me['role'] ?? '') !== 'admin') jsonError('Admin access required', 403);

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Phase 5: user_store now returns a flat [email => user] map.
        $users = array_values(loadUsers());
        usort($users, fn($a, $b) => strcasecmp($a['email'], $b['email']));
        echo json_encode(['success' => true, 'users' => $users]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = strtolower(trim($input['email'] ?? ''));
        $displayName = trim($input['displayName'] ?? '');
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonError('Valid email required', 400);
        }
        // Self-protection: don't let admin lock themselves out by changing their own role here.
        $user = upsertUser($email, $displayName ?: $email);

        if (!empty($input['role'])) {
            $resp = setUserRole($email, $input['role']);
            if (!$resp['ok']) jsonError($resp['error'], 400);
            $user = $resp['user'];
        }
        if (isset($input['scope'])) {
            $projects = is_array($input['scope']) && isset($input['scope']['projects'])
                ? $input['scope']['projects']
                : $input['scope'];
            $resp = setUserScope($email, $projects);
            if (!$resp['ok']) jsonError($resp['error'], 400);
            $user = $resp['user'];
        }

        auditLog('admin.user_upsert', [
            'targetEmail' => $email,
            'role'        => $user['role'],
            'scope'       => $user['scope'] ?? null,
        ]);
        echo json_encode(['success' => true, 'user' => $user]);
        exit;
    }

    if ($method === 'PUT') {
        $email = strtolower(trim($_GET['email'] ?? ''));
        if ($email === '') jsonError('email query param required', 400);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $user = findUser($email);
        if (!$user) jsonError('User not found', 404);

        if (isset($input['role'])) {
            // Don't allow admin demoting themselves — keeps a working admin around.
            if ($email === $me['email'] && $input['role'] !== 'admin') {
                jsonError("You can't remove your own admin role from this UI", 400);
            }
            $resp = setUserRole($email, $input['role']);
            if (!$resp['ok']) jsonError($resp['error'], 400);
            $user = $resp['user'];
        }
        if (isset($input['scope'])) {
            $projects = is_array($input['scope']) && isset($input['scope']['projects'])
                ? $input['scope']['projects']
                : $input['scope'];
            $resp = setUserScope($email, $projects);
            if (!$resp['ok']) jsonError($resp['error'], 400);
            $user = $resp['user'];
        }
        auditLog('admin.user_update', [
            'targetEmail' => $email,
            'patch'       => $input,
            'newRole'     => $user['role'],
            'newScope'    => $user['scope'] ?? null,
        ]);
        echo json_encode(['success' => true, 'user' => $user]);
        exit;
    }

    if ($method === 'DELETE') {
        $email = strtolower(trim($_GET['email'] ?? ''));
        if ($email === '') jsonError('email query param required', 400);
        if ($email === $me['email']) jsonError("You can't delete your own account", 400);
        $resp = deleteUser($email);
        if (!$resp['ok']) jsonError($resp['error'], 404);
        auditLog('admin.user_delete', ['targetEmail' => $email]);
        echo json_encode(['success' => true]);
        exit;
    }

    jsonError('Method not allowed', 405);
} catch (Throwable $e) {
    error_log('[admin_users] ' . $e->getMessage());
    auditLog('admin.error', ['error' => $e->getMessage()]);
    jsonError('Internal server error', 500);
}
