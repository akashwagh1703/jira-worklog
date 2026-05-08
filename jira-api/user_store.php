<?php
// Phase 5: pluggable user store.
//
// Public API (used by auth_helper.php and admin_users.php):
//   loadUsers(): array<email => user>
//   findUser(email): user|null
//   upsertUser(email, displayName): user
//   setUserRole(email, role): ['ok' => bool, 'user' => ?user, 'error' => ?string]
//   setUserScope(email, projects): ['ok' => bool, 'user' => ?user, 'error' => ?string]
//   deleteUser(email): ['ok' => bool, 'error' => ?string]
//   touchUserLogin(email): void  (Phase 5 — updates last_login when DB-backed)
//
// Driver selection is automatic: DB if db() returns a PDO, otherwise file
// (users.json with atomic write). Behaviour is identical from the caller's
// perspective so endpoints and the admin UI don't need to change.

require_once __DIR__ . '/db.php';

if (!defined('USER_STORE_FILE')) {
    define('USER_STORE_FILE', __DIR__ . '/users.json');
}

if (!defined('VALID_ROLES_LIST')) {
    define('VALID_ROLES_LIST', json_encode(['admin', 'manager', 'employee']));
}

function _validRoles() {
    return json_decode(VALID_ROLES_LIST, true);
}

// -----------------------------------------------------------------------------
// File driver (Phase 3 behavior preserved verbatim).
// -----------------------------------------------------------------------------

