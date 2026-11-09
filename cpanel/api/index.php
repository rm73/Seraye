<?php

ini_set('display_errors', '0');

require __DIR__ . '/lib/handlers.php';

try {
    handle_request();
} catch (ApiException $error) {
    send_json($error->status, ['message' => $error->getMessage()]);
} catch (PDOException $error) {
    send_json(500, ['message' => 'Database gagal diakses. Pastikan user MySQL sudah ditambahkan ke database dan punya hak membuat tabel.']);
} catch (Throwable $error) {
    send_json(500, ['message' => 'Server gagal memproses permintaan.']);
}
