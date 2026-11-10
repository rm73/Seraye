<?php

require_once __DIR__ . '/schedule.php';
require_once __DIR__ . '/db.php';

class ApiException extends Exception {
    public $status;

    public function __construct($message, $status = 500) {
        parent::__construct($message);
        $this->status = $status;
    }
}

function send_json($status, array $body) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function request_path() {
    $uri = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
    $path = rtrim((string) $uri, '/');
    return $path === '' ? '/' : $path;
}

function read_body() {
    $raw = file_get_contents('php://input');
    if ($raw === false) $raw = '';
    if (strlen($raw) > 100000) throw new ApiException('Data terlalu besar.', 413);
    if ($raw === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) throw new ApiException('Format data tidak dikenali.', 400);
    if ($decoded !== [] && array_keys($decoded) === range(0, count($decoded) - 1)) {
        throw new ApiException('Format data tidak dikenali.', 400);
    }
    return $decoded;
}

function b64url_encode($raw) {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function b64url_decode($data) {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    $decoded = base64_decode(strtr($data, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

function token_secret() {
    $config = app_config();
    if (!empty($config['admin_secret'])) return $config['admin_secret'];
    if (!empty($config['admin_password'])) return $config['admin_password'];
    return 'seraye-dev-secret';
}

function sign_token() {
    $payload = b64url_encode(json_encode([
        'role' => 'admin',
        'exp' => (int) round(microtime(true) * 1000) + 12 * 60 * 60 * 1000,
        'nonce' => bin2hex(random_bytes(8)),
    ]));
    $signature = b64url_encode(hash_hmac('sha256', $payload, token_secret(), true));
    return $payload . '.' . $signature;
}

function token_is_valid($token) {
    if (!$token || strpos($token, '.') === false) return false;
    $parts = explode('.', $token, 2);
    $expected = b64url_encode(hash_hmac('sha256', $parts[0], token_secret(), true));
    if (!hash_equals($expected, $parts[1])) return false;
    $data = json_decode(b64url_decode($parts[0]), true);
    return is_array($data) && (isset($data['role']) ? $data['role'] : '') === 'admin' && (isset($data['exp']) ? $data['exp'] : 0) > (microtime(true) * 1000);
}

function authorization_header() {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    return '';
}

function is_admin() {
    $header = authorization_header();
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $match)) return false;
    return token_is_valid($match[1]);
}

function require_admin() {
    if (!is_admin()) throw new ApiException('Sesi admin berakhir. Masuk lagi.', 401);
}

function iso_now() {
    $time = microtime(true);
    $ms = str_pad((string) ((int) round(($time - floor($time)) * 1000)), 3, '0', STR_PAD_LEFT);
    return gmdate('Y-m-d\TH:i:s', (int) $time) . '.' . $ms . 'Z';
}

function as_bool($value) {
    return $value === true || $value === 1 || $value === '1' || $value === 'true';
}

function build_record(array $input, $existing) {
    $selected = find_package(isset($input['packageId']) ? $input['packageId'] : '');
    if (!$selected) throw new ApiException('Paket tidak dikenali.', 400);

    $date = clean_text(isset($input['date']) ? $input['date'] : '', 10);
    $startTime = normalize_time(isset($input['startTime']) ? $input['startTime'] : '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $startTime === '') {
        throw new ApiException('Tanggal atau jam belum lengkap.', 400);
    }

    $name = clean_text(isset($input['name']) ? $input['name'] : '', 80);
    $whatsapp = clean_text(isset($input['whatsapp']) ? $input['whatsapp'] : '', 20);
    if (text_length($name) < 3 || text_length($whatsapp) < 10) {
        throw new ApiException('Nama dan WhatsApp wajib diisi.', 400);
    }

    $requestedId = clean_text(isset($input['id']) ? $input['id'] : '', 40);
    $source = $existing ? $existing['source'] : ((isset($input['source']) && $input['source'] === 'copy') ? 'copy' : 'whatsapp');

    return [
        'id' => $requestedId !== '' ? $requestedId : ($existing ? $existing['id'] : make_booking_id($date, $startTime, $selected['code'])),
        'name' => $name,
        'whatsapp' => $whatsapp,
        'date' => $date,
        'startTime' => $startTime,
        'endTime' => add_minutes($startTime, $selected['minutes']),
        'packageId' => $selected['id'],
        'packageName' => $selected['name'],
        'packageCode' => $selected['code'],
        'minutes' => $selected['minutes'],
        'location' => clean_text(isset($input['location']) ? $input['location'] : '', 160),
        'notes' => clean_text(isset($input['notes']) ? $input['notes'] : '', 500),
        'extraPhotos' => max(0, (int) (isset($input['extraPhotos']) ? $input['extraPhotos'] : 0)),
        'includeMua' => as_bool(isset($input['includeMua']) ? $input['includeMua'] : false),
        'makeupDate' => clean_text(isset($input['makeupDate']) ? $input['makeupDate'] : '', 10),
        'makeupTime' => normalize_time(isset($input['makeupTime']) ? $input['makeupTime'] : ''),
        'hairStyle' => clean_text(isset($input['hairStyle']) ? $input['hairStyle'] : '', 20),
        'muaAddress' => clean_text(isset($input['muaAddress']) ? $input['muaAddress'] : '', 240),
        'muaMap' => clean_text(isset($input['muaMap']) ? $input['muaMap'] : '', 300),
        'totalPrice' => (int) (isset($input['totalPrice']) ? $input['totalPrice'] : 0) ?: $selected['price'],
        'bookingFee' => (int) (isset($input['bookingFee']) ? $input['bookingFee'] : 0) ?: 100000,
        'paymentStatus' => (isset($input['paymentStatus']) && $input['paymentStatus'] === 'pelunasan')
            ? 'pelunasan'
            : ($existing && isset($existing['paymentStatus']) ? $existing['paymentStatus'] : 'dp'),
        'photographer' => $existing ? $existing['photographer'] : '',
        'sortOrder' => is_numeric(isset($input['sortOrder']) ? $input['sortOrder'] : null)
            ? (int) $input['sortOrder']
            : ($existing && isset($existing['sortOrder']) ? (int) $existing['sortOrder'] : (int) round(microtime(true) * 1000)),
        'source' => $source,
        'createdAt' => $existing ? $existing['createdAt'] : iso_now(),
    ];
}

function photographer_ids(array $state) {
    if (!empty($state['photographers']) && is_array($state['photographers'])) {
        $ids = [];
        foreach ($state['photographers'] as $item) {
            if (!empty($item['id'])) $ids[] = $item['id'];
        }
        if ($ids) return $ids;
    }
    return PHOTOGRAPHERS;
}

function assert_slot(array $state, array $record) {
    $status = slot_status(
        $state['bookings'],
        $state['blocks'],
        $record['date'],
        $record['startTime'],
        $record['endTime'],
        $record['id'],
        count(photographer_ids($state))
    );
    if (!$status['ok']) throw new ApiException($status['message'], 409);
}

function assign_photographer(array $state, array $record, $requested, $auto) {
    $ids = photographer_ids($state);
    $taken = taken_photographers($state['bookings'], $record['date'], $record['startTime'], $record['endTime'], $record['id']);
    if (!$auto) {
        if ($requested === '') return '';
        if (!in_array($requested, $ids, true)) throw new ApiException('Fotografer tidak dikenali.', 400);
        if (isset($taken[$requested])) throw new ApiException('Fotografer ' . $requested . ' sudah ada sesi di jam ini.', 409);
        return $requested;
    }
    if ($record['photographer'] !== '' && !isset($taken[$record['photographer']]) && in_array($record['photographer'], $ids, true)) {
        return $record['photographer'];
    }
    foreach ($ids as $id) {
        if (!isset($taken[$id])) return $id;
    }
    return '';
}

function find_by_id(array $items, $id) {
    foreach ($items as $item) {
        if ($item['id'] === $id) return $item;
    }
    return null;
}

function handle_auth() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new ApiException('Metode tidak didukung.', 405);
    $body = read_body();
    $config = app_config();
    $password = isset($config['admin_password']) ? (string) $config['admin_password'] : '';
    $linkKey = isset($config['admin_link_key']) ? (string) $config['admin_link_key'] : '';
    if ($password === '' && $linkKey === '') {
        throw new ApiException('Kata sandi admin belum diatur di server.', 503);
    }
    $passwordOk = $password !== '' && hash_equals($password, clean_text(isset($body['password']) ? $body['password'] : '', 200));
    $linkOk = $linkKey !== '' && hash_equals($linkKey, clean_text(isset($body['key']) ? $body['key'] : '', 200));
    if (!$passwordOk && !$linkOk) throw new ApiException('Kata sandi admin salah.', 401);
    send_json(200, ['token' => sign_token()]);
}

function handle_availability() {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') throw new ApiException('Metode tidak didukung.', 405);
    send_json(200, public_schedule(read_state(db())));
}

function handle_client_booking() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new ApiException('Metode tidak didukung.', 405);
    $body = read_body();
    $saved = with_lock(function (PDO $pdo, array $state) use ($body) {
        $existing = find_by_id($state['bookings'], clean_text(isset($body['id']) ? $body['id'] : '', 40));
        $record = build_record($body, $existing);
        assert_slot($state, $record);
        $record['photographer'] = assign_photographer($state, $record, '', true);
        write_booking($pdo, $record);
        return $record;
    });
    send_json(200, ['booking' => $saved]);
}

