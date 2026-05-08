<?php
require_once __DIR__ . '/../auth_helper.php';

authCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$me = currentSessionUser();
if (!$me) jsonError('Authentication required', 401);
if (($me['role'] ?? '') !== 'admin') jsonError('Admin access required', 403);

$limit  = isset($_GET['limit'])  ? max(1, min(2000, intval($_GET['limit']))) : 200;
$action = isset($_GET['action']) ? trim($_GET['action']) : null;
$user   = isset($_GET['user'])   ? trim($_GET['user'])   : null;

$rows = auditTail($limit, $action, $user);

echo json_encode([
    'success' => true,
    'count'   => count($rows),
    'limit'   => $limit,
    'rows'    => $rows,
]);
