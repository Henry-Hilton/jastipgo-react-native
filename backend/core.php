<?php

declare(strict_types=1);

final class ApiError extends RuntimeException
{
    public function __construct(string $message, public int $status = 422)
    {
        parent::__construct($message);
    }
}

function fail(string $message, int $status = 422): never
{
    throw new ApiError($message, $status);
}

function db(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }
    $path = __DIR__ . '/config.php';
    $config = is_file($path) ? require $path : [];
    date_default_timezone_set($config['timezone'] ?? 'Asia/Jakarta');
    $dsn = getenv('JASTIPGO_DSN') ?: ($config['dsn'] ?? '');
    if ($dsn === '') {
        fail('Backend database belum dikonfigurasi.', 503);
    }
    $connection = new PDO(
        $dsn,
        getenv('JASTIPGO_DB_USER') ?: ($config['user'] ?? ''),
        getenv('JASTIPGO_DB_PASSWORD') ?: ($config['password'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    $connection->exec('SET time_zone = ' . $connection->quote(date('P')));
    return $connection;
}

function query(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function one(string $sql, array $params = []): array
{
    return query($sql, $params)->fetch() ?: [];
}

function transaction(callable $work): mixed
{
    db()->beginTransaction();
    try {
        $result = $work();
        db()->commit();
        return $result;
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $error;
    }
}

function text(array $data, string $key, int $max = 150, bool $required = true): string
{
    $value = $data[$key] ?? '';
    if (!is_string($value)) {
        fail("Isian $key tidak valid.");
    }
    $value = trim($value);
    if (($required && $value === '') || strlen($value) > $max) {
        fail("Periksa isian $key.");
    }
    return $value;
}

function integer(array $data, string $key, int $min = 1, int $max = 1000000000): int
{
    $value = filter_var($data[$key] ?? null, FILTER_VALIDATE_INT);
    if ($value === false || $value < $min || $value > $max) {
        fail("Periksa angka $key.");
    }
    return $value;
}

function dateValue(array $data, string $key): string
{
    $value = text($data, $key, 10);
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$parsed || $parsed->format('Y-m-d') !== $value) {
        fail('Tanggal tidak valid.');
    }
    return $value;
}

function currentUser(): array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer ([a-f0-9]{64})$/', $header, $match)) {
        fail('Silakan masuk kembali.', 401);
    }
    $user = one('SELECT u.id,u.name,u.email,u.balance FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW()', [hash('sha256', $match[1])]);
    if (!$user) {
        fail('Sesi berakhir. Silakan masuk kembali.', 401);
    }
    return $user;
}

function requireRole(string $role): void
{
    if (($_SERVER['HTTP_X_ROLE'] ?? '') !== $role) {
        fail("Beralih ke peran $role untuk tindakan ini.", 403);
    }
}

function ownTrip(int $id, int $userId, bool $lock = false): array
{
    $trip = one('SELECT * FROM trips WHERE id=?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    if (!$trip || (int)$trip['owner_id'] !== $userId) {
        fail('Trip tidak dapat diakses.', 403);
    }
    return $trip;
}

function activeTrip(array $trip): void
{
    if (!in_array($trip['status'], ['open', 'live'], true) || $trip['return_date'] < date('Y-m-d')) {
        fail('Trip sudah tidak menerima pesanan.');
    }
}

function notify(int $userId, string $message): void
{
    query('INSERT INTO notifications(user_id,message) VALUES(?,?)', [$userId, $message]);
}

function productCategories(int $productId, mixed $ids): void
{
    if (!is_array($ids) || !$ids || count($ids) > 6) {
        fail('Pilih minimal satu kategori.');
    }
    $categories = [];
    foreach ($ids as $id) {
        $categories[] = integer(['id' => $id], 'id', 1, 6);
    }
    query('DELETE FROM product_categories WHERE product_id=?', [$productId]);
    foreach (array_unique($categories) as $id) {
        query('INSERT INTO product_categories(product_id,category_id) VALUES(?,?)', [$productId, $id]);
    }
}

function productRows(string $where, array $params, int $userId): array
{
    $rows = query('SELECT p.*,t.name AS trip_name,t.destination,t.departure,t.return_date,t.status AS trip_status,t.owner_id,u.name AS owner_name,
        EXISTS(SELECT 1 FROM favorites f WHERE f.product_id=p.id AND f.user_id=?) AS favorite
        FROM products p JOIN trips t ON t.id=p.trip_id JOIN users u ON u.id=t.owner_id WHERE ' . $where . ' ORDER BY p.id DESC', [$userId, ...$params])->fetchAll();
    foreach ($rows as &$row) {
        $row['categories'] = query('SELECT c.* FROM categories c JOIN product_categories pc ON pc.category_id=c.id WHERE pc.product_id=?', [$row['id']])->fetchAll();
    }
    return $rows;
}

function saveImage(string $encoded, int $userId): string
{
    if (strlen($encoded) > 8000000) {
        fail('Foto maksimal 6 MB.');
    }
    $bytes = base64_decode($encoded, true);
    if ($bytes === false || strlen($bytes) > 6000000) {
        fail('Foto tidak valid.');
    }
    $image = @getimagesizefromstring($bytes);
    if (!$image || !in_array($image['mime'], ['image/jpeg','image/png'], true)
        || $image[0] > 4096 || $image[1] > 4096 || $image[0] * $image[1] > 16000000) {
        fail('Gunakan foto JPG/PNG maksimal 4096 piksel dan 16 megapiksel.');
    }
    if (!function_exists('imagecreatefromstring')) {
        fail('Server memerlukan ekstensi GD untuk menyimpan PNG.', 503);
    }
    $decoded = @imagecreatefromstring($bytes);
    if (!$decoded) {
        fail('Foto tidak dapat dibaca.');
    }
    $folder = __DIR__ . '/images/' . $userId;
    if (!is_dir($folder) && !mkdir($folder, 0775, true) && !is_dir($folder)) {
        fail('Folder foto tidak dapat dibuat.', 500);
    }
    $path = 'images/' . $userId . '/' . date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.png';
    if (!imagepng($decoded, __DIR__ . '/' . $path)) {
        fail('Foto gagal disimpan.', 500);
    }
    return $path;
}

function ownedImage(string $path, int $userId): string
{
    if ($path === '') {
        return '';
    }
    if (!preg_match('#^images/' . $userId . '/[a-zA-Z0-9_]+\.png$#', $path) || !is_file(__DIR__ . '/' . $path)) {
        fail('Unggah foto terlebih dahulu.');
    }
    return $path;
}