function handle_admin_schedule() {
    require_admin();
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') throw new ApiException('Metode tidak didukung.', 405);
    $state = read_state(db());
    send_json(200, [
        'bookings' => $state['bookings'],
        'blocks' => $state['blocks'],
        'feedback' => $state['feedback'],
        'photographers' => $state['photographers'],
        'mocks' => $state['mocks'],
        'storage' => 'mysql',
        'persistent' => true,
    ]);
}

function handle_admin_bookings() {
    require_admin();
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'POST' || $method === 'PUT') {
        $body = read_body();
        $savedState = with_lock(function (PDO $pdo, array $state) use ($body, $method) {
            $existing = find_by_id($state['bookings'], clean_text(isset($body['id']) ? $body['id'] : '', 40));
            if ($method === 'PUT' && !$existing) throw new ApiException('Booking tidak ditemukan.', 404);
            $record = build_record(array_merge($body, ['source' => 'admin']), $existing);
            if (!$existing && find_by_id($state['bookings'], $record['id'])) {
                $record['id'] .= '-' . substr(base_convert((string) ((int) round(microtime(true) * 1000)), 10, 36), -3);
            }
            assert_slot($state, $record);
            $record['photographer'] = assign_photographer(
                $state,
                $record,
                strtoupper(clean_text(isset($body['photographer']) ? $body['photographer'] : '', 8)),
                false
            );
            $record['source'] = $existing ? $existing['source'] : 'admin';
            write_booking($pdo, $record);
            $bookings = [];
            $replaced = false;
            foreach ($state['bookings'] as $item) {
                if ($item['id'] === $record['id']) {
                    $bookings[] = $record;
                    $replaced = true;
                } else {
                    $bookings[] = $item;
                }
            }
            if (!$replaced) $bookings[] = $record;
            $mocks = isset($state['mocks']) ? $state['mocks'] : [];
            $mockId = clean_text(isset($body['mockId']) ? $body['mockId'] : '', 40);
            if ($mockId !== '') {
                $stmt = $pdo->prepare('DELETE FROM mocks WHERE id = ?');
                $stmt->execute([$mockId]);
                $mocks = array_values(array_filter($mocks, function ($item) use ($mockId) {
                    return $item['id'] !== $mockId;
                }));
            }
            return [
                'booking' => $record,
                'bookings' => $bookings,
                'blocks' => $state['blocks'],
                'photographers' => isset($state['photographers']) ? $state['photographers'] : [],
                'mocks' => $mocks,
            ];
        });
        send_json(200, $savedState);
    }
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
        $next = with_lock(function (PDO $pdo, array $state) use ($id) {
            $stmt = $pdo->prepare('DELETE FROM bookings WHERE id = ?');
            $stmt->execute([$id]);
            return [
                'bookings' => array_values(array_filter($state['bookings'], function ($item) use ($id) {
                    return $item['id'] !== $id;
                })),
                'blocks' => $state['blocks'],
            ];
        });
        send_json(200, $next);
    }
    throw new ApiException('Metode tidak didukung.', 405);
}

