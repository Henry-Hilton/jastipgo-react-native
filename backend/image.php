<?php

declare(strict_types=1);

// Serve normalized uploads with CORS on both nginx and Apache hosting.
$path = $_GET['path'] ?? '';
if (!is_string($path)
    || !preg_match('#^images/[0-9]+/[a-zA-Z0-9_]+\.png$#', $path)
    || !is_file(__DIR__ . '/' . $path)) {
    http_response_code(404);
    exit;
}
header('Content-Type: image/png');
header('Access-Control-Allow-Origin: *');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=86400, immutable');
readfile(__DIR__ . '/' . $path);