function _userFileLoadAll() {
    if (!file_exists(USER_STORE_FILE)) return [];
    $raw = @file_get_contents(USER_STORE_FILE);
    if ($raw === false) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function _userFileSaveAll($users) {
    $tmp = USER_STORE_FILE . '.tmp';
    @file_put_contents($tmp, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    @rename($tmp, USER_STORE_FILE);
}

// -----------------------------------------------------------------------------
// DB driver
// -----------------------------------------------------------------------------

function _userRowToArray($row) {
    if (!$row) return null;
    $scope = $row['scope_projects'];
    $decoded = is_string($scope) ? json_decode($scope, true) : $scope;
    if ($decoded === null) $decoded = '*';
    return [
        'email'       => $row['email'],
        'displayName' => $row['display_name'],
        'role'        => $row['role'],
        'scope'       => ['projects' => $decoded],
        'createdAt'   => $row['created_at']  ?? null,
        'updatedAt'   => $row['updated_at']  ?? null,
        'lastLogin'   => $row['last_login']  ?? null,
    ];
}

function _userDbLoadAll() {
    $pdo = db();
    $rows = $pdo->query('SELECT * FROM users ORDER BY email')->fetchAll();
    $out = [];
    foreach ($rows as $row) {
        $u = _userRowToArray($row);
        $out[$u['email']] = $u;
    }
    return $out;
}

function _userDbFind($email) {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email');
    $stmt->execute([':email' => $email]);
    return _userRowToArray($stmt->fetch());
}

function _userDbUpsert($email, $displayName) {
    $pdo = db();
    $existing = _userDbFind($email);
    if ($existing) {
        if ($displayName && $displayName !== $existing['displayName']) {
            $pdo->prepare('UPDATE users SET display_name = :n WHERE email = :e')
                ->execute([':n' => $displayName, ':e' => $email]);
            $existing['displayName'] = $displayName;
        }
        return $existing;
    }
    $pdo->prepare('INSERT INTO users(email, display_name, role, scope_projects) VALUES(:e, :n, :r, :s)')
        ->execute([
            ':e' => $email,
            ':n' => $displayName ?: $email,
            ':r' => 'employee',
            ':s' => json_encode('*'),
        ]);
    return _userDbFind($email);
}

function _userDbSetRole($email, $role) {
    $pdo = db();
    if (!_userDbFind($email)) return ['ok' => false, 'error' => 'User not found'];
    $pdo->prepare('UPDATE users SET role = :r WHERE email = :e')
        ->execute([':r' => $role, ':e' => $email]);
    return ['ok' => true, 'user' => _userDbFind($email)];
}

function _userDbSetScope($email, $projects) {
    $pdo = db();
    if (!_userDbFind($email)) return ['ok' => false, 'error' => 'User not found'];
    $pdo->prepare('UPDATE users SET scope_projects = :s WHERE email = :e')
        ->execute([':s' => json_encode($projects), ':e' => $email]);
    return ['ok' => true, 'user' => _userDbFind($email)];
}

function _userDbDelete($email) {
    $pdo = db();
    $stmt = $pdo->prepare('DELETE FROM users WHERE email = :e');
    $stmt->execute([':e' => $email]);
    return $stmt->rowCount() > 0
        ? ['ok' => true]
        : ['ok' => false, 'error' => 'User not found'];
}

function _userDbTouchLogin($email) {
    $pdo = db();
    $now = gmdate('Y-m-d H:i:s');
    $pdo->prepare('UPDATE users SET last_login = :t WHERE email = :e')
        ->execute([':t' => $now, ':e' => $email]);
}

// -----------------------------------------------------------------------------
// Public API — routes to the DB driver if a PDO is available, else file.
// -----------------------------------------------------------------------------

function loadUsers() {
    return db() ? _userDbLoadAll() : _userFileLoadAll();
}

function findUser($email) {
    $email = strtolower(trim((string)$email));
    if ($email === '') return null;
    if (db()) return _userDbFind($email);

    $users = _userFileLoadAll();
    return $users[$email] ?? null;
}

function upsertUser($email, $displayName = '') {
    $email = strtolower(trim((string)$email));
    $displayName = trim((string)$displayName);

    if (db()) return _userDbUpsert($email, $displayName);

    $users = _userFileLoadAll();
    $now = gmdate('Y-m-d\TH:i:s\Z');
    if (!isset($users[$email])) {
        $users[$email] = [
            'email'       => $email,
            'displayName' => $displayName ?: $email,
            'role'        => 'employee',
            'scope'       => ['projects' => '*'],
            'createdAt'   => $now,
            'updatedAt'   => $now,
        ];
    } else {
        if ($displayName && $displayName !== $users[$email]['displayName']) {
            $users[$email]['displayName'] = $displayName;
            $users[$email]['updatedAt']   = $now;
        }
    }
    _userFileSaveAll($users);
    return $users[$email];
}

function setUserRole($email, $role) {
    $email = strtolower(trim((string)$email));
    if (!in_array($role, _validRoles(), true)) {
        return ['ok' => false, 'error' => 'Invalid role'];
    }
    if (db()) return _userDbSetRole($email, $role);

    $users = _userFileLoadAll();
    if (!isset($users[$email])) return ['ok' => false, 'error' => 'User not found'];
    $users[$email]['role']      = $role;
    $users[$email]['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z');
    _userFileSaveAll($users);
    return ['ok' => true, 'user' => $users[$email]];
}

function setUserScope($email, $projects) {
    $email = strtolower(trim((string)$email));
    // Validate input shape
    if ($projects !== '*' && !is_array($projects)) {
        return ['ok' => false, 'error' => 'scope.projects must be "*" or an array'];
    }
    if (is_array($projects)) {
        $projects = array_values(array_unique(array_filter(array_map('trim', $projects))));
    }
    if (db()) return _userDbSetScope($email, $projects);

    $users = _userFileLoadAll();
    if (!isset($users[$email])) return ['ok' => false, 'error' => 'User not found'];
    $users[$email]['scope']     = ['projects' => $projects];
    $users[$email]['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z');
    _userFileSaveAll($users);
    return ['ok' => true, 'user' => $users[$email]];
}

function deleteUser($email) {
    $email = strtolower(trim((string)$email));
    if (db()) return _userDbDelete($email);

    $users = _userFileLoadAll();
    if (!isset($users[$email])) return ['ok' => false, 'error' => 'User not found'];
    unset($users[$email]);
    _userFileSaveAll($users);
    return ['ok' => true];
}

// Phase 5: record successful login. No-op for the file driver (Phase 4
// audit log already covers it).
function touchUserLogin($email) {
    if (!db()) return;
    $email = strtolower(trim((string)$email));
    if ($email === '') return;
    try { _userDbTouchLogin($email); } catch (Throwable $e) {
        error_log('[user_store] touchUserLogin failed: ' . $e->getMessage());
    }
}