function handle_admin_blocks() {
    require_admin();
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'POST') {
        $body = read_body();
        $startDate = clean_text(isset($body['startDate']) ? $body['startDate'] : '', 10);
        $endDate = clean_text(isset($body['endDate']) && $body['endDate'] !== '' ? $body['endDate'] : $startDate, 10);
        $startTime = normalize_time(isset($body['startTime']) ? $body['startTime'] : '');
        $endTime = normalize_time(isset($body['endTime']) ? $body['endTime'] : '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate) || $endDate < $startDate) {
            throw new ApiException('Rentang tanggal blokir belum benar.', 400);
        }
        if (($startTime !== '' && $endTime === '') || ($startTime === '' && $endTime !== '')) {
            throw new ApiException('Isi jam mulai dan jam selesai, atau kosongkan keduanya untuk menutup seharian.', 400);
        }
        if ($startTime !== '' && $endTime !== '' && ($startDate . 'T' . $startTime) >= ($endDate . 'T' . $endTime)) {
            throw new ApiException('Jam selesai harus setelah jam mulai.', 400);
        }
        $reason = clean_text(isset($body['reason']) ? $body['reason'] : '', 120);
        $block = [
            'id' => 'blk' . bin2hex(random_bytes(5)),
            'startDate' => $startDate,
            'endDate' => $endDate,
            'startTime' => $startTime,
            'endTime' => $endTime,
            'reason' => $reason !== '' ? $reason : 'Ditutup admin',
        ];
        $next = with_lock(function (PDO $pdo, array $state) use ($block) {
            $stmt = $pdo->prepare('INSERT INTO blocks (id, start_date, end_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$block['id'], $block['startDate'], $block['endDate'], $block['startTime'], $block['endTime'], $block['reason']]);
            $blocks = $state['blocks'];
            $blocks[] = $block;
            return ['blocks' => $blocks, 'bookings' => $state['bookings']];
        });
        send_json(200, $next);
    }
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
        $next = with_lock(function (PDO $pdo, array $state) use ($id) {
            $stmt = $pdo->prepare('DELETE FROM blocks WHERE id = ?');
            $stmt->execute([$id]);
            return [
                'blocks' => array_values(array_filter($state['blocks'], function ($item) use ($id) {
                    return $item['id'] !== $id;
                })),
                'bookings' => $state['bookings'],
            ];
        });
        send_json(200, $next);
    }
    throw new ApiException('Metode tidak didukung.', 405);
}

