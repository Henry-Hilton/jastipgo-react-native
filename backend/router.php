<?php

// Local PHP development server only. Apache uses the supplied .htaccess files.
if (PHP_SAPI !== 'cli-server') {
    http_response_code(404);
    exit;
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (in_array($path, ['/api.php','/uploadimage.php','/image.php'], true)) {
    return false;
}
if (preg_match('#^/images/[0-9]+/[a-zA-Z0-9_]+\.png$#', $path) && is_file(__DIR__ . $path)) {
    header('Content-Type: image/png');
    header('Access-Control-Allow-Origin: *');
    header('X-Content-Type-Options: nosniff');
    readfile(__DIR__ . $path);
    return true;
}
http_response_code(404);
return true;
