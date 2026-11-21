<?php

declare(strict_types=1);
require_once __DIR__ . '/core.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Role');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail('Gunakan POST.', 405);
    }
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 8500000) {
        fail('Permintaan terlalu besar.', 413);
    }
    $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        fail('JSON tidak valid.');
    }
    $action = text($data, 'action', 40);
    $result = dispatch($action, $data);
    echo json_encode(['result' => 'success', 'data' => $result], JSON_THROW_ON_ERROR);
} catch (ApiError $error) {
    http_response_code($error->status);
    echo json_encode(['result' => 'error', 'message' => $error->getMessage()]);
} catch (JsonException $error) {
    http_response_code(400);
    echo json_encode(['result' => 'error', 'message' => 'JSON tidak valid.']);
} catch (Throwable $error) {
    error_log((string)$error);
    http_response_code(500);
    echo json_encode(['result' => 'error', 'message' => 'Server gagal memproses permintaan. Coba lagi.']);
}

function dispatch(string $action, array $data): mixed
{
    if ($action === 'register' || $action === 'login') {
        $email = strtolower(text($data, 'email', 190));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('Email tidak valid.');
        }
        $password = $data['password'] ?? null;
        if (!is_string($password) || $password === '' || strlen($password) > 72) {
            fail('Password harus 1 sampai 72 byte.');
        }
        if ($action === 'register') {
            if (strlen($password) < 8) {
                fail('Password minimal 8 karakter.');
            }
            $name = text($data, 'name', 100);
            try {
                query('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)', [$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
            } catch (PDOException $error) {
                if ($error->getCode() === '23000') {
                    fail('Email sudah terdaftar.');
                }
                throw $error;
            }
        }
        $user = one('SELECT * FROM users WHERE email=?', [$email]);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            fail('Email atau password salah.', 401);
        }
        $token = bin2hex(random_bytes(32));
        query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 30 DAY))', [hash('sha256', $token), $user['id']]);
        unset($user['password_hash']);
        return ['user' => $user, 'token' => $token];
    }

    $user = currentUser();
    $uid = (int)$user['id'];
    switch ($action) {
        case 'me': return $user;
        case 'logout':
            query('DELETE FROM sessions WHERE token_hash=?', [hash('sha256', substr($_SERVER['HTTP_AUTHORIZATION'], 7))]);
            return [];
        case 'categories': return query('SELECT * FROM categories ORDER BY id')->fetchAll();
        case 'catalog':
            $where = "t.status IN ('open','live') AND t.return_date>=CURRENT_DATE";
            $params = [];
            foreach (['name' => 'p.name', 'destination' => "CONCAT(t.name,' ',t.destination)"] as $key => $column) {
                $value = text($data, $key, 150, false);
                if ($value !== '') {
                    $where .= " AND $column LIKE ?";
                    $params[] = '%' . $value . '%';
                }
            }
            if (!empty($data['category_id'])) {
                $where .= ' AND EXISTS(SELECT 1 FROM product_categories pc WHERE pc.product_id=p.id AND pc.category_id=?)';
                $params[] = integer($data, 'category_id', 1, 6);
            }
            if (!empty($data['favorites'])) {
                $where .= ' AND EXISTS(SELECT 1 FROM favorites f WHERE f.product_id=p.id AND f.user_id=?)';
                $params[] = $uid;
            }
            return productRows($where, $params, $uid);
        case 'product':
            $products = productRows('p.id=?', [integer($data, 'id')], $uid);
            if (!$products) {
                fail('Barang tidak ditemukan.', 404);
            }
            $product = $products[0];
            $product['reviews'] = query('SELECT r.*,u.name AS buyer_name FROM reviews r JOIN orders o ON o.id=r.order_id JOIN users u ON u.id=o.buyer_id JOIN order_items oi ON oi.order_id=o.id WHERE oi.product_id=? ORDER BY r.created_at DESC', [$product['id']])->fetchAll();
            return $product;
        case 'favorite':
            $id = integer($data, 'product_id');
            if (!one('SELECT id FROM products WHERE id=?', [$id])) {
                fail('Barang tidak ditemukan.', 404);
            }
            if (!empty($data['enabled'])) {
                query('INSERT IGNORE INTO favorites(user_id,product_id) VALUES(?,?)', [$uid,$id]);
            } else {
                query('DELETE FROM favorites WHERE user_id=? AND product_id=?', [$uid,$id]);
            }
            return [];
        case 'trips':
            if (!empty($data['mine'])) {
                return query('SELECT t.*,u.name AS owner_name FROM trips t JOIN users u ON u.id=t.owner_id WHERE t.owner_id=? ORDER BY t.id DESC', [$uid])->fetchAll();
            }
            return query("SELECT t.*,u.name AS owner_name FROM trips t JOIN users u ON u.id=t.owner_id WHERE t.status IN ('open','live') AND t.return_date>=CURRENT_DATE ORDER BY t.departure,t.id DESC")->fetchAll();
        case 'trip':
            $id = integer($data, 'id');
            $trip = one('SELECT t.*,u.name AS owner_name FROM trips t JOIN users u ON u.id=t.owner_id WHERE t.id=?', [$id]);
            if (!$trip) {
                fail('Trip tidak ditemukan.', 404);
            }
            $trip['products'] = productRows('p.trip_id=?', [$id], $uid);
            $trip['checkins'] = query('SELECT * FROM checkins WHERE trip_id=? ORDER BY id DESC', [$id])->fetchAll();
            $trip['requests'] = query('SELECT r.*,u.name AS buyer_name FROM requests r JOIN users u ON u.id=r.buyer_id WHERE r.trip_id=?' . ((int)$trip['owner_id'] === $uid ? '' : ' AND r.buyer_id=?') . ' ORDER BY r.id DESC', (int)$trip['owner_id'] === $uid ? [$id] : [$id,$uid])->fetchAll();
            if ((int)$trip['owner_id'] === $uid) {
                $trip['summary'] = query("SELECT oi.product_id,oi.name,SUM(oi.quantity) AS quantity,SUM(oi.quantity*oi.price) AS total FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.trip_id=? GROUP BY oi.product_id,oi.name ORDER BY oi.name", [$id])->fetchAll();
            }
            return $trip;
        case 'save_trip':
            requireRole('jastiper');
            $name = text($data, 'name');
            $destination = text($data, 'destination');
            $departure = dateValue($data, 'departure');
            $return = dateValue($data, 'return_date');
            if ($return < $departure || $return < date('Y-m-d')) {
                fail('Periksa rentang tanggal trip.');
            }
            return transaction(function () use ($data, $uid, $name, $destination, $departure, $return) {
                if (!empty($data['id'])) {
                    $id = integer($data, 'id');
                    $trip = ownTrip($id, $uid, true);
                    if ($trip['status'] === 'finished') {
                        fail('Trip selesai tidak dapat diedit.');
                    }
                    if ($trip['status'] === 'live' && $departure > date('Y-m-d')) {
                        fail('Tanggal berangkat trip live tidak dapat di masa depan.');
                    }
                    query('UPDATE trips SET name=?,destination=?,departure=?,return_date=? WHERE id=?', [$name,$destination,$departure,$return,$id]);
                } else {
                    query('INSERT INTO trips(owner_id,name,destination,departure,return_date) VALUES(?,?,?,?,?)', [$uid,$name,$destination,$departure,$return]);
                    $id = (int)db()->lastInsertId();
                }
                return ['id' => $id];
            });
        case 'trip_status':
            requireRole('jastiper');
            return transaction(function () use ($data, $uid) {
                $trip = ownTrip(integer($data, 'id'), $uid, true);
                $status = text($data, 'status', 20);
                if ($trip['status'] === $status) {
                    return [];
                }
                if ($status === 'live' && $trip['status'] === 'open') {
                    if (date('Y-m-d') < $trip['departure'] || date('Y-m-d') > $trip['return_date']) {
                        fail('Trip hanya dapat live pada tanggal perjalanannya.');
                    }
                } elseif (!($status === 'finished' && $trip['status'] === 'live')) {
                    fail('Perubahan status trip tidak valid.');
                }
                query('UPDATE trips SET status=? WHERE id=?', [$status,$trip['id']]);
                return [];
            });
        case 'save_product':
            requireRole('jastiper');
            return transaction(function () use ($data, $uid) {
                $trip = ownTrip(integer($data, 'trip_id'), $uid, true);
                activeTrip($trip);
                $name = text($data, 'name');
                $description = text($data, 'description', 5000);
                $price = integer($data, 'price');
                $stock = integer($data, 'stock', 0, 100000);
                $photo = ownedImage(text($data, 'photo', 255, false), $uid);
                if ($photo === '') {
                    fail('Foto barang wajib diunggah.');
                }
                if (!empty($data['id'])) {
                    $id = integer($data, 'id');
                    $existing = one('SELECT * FROM products WHERE id=? FOR UPDATE', [$id]);
                    if (!$existing || (int)$existing['trip_id'] !== (int)$trip['id']) {
                        fail('Barang tidak dapat diakses.', 403);
                    }
                    query('UPDATE products SET name=?,description=?,price=?,stock=?,photo=? WHERE id=?', [$name,$description,$price,$stock,$photo,$id]);
                } else {
                    query('INSERT INTO products(trip_id,name,description,price,stock,photo) VALUES(?,?,?,?,?,?)', [$trip['id'],$name,$description,$price,$stock,$photo]);
                    $id = (int)db()->lastInsertId();
                }
                productCategories($id, $data['category_ids'] ?? []);
                return ['id' => $id];
            });
        case 'request':
            requireRole('penitip');
            return transaction(function () use ($data, $uid) {
                $trip = one('SELECT * FROM trips WHERE id=? FOR UPDATE', [integer($data, 'trip_id')]);
                if (!$trip) {
                    fail('Trip tidak ditemukan.', 404);
                } activeTrip($trip);
                if ((int)$trip['owner_id'] === $uid) {
                    fail('Pilih trip milik jastiper lain.');
                }
                query('INSERT INTO requests(trip_id,buyer_id,name,description) VALUES(?,?,?,?)', [$trip['id'],$uid,text($data, 'name'),text($data, 'description', 5000)]);
                notify((int)$trip['owner_id'], 'Request baru untuk ' . $trip['name']);
                return [];
            });
        case 'review_request':
            requireRole('jastiper');
            return transaction(function () use ($data, $uid) {
                $id = integer($data, 'id');
                $request = one('SELECT * FROM requests WHERE id=?', [$id]);
                if (!$request) {
                    fail('Request tidak ditemukan.', 404);
                }
                $trip = ownTrip((int)$request['trip_id'], $uid, true);
                activeTrip($trip);
                $request = one('SELECT * FROM requests WHERE id=? FOR UPDATE', [$id]);
                if ($request['status'] !== 'pending') {
                    fail('Request sudah diproses.');
                }
                $approve = !empty($data['approve']);
                if ($approve) {
                    $photo = ownedImage(text($data, 'photo', 255), $uid);
                    query('INSERT INTO products(trip_id,source_request_id,name,description,price,stock,photo) VALUES(?,?,?,?,?,?,?)', [$trip['id'],$id,$request['name'],$request['description'],integer($data, 'price'),integer($data, 'stock', 1, 100000),$photo]);
                    productCategories((int)db()->lastInsertId(), $data['category_ids'] ?? []);
                }
                query('UPDATE requests SET status=? WHERE id=?', [$approve ? 'approved' : 'rejected',$id]);
                notify((int)$request['buyer_id'], 'Request ' . $request['name'] . ($approve ? ' disetujui. Barang tersedia di katalog.' : ' ditolak.'));
                return [];
            });
        case 'cart':
            return query('SELECT c.quantity,p.*,t.name AS trip_name,t.owner_id,t.status AS trip_status,t.return_date FROM cart c JOIN products p ON p.id=c.product_id JOIN trips t ON t.id=p.trip_id WHERE c.user_id=? ORDER BY p.trip_id,p.id', [$uid])->fetchAll();
        case 'cart_set':
            requireRole('penitip');
            return transaction(function () use ($data, $uid) {
                // The buyer row serializes cart writes, top-ups and checkout.
                one('SELECT id FROM users WHERE id=? FOR UPDATE', [$uid]);
                $id = integer($data, 'product_id');
                $quantity = integer($data, 'quantity', 0, 100000);
                if ($quantity === 0) {
                    query('DELETE FROM cart WHERE user_id=? AND product_id=?', [$uid,$id]);
                    return [];
                }
                $product = one('SELECT p.*,t.owner_id,t.status,t.return_date FROM products p JOIN trips t ON t.id=p.trip_id WHERE p.id=?', [$id]);
                if (!$product) {
                    fail('Barang tidak ditemukan.', 404);
                } activeTrip($product);
                if ((int)$product['owner_id'] === $uid) {
                    fail('Pilih barang milik jastiper lain.');
                }
                if ($quantity > (int)$product['stock']) {
                    fail('Stok tidak cukup.');
                }
                query('INSERT INTO cart(user_id,product_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)', [$uid,$id,$quantity]);
                return [];
            });
        case 'checkout':
            requireRole('penitip');
            return transaction(function () use ($data, $uid) {
                $buyer = one('SELECT * FROM users WHERE id=? FOR UPDATE', [$uid]);
                $key = text($data, 'operation_key', 80);
                $existing = one('SELECT id FROM checkouts WHERE buyer_id=? AND operation_key=?', [$uid,$key]);
                if ($existing) {
                    return ['checkout_id' => (int)$existing['id']];
                }
                $cart = query('SELECT * FROM cart WHERE user_id=? ORDER BY product_id', [$uid])->fetchAll();
                if (!$cart) {
                    fail('Keranjang masih kosong.');
                }
                $tripIds = [];
                foreach ($cart as $item) {
                    $product = one('SELECT trip_id FROM products WHERE id=?', [$item['product_id']]);
                    $tripIds[] = (int)$product['trip_id'];
                }
                sort($tripIds);
                $trips = [];
                foreach (array_unique($tripIds) as $id) {
                    $trip = one('SELECT * FROM trips WHERE id=? FOR UPDATE', [$id]);
                    activeTrip($trip);
                    if ((int)$trip['owner_id'] === $uid) {
                        fail('Tidak dapat membeli barang sendiri.');
                    }
                    $trips[$id] = $trip;
                }
                $groups = [];
                $total = 0;
                foreach ($cart as $item) {
                    $product = one('SELECT * FROM products WHERE id=? FOR UPDATE', [$item['product_id']]);
                    $quantity = (int)$item['quantity'];
                    if ((int)$product['stock'] < $quantity) {
                        fail('Stok ' . $product['name'] . ' tidak cukup. Perbarui keranjang.');
                    }
                    $product['quantity'] = $quantity;
                    $groups[(int)$product['trip_id']][] = $product;
                    $total += (int)$product['price'] * $quantity;
                }
                if ((int)$buyer['balance'] < $total) {
                    fail('Saldo tidak cukup. Lakukan top-up terlebih dahulu.');
                }
                query('INSERT INTO checkouts(buyer_id,operation_key) VALUES(?,?)', [$uid,$key]);
                $checkoutId = (int)db()->lastInsertId();
                foreach ($groups as $tripId => $items) {
                    $subtotal = array_sum(array_map(fn ($p) => (int)$p['price'] * $p['quantity'], $items));
                    query('INSERT INTO orders(checkout_id,buyer_id,trip_id,total) VALUES(?,?,?,?)', [$checkoutId,$uid,$tripId,$subtotal]);
                    $orderId = (int)db()->lastInsertId();
                    foreach ($items as $item) {
                        query('INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(?,?,?,?,?)', [$orderId,$item['id'],$item['name'],$item['price'],$item['quantity']]);
                        query('UPDATE products SET stock=stock-? WHERE id=?', [$item['quantity'],$item['id']]);
                    }
                    notify((int)$trips[$tripId]['owner_id'], "Pesanan #$orderId telah dibayar.");
                }
                query('UPDATE users SET balance=balance-? WHERE id=?', [$total,$uid]);
                query('INSERT INTO ledger(user_id,amount,description,operation_key) VALUES(?,?,?,?)', [$uid,-$total,'Pembayaran checkout #'.$checkoutId,'checkout:'.$checkoutId]);
                query('DELETE FROM cart WHERE user_id=?', [$uid]);
                notify($uid, 'Checkout berhasil. Saldo ditahan hingga pesanan selesai.');
                return ['checkout_id' => $checkoutId];
            });
        case 'wallet':
            return ['balance' => $user['balance'],'ledger' => query('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 100', [$uid])->fetchAll()];
        case 'topup':
            return transaction(function () use ($data, $uid) {
                one('SELECT id FROM users WHERE id=? FOR UPDATE', [$uid]);
                $key = 'topup:'.text($data, 'operation_key', 80);
                $amount = integer($data, 'amount', 1000, 10000000);
                $existing = one('SELECT amount FROM ledger WHERE user_id=? AND operation_key=?', [$uid,$key]);
                if ($existing) {
                    if ((int)$existing['amount'] !== $amount) {
                        fail('Top-up ini sudah diproses dengan nominal lain. Periksa riwayat saldo.');
                    }
                    return [];
                }
                query('UPDATE users SET balance=balance+? WHERE id=?', [$amount,$uid]);
                query('INSERT INTO ledger(user_id,amount,description,operation_key) VALUES(?,?,?,?)', [$uid,$amount,'Top-up saldo',$key]);
                return [];
            });
        case 'orders':
            $seller = ($_SERVER['HTTP_X_ROLE'] ?? '') === 'jastiper';
            $rows = query('SELECT o.*,t.name AS trip_name,t.owner_id,u.name AS buyer_name,s.name AS seller_name,r.rating,r.comment FROM orders o JOIN trips t ON t.id=o.trip_id JOIN users u ON u.id=o.buyer_id JOIN users s ON s.id=t.owner_id LEFT JOIN reviews r ON r.order_id=o.id WHERE '.($seller ? 't.owner_id=?' : 'o.buyer_id=?').' ORDER BY o.id DESC', [$uid])->fetchAll();
            foreach ($rows as &$row) {
                $row['items'] = query('SELECT * FROM order_items WHERE order_id=?', [$row['id']])->fetchAll();
            }
            return $rows;
        case 'order_status':
            return transaction(function () use ($data, $uid) {
                $id = integer($data, 'id');
                $order = one('SELECT o.*,t.owner_id FROM orders o JOIN trips t ON t.id=o.trip_id WHERE o.id=?', [$id]);
                if (!$order) {
                    fail('Pesanan tidak ditemukan.', 404);
                }
                $next = text($data, 'status', 20);
                $buyer = (int)$order['buyer_id'];
                $seller = (int)$order['owner_id'];
                // Use ascending user locks for settlement to avoid buyer/seller lock inversion.
                $lockIds = [$buyer,$seller];
                sort($lockIds);
                foreach (array_unique($lockIds) as $lockId) {
                    one('SELECT id FROM users WHERE id=? FOR UPDATE', [$lockId]);
                }
                $order = one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$id]);
                if ($next === 'completed') {
                    requireRole('penitip');
                    if ($buyer !== $uid) {
                        fail('Pesanan tidak dapat diakses.', 403);
                    }
                } else {
                    requireRole('jastiper');
                    if ($seller !== $uid) {
                        fail('Pesanan tidak dapat diakses.', 403);
                    }
                }
                if ($order['status'] === $next) {
                    return [];
                }
                $allowed = ['paid' => 'purchased','purchased' => 'delivered','delivered' => 'completed'];
                if (($allowed[$order['status']] ?? '') !== $next) {
                    fail('Urutan status pesanan tidak valid.');
                }
                query('UPDATE orders SET status=? WHERE id=?', [$next,$id]);
                if ($next === 'completed') {
                    query('UPDATE users SET balance=balance+? WHERE id=?', [$order['total'],$seller]);
                    query('INSERT INTO ledger(user_id,amount,description,operation_key) VALUES(?,?,?,?)', [$seller,$order['total'],"Pesanan #$id selesai",'settle:'.$id]);
                }
                notify($buyer, "Pesanan #$id berstatus $next.");
                notify($seller, "Pesanan #$id berstatus $next.");
                return [];
            });
        case 'review':
            requireRole('penitip');
            return transaction(function () use ($data, $uid) {
                $id = integer($data, 'order_id');
                $order = one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$id]);
                if (!$order || (int)$order['buyer_id'] !== $uid || $order['status'] !== 'completed') {
                    fail('Ulasan tersedia setelah pesanan selesai.', 403);
                }
                if (one('SELECT order_id FROM reviews WHERE order_id=?', [$id])) {
                    fail('Pesanan sudah diulas.');
                }
                query('INSERT INTO reviews(order_id,rating,comment) VALUES(?,?,?)', [$id,integer($data, 'rating', 1, 5),text($data, 'comment', 1000)]);
                return [];
            });
        case 'checkin':
            requireRole('jastiper');
            return transaction(function () use ($data, $uid) {
                $trip = ownTrip(integer($data, 'trip_id'), $uid, true);
                if ($trip['status'] !== 'live' || date('Y-m-d') < $trip['departure'] || date('Y-m-d') > $trip['return_date']) {
                    fail('Check-in hanya tersedia saat live trip pada tanggalnya.');
                }
                $latitude = filter_var($data['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
                $longitude = filter_var($data['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
                $accuracy = filter_var($data['accuracy'] ?? null, FILTER_VALIDATE_FLOAT);
                if ($latitude === false || $longitude === false || $accuracy === false || !is_finite($latitude) || !is_finite($longitude) || !is_finite($accuracy) || abs($latitude) > 90 || abs($longitude) > 180 || $accuracy < 0) {
                    fail('Koordinat GPS tidak valid.');
                }
                $photo = ownedImage(text($data,'photo',255),$uid);
                query('INSERT INTO checkins(trip_id,latitude,longitude,accuracy,note,photo) VALUES(?,?,?,?,?,?)',[$trip['id'],$latitude,$longitude,$accuracy,text($data,'note',200),$photo]);
                return [];
            });
        case 'upload': return ['path' => saveImage(text($data,'image',8000000),$uid)];
        case 'inbox': return query('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',[$uid])->fetchAll();
        case 'read_inbox': query('UPDATE notifications SET is_read=1 WHERE user_id=?',[$uid]);
            return [];
        default: fail('Endpoint tidak ditemukan.',404);
    }
}