function handle_admin_photographers() {
    require_admin();
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'POST' || $method === 'PUT') {
        $body = read_body();
        $phone = clean_text(isset($body['phone']) ? $body['phone'] : '', 20);
        if (!preg_match('/^(08\d{8,12}|628\d{8,12})$/', preg_replace('/\D/', '', $phone))) {
            throw new ApiException('Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).', 400);
        }
        $next = with_lock(function (PDO $pdo, array $state) use ($body, $method, $phone) {
            $current = $state['photographers'];
            $requestedId = strtoupper(clean_text(isset($body['id']) ? $body['id'] : '', 8));
            if ($method === 'PUT') {
                $index = null;
                foreach ($current as $i => $item) {
                    if ($item['id'] === $requestedId) $index = $i;
                }
                if ($index === null) throw new ApiException('Fotografer tidak ditemukan.', 404);
                $current[$index] = [
                    'id' => $requestedId,
                    'name' => clean_text(isset($body['name']) ? $body['name'] : '', 80) ?: $current[$index]['name'],
                    'phone' => $phone,
                    'notes' => clean_text(isset($body['notes']) ? $body['notes'] : '', 240),
                ];
            } else {
                $id = $requestedId;
                if ($id === '') {
                    $used = [];
                    foreach ($current as $item) $used[$item['id']] = true;
                    $id = 'A';
                    while (isset($used[$id])) $id = chr(ord($id) + 1);
                }
                foreach ($current as $item) {
                    if ($item['id'] === $id) throw new ApiException('ID fotografer sudah dipakai.', 409);
                }
                $current[] = [
                    'id' => $id,
                    'name' => clean_text(isset($body['name']) ? $body['name'] : '', 80) ?: ('Fotografer ' . $id),
                    'phone' => $phone,
                    'notes' => clean_text(isset($body['notes']) ? $body['notes'] : '', 240),
                ];
            }
            $pdo->exec('DELETE FROM photographers');
            $insert = $pdo->prepare('INSERT INTO photographers (id, name, phone, notes, sort_order) VALUES (?, ?, ?, ?, ?)');
            foreach ($current as $index => $item) {
                $insert->execute([$item['id'], $item['name'], $item['phone'], $item['notes'], $index]);
            }
            return [
                'photographers' => $current,
                'bookings' => $state['bookings'],
                'blocks' => $state['blocks'],
                'mocks' => $state['mocks'],
            ];
        });
        send_json(200, $next);
    }
    if ($method === 'DELETE') {
        $id = strtoupper(clean_text(isset($_GET['id']) ? $_GET['id'] : '', 8));
        $next = with_lock(function (PDO $pdo, array $state) use ($id) {
            $current = $state['photographers'];
            if (count($current) <= 1) throw new ApiException('Minimal satu fotografer harus tetap ada.', 400);
            $found = false;
            $remaining = [];
            foreach ($current as $item) {
                if ($item['id'] === $id) $found = true;
                else $remaining[] = $item;
            }
            if (!$found) throw new ApiException('Fotografer tidak ditemukan.', 404);
            $stmt = $pdo->prepare('DELETE FROM photographers WHERE id = ?');
            $stmt->execute([$id]);
            $clear = $pdo->prepare('UPDATE bookings SET photographer = \'\' WHERE photographer = ?');
            $clear->execute([$id]);
            $bookings = [];
            foreach ($state['bookings'] as $booking) {
                if ($booking['photographer'] === $id) $booking['photographer'] = '';
                $bookings[] = $booking;
            }
            return [
                'photographers' => $remaining,
                'bookings' => $bookings,
                'blocks' => $state['blocks'],
                'mocks' => $state['mocks'],
            ];
        });
        send_json(200, $next);
    }
    throw new ApiException('Metode tidak didukung.', 405);
}

