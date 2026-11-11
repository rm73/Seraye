<?php

function app_config() {
    static $config;
    if ($config === null) $config = require dirname(__DIR__) . '/config.php';
    return $config;
}

function db() {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;

    $config = app_config();
    $dsn = 'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $error) {
        throw new ApiException(
            'Tidak bisa terhubung ke database MySQL. Di cPanel, tambahkan user ke database, lalu cek host, nama database, dan password di api/config.php.',
            500
        );
    }

    ensure_schema($pdo);
    return $pdo;
}

function ensure_schema(PDO $pdo) {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(48) NOT NULL,
          name VARCHAR(80) NOT NULL,
          whatsapp VARCHAR(20) NOT NULL,
          session_date CHAR(10) NOT NULL,
          start_time VARCHAR(5) NOT NULL,
          end_time VARCHAR(5) NOT NULL,
          package_id VARCHAR(32) NOT NULL,
          package_name VARCHAR(80) NOT NULL,
          package_code VARCHAR(8) NOT NULL,
          minutes SMALLINT NOT NULL,
          location VARCHAR(160) NOT NULL DEFAULT \'\',
          notes VARCHAR(500) NOT NULL DEFAULT \'\',
          extra_photos INT NOT NULL DEFAULT 0,
          include_mua TINYINT(1) NOT NULL DEFAULT 0,
          makeup_date VARCHAR(10) NOT NULL DEFAULT \'\',
          makeup_time VARCHAR(5) NOT NULL DEFAULT \'\',
          hair_style VARCHAR(20) NOT NULL DEFAULT \'\',
          mua_address VARCHAR(240) NOT NULL DEFAULT \'\',
          mua_map VARCHAR(300) NOT NULL DEFAULT \'\',
          total_price INT NOT NULL DEFAULT 0,
          booking_fee INT NOT NULL DEFAULT 100000,
          photographer VARCHAR(8) NOT NULL DEFAULT \'\',
          source VARCHAR(20) NOT NULL DEFAULT \'whatsapp\',
          created_at VARCHAR(40) NOT NULL,
          PRIMARY KEY (id),
          KEY idx_bookings_date (session_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS blocks (
          id VARCHAR(40) NOT NULL,
          start_date CHAR(10) NOT NULL,
          end_date CHAR(10) NOT NULL,
          start_time VARCHAR(5) NOT NULL DEFAULT \'\',
          end_time VARCHAR(5) NOT NULL DEFAULT \'\',
          reason VARCHAR(120) NOT NULL,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS feedback (
          id VARCHAR(40) NOT NULL,
          service TINYINT NOT NULL,
          website TINYINT NOT NULL,
          message VARCHAR(1000) NOT NULL DEFAULT \'\',
          created_at VARCHAR(40) NOT NULL,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS photographers (
          id VARCHAR(8) NOT NULL,
          name VARCHAR(80) NOT NULL,
          phone VARCHAR(20) NOT NULL DEFAULT \'\',
          notes VARCHAR(240) NOT NULL DEFAULT \'\',
          sort_order INT NOT NULL DEFAULT 0,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS mocks (
          id VARCHAR(40) NOT NULL,
          name VARCHAR(80) NOT NULL,
          whatsapp VARCHAR(20) NOT NULL,
          package_id VARCHAR(32) NOT NULL,
          package_name VARCHAR(80) NOT NULL,
          location VARCHAR(160) NOT NULL DEFAULT \'\',
          notes VARCHAR(500) NOT NULL DEFAULT \'\',
          session_date CHAR(10) NOT NULL DEFAULT \'\',
          start_time VARCHAR(5) NOT NULL DEFAULT \'\',
          extra_photos INT NOT NULL DEFAULT 0,
          created_at VARCHAR(40) NOT NULL,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    add_column_if_missing($pdo, 'bookings', 'payment_status', "VARCHAR(20) NOT NULL DEFAULT 'dp'");
    add_column_if_missing($pdo, 'bookings', 'sort_order', 'BIGINT NOT NULL DEFAULT 0');
    add_column_if_missing($pdo, 'mocks', 'session_date', "CHAR(10) NOT NULL DEFAULT ''");
    add_column_if_missing($pdo, 'mocks', 'start_time', "VARCHAR(5) NOT NULL DEFAULT ''");
    add_column_if_missing($pdo, 'mocks', 'extra_photos', 'INT NOT NULL DEFAULT 0');
}

function add_column_if_missing(PDO $pdo, $table, $column, $definition) {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `' . $table . '` ADD COLUMN `' . $column . '` ' . $definition);
    }
}

function booking_from_row(array $row) {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'whatsapp' => $row['whatsapp'],
        'date' => $row['session_date'],
        'startTime' => $row['start_time'],
        'endTime' => $row['end_time'],
        'packageId' => $row['package_id'],
        'packageName' => $row['package_name'],
        'packageCode' => $row['package_code'],
        'minutes' => (int) $row['minutes'],
        'location' => $row['location'],
        'notes' => $row['notes'],
        'extraPhotos' => (int) $row['extra_photos'],
        'includeMua' => (bool) $row['include_mua'],
        'makeupDate' => $row['makeup_date'],
        'makeupTime' => $row['makeup_time'],
        'hairStyle' => $row['hair_style'],
        'muaAddress' => $row['mua_address'],
        'muaMap' => $row['mua_map'],
        'totalPrice' => (int) $row['total_price'],
        'bookingFee' => (int) $row['booking_fee'],
        'paymentStatus' => (isset($row['payment_status']) && $row['payment_status'] === 'pelunasan') ? 'pelunasan' : 'dp',
        'photographer' => $row['photographer'],
        'sortOrder' => isset($row['sort_order']) ? (int) $row['sort_order'] : 0,
        'source' => $row['source'],
        'createdAt' => $row['created_at'],
    ];
}

function block_from_row(array $row) {
    return [
        'id' => $row['id'],
        'startDate' => $row['start_date'],
        'endDate' => $row['end_date'],
        'startTime' => $row['start_time'],
        'endTime' => $row['end_time'],
        'reason' => $row['reason'],
    ];
}

function feedback_from_row(array $row) {
    return [
        'id' => $row['id'],
        'service' => (int) $row['service'],
        'website' => (int) $row['website'],
        'message' => $row['message'],
        'createdAt' => $row['created_at'],
    ];
}

function read_state(PDO $pdo) {
    $bookings = [];
    foreach ($pdo->query('SELECT * FROM bookings ORDER BY created_at ASC, id ASC')->fetchAll() as $row) {
        $bookings[] = booking_from_row($row);
    }
    $blocks = [];
    foreach ($pdo->query('SELECT * FROM blocks ORDER BY start_date ASC, id ASC')->fetchAll() as $row) {
        $blocks[] = block_from_row($row);
    }
    $feedback = [];
    foreach ($pdo->query('SELECT * FROM feedback ORDER BY created_at DESC, id DESC')->fetchAll() as $row) {
        $feedback[] = feedback_from_row($row);
    }
    $photographers = [];
    foreach ($pdo->query('SELECT * FROM photographers ORDER BY sort_order ASC, id ASC')->fetchAll() as $row) {
        $photographers[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'phone' => $row['phone'],
            'notes' => $row['notes'],
        ];
    }
    if (!$photographers) {
        $seed = [['A', 'Fotografer A'], ['B', 'Fotografer B'], ['C', 'Fotografer C']];
        $insert = $pdo->prepare('INSERT INTO photographers (id, name, phone, notes, sort_order) VALUES (?, ?, \'\', \'\', ?)');
        foreach ($seed as $index => $item) {
            $insert->execute([$item[0], $item[1], $index]);
            $photographers[] = ['id' => $item[0], 'name' => $item[1], 'phone' => '', 'notes' => ''];
        }
    }
    $mocks = [];
    foreach ($pdo->query('SELECT * FROM mocks ORDER BY created_at ASC, id ASC')->fetchAll() as $row) {
        $mocks[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'whatsapp' => $row['whatsapp'],
            'packageId' => $row['package_id'],
            'packageName' => $row['package_name'],
            'location' => $row['location'],
            'notes' => $row['notes'],
            'date' => isset($row['session_date']) ? $row['session_date'] : '',
            'startTime' => isset($row['start_time']) ? $row['start_time'] : '',
            'extraPhotos' => isset($row['extra_photos']) ? (int) $row['extra_photos'] : 0,
            'createdAt' => $row['created_at'],
        ];
    }
    return [
        'bookings' => $bookings,
        'blocks' => $blocks,
        'feedback' => $feedback,
        'photographers' => $photographers,
        'mocks' => $mocks,
    ];
}

function public_schedule(array $state) {
    $bookings = [];
    foreach ($state['bookings'] as $booking) {
        $bookings[] = [
            'id' => $booking['id'],
            'date' => $booking['date'],
            'startTime' => $booking['startTime'],
            'endTime' => $booking['endTime'],
            'photographer' => $booking['photographer'],
        ];
    }
    return [
        'bookings' => $bookings,
        'blocks' => $state['blocks'],
        'capacity' => count(photographer_ids($state)),
        'storage' => 'mysql',
        'persistent' => true,
    ];
}

function write_booking(PDO $pdo, array $record) {
    $params = [
        $record['name'],
        $record['whatsapp'],
        $record['date'],
        $record['startTime'],
        $record['endTime'],
        $record['packageId'],
        $record['packageName'],
        $record['packageCode'],
        $record['minutes'],
        $record['location'],
        $record['notes'],
        $record['extraPhotos'],
        $record['includeMua'] ? 1 : 0,
        $record['makeupDate'],
        $record['makeupTime'],
        $record['hairStyle'],
        $record['muaAddress'],
        $record['muaMap'],
        $record['totalPrice'],
        $record['bookingFee'],
        $record['photographer'],
        $record['source'],
        $record['createdAt'],
        isset($record['paymentStatus']) && $record['paymentStatus'] === 'pelunasan' ? 'pelunasan' : 'dp',
        isset($record['sortOrder']) ? (int) $record['sortOrder'] : 0,
        $record['id'],
    ];
    $check = $pdo->prepare('SELECT id FROM bookings WHERE id = ?');
    $check->execute([$record['id']]);
    $exists = $check->fetchAll();
    if ($exists) {
        $stmt = $pdo->prepare(
            'UPDATE bookings SET
              name = ?, whatsapp = ?, session_date = ?, start_time = ?, end_time = ?,
              package_id = ?, package_name = ?, package_code = ?, minutes = ?, location = ?, notes = ?,
              extra_photos = ?, include_mua = ?, makeup_date = ?, makeup_time = ?, hair_style = ?,
              mua_address = ?, mua_map = ?, total_price = ?, booking_fee = ?, photographer = ?, source = ?, created_at = ?,
              payment_status = ?, sort_order = ?
            WHERE id = ?'
        );
        $stmt->execute($params);
        return;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO bookings (
          name, whatsapp, session_date, start_time, end_time,
          package_id, package_name, package_code, minutes, location, notes,
          extra_photos, include_mua, makeup_date, makeup_time, hair_style,
          mua_address, mua_map, total_price, booking_fee, photographer, source, created_at,
          payment_status, sort_order, id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute($params);
}

function with_lock(callable $action) {
    $pdo = db();
    $locked = $pdo->query("SELECT GET_LOCK('seraye_schedule', 15)")->fetchColumn();
    if ((string) $locked !== '1') {
        throw new ApiException('Server sedang sibuk. Coba lagi.', 503);
    }
    try {
        $pdo->beginTransaction();
        $state = read_state($pdo);
        $result = $action($pdo, $state);
        $pdo->commit();
        return $result;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('seraye_schedule')");
    }
}
