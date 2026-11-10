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
        'photographer' => $existing ? $existing['photographer'] : '',
        'source' => $source,
        'createdAt' => $existing ? $existing['createdAt'] : iso_now(),
    ];
}

function assert_slot(array $state, array $record) {
    $status = slot_status($state['bookings'], $state['blocks'], $record['date'], $record['startTime'], $record['endTime'], $record['id']);
    if (!$status['ok']) throw new ApiException($status['message'], 409);
}

function assign_photographer(array $state, array $record, $requested, $auto) {
    $taken = taken_photographers($state['bookings'], $record['date'], $record['startTime'], $record['endTime'], $record['id']);
    if (!$auto) {
        if ($requested === '') return '';
        if (!in_array($requested, PHOTOGRAPHERS, true)) throw new ApiException('Fotografer tidak dikenali.', 400);
        if (isset($taken[$requested])) throw new ApiException('Fotografer ' . $requested . ' sudah ada sesi di jam ini.', 409);
        return $requested;
    }
    if ($record['photographer'] !== '' && !isset($taken[$record['photographer']])) return $record['photographer'];
    return first_free_photographer($state['bookings'], $record['date'], $record['startTime'], $record['endTime'], $record['id']);
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
                clean_text(isset($body['photographer']) ? $body['photographer'] : '', 1),
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
            return ['booking' => $record, 'bookings' => $bookings, 'blocks' => $state['blocks']];
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
    ];
    $path = request_path();
    if (!isset($routes[$path])) throw new ApiException('Tidak ditemukan.', 404);
    $routes[$path]();
}