function handle_admin_mocks() {
    require_admin();
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'POST' || $method === 'PUT') {
        $body = read_body();
        $next = with_lock(function (PDO $pdo, array $state) use ($body, $method) {
            $name = clean_text(isset($body['name']) ? $body['name'] : '', 80);
            $whatsapp = clean_text(isset($body['whatsapp']) ? $body['whatsapp'] : '', 20);
            if (text_length($name) < 3) throw new ApiException('Nama lengkap minimal 3 karakter.', 400);
            if (!preg_match('/^(08\d{8,12}|628\d{8,12})$/', preg_replace('/\D/', '', $whatsapp))) {
                throw new ApiException('Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).', 400);
            }
            $selected = find_package(isset($body['packageId']) ? $body['packageId'] : '') ?: packages()[0];
            $existing = find_by_id($state['mocks'], clean_text(isset($body['id']) ? $body['id'] : '', 40));
            if ($method === 'PUT' && !$existing) throw new ApiException('Mock customer tidak ditemukan.', 404);
            $record = [
                'id' => $existing ? $existing['id'] : ('mock-' . bin2hex(random_bytes(4))),
                'name' => $name,
                'whatsapp' => $whatsapp,
                'packageId' => $selected['id'],
                'packageName' => $selected['name'],
                'location' => clean_text(isset($body['location']) ? $body['location'] : '', 160),
                'notes' => clean_text(isset($body['notes']) ? $body['notes'] : '', 500),
                'date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', isset($body['date']) ? $body['date'] : '') ? $body['date'] : '',
                'startTime' => normalize_time(isset($body['startTime']) ? $body['startTime'] : ''),
                'extraPhotos' => max(0, (int) (isset($body['extraPhotos']) ? $body['extraPhotos'] : 0)),
                'createdAt' => $existing ? $existing['createdAt'] : iso_now(),
            ];
            if ($existing) {
                $stmt = $pdo->prepare('UPDATE mocks SET name = ?, whatsapp = ?, package_id = ?, package_name = ?, location = ?, notes = ?, session_date = ?, start_time = ?, extra_photos = ? WHERE id = ?');
                $stmt->execute([$record['name'], $record['whatsapp'], $record['packageId'], $record['packageName'], $record['location'], $record['notes'], $record['date'], $record['startTime'], $record['extraPhotos'], $record['id']]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO mocks (id, name, whatsapp, package_id, package_name, location, notes, session_date, start_time, extra_photos, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$record['id'], $record['name'], $record['whatsapp'], $record['packageId'], $record['packageName'], $record['location'], $record['notes'], $record['date'], $record['startTime'], $record['extraPhotos'], $record['createdAt']]);
            }
            $mocks = [];
            $replaced = false;
            foreach ($state['mocks'] as $item) {
                if ($item['id'] === $record['id']) {
                    $mocks[] = $record;
                    $replaced = true;
                } else {
                    $mocks[] = $item;
                }
            }
            if (!$replaced) $mocks[] = $record;
            return [
                'mock' => $record,
                'mocks' => $mocks,
                'bookings' => $state['bookings'],
                'blocks' => $state['blocks'],
                'photographers' => $state['photographers'],
            ];
        });
        send_json(200, $next);
    }
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
        $next = with_lock(function (PDO $pdo, array $state) use ($id) {
            $stmt = $pdo->prepare('DELETE FROM mocks WHERE id = ?');
            $stmt->execute([$id]);
            return [
                'mocks' => array_values(array_filter($state['mocks'], function ($item) use ($id) {
                    return $item['id'] !== $id;
                })),
                'bookings' => $state['bookings'],
                'blocks' => $state['blocks'],
                'photographers' => $state['photographers'],
            ];
        });
        send_json(200, $next);
    }
    throw new ApiException('Metode tidak didukung.', 405);
}

function handle_feedback() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new ApiException('Metode tidak didukung.', 405);
    $body = read_body();
    $service = (int) (isset($body['service']) ? $body['service'] : 0);
    $website = (int) (isset($body['website']) ? $body['website'] : 0);
    if ($service < 1 || $service > 5 || $website < 1 || $website > 5) {
        throw new ApiException('Pilih bintang untuk Seraye Moments dan untuk website seraye.', 400);
    }
    $entry = [
        'id' => 'fb' . bin2hex(random_bytes(5)),
        'service' => $service,
        'website' => $website,
        'message' => clean_text(isset($body['message']) ? $body['message'] : '', 1000),
        'createdAt' => iso_now(),
    ];
    $stmt = db()->prepare('INSERT INTO feedback (id, service, website, message, created_at) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$entry['id'], $entry['service'], $entry['website'], $entry['message'], $entry['createdAt']]);
    send_json(200, ['feedback' => $entry]);
}

function handle_request() {
    $routes = [
        '/api/auth' => 'handle_auth',
        '/api/availability' => 'handle_availability',
        '/api/bookings' => 'handle_client_booking',
        '/api/feedback' => 'handle_feedback',
        '/api/admin/schedule' => 'handle_admin_schedule',
        '/api/admin/bookings' => 'handle_admin_bookings',
        '/api/admin/blocks' => 'handle_admin_blocks',
        '/api/admin/photographers' => 'handle_admin_photographers',
        '/api/admin/mocks' => 'handle_admin_mocks',
    ];
    $path = request_path();
    if (!isset($routes[$path])) throw new ApiException('Tidak ditemukan.', 404);
    $routes[$path]();
}
