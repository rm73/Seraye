<?php

const PHOTOGRAPHERS = ['A', 'B', 'C'];
const CAPACITY = 3;

function packages() {
    return [
        ['id' => 'sempurna', 'code' => 'SMPR', 'name' => 'Sempurna', 'price' => 589000, 'minutes' => 60],
        ['id' => 'sekejap', 'code' => 'SKJP', 'name' => 'Sekejap', 'price' => 329000, 'minutes' => 60],
        ['id' => 'sekilas', 'code' => 'SKLS', 'name' => 'Sekilas', 'price' => 275000, 'minutes' => 45],
        ['id' => 'sejenak', 'code' => 'SJNK', 'name' => 'Sejenak', 'price' => 429000, 'minutes' => 90],
        ['id' => 'sekisah', 'code' => 'SKSH', 'name' => 'Sekisah', 'price' => 249000, 'minutes' => 30],
        ['id' => 'sekawan', 'code' => 'SKWN', 'name' => 'Sekawan', 'price' => 349000, 'minutes' => 60],
    ];
}

function find_package($packageId) {
    foreach (packages() as $package) {
        if ($package['id'] === $packageId) return $package;
    }
    return null;
}

function clean_text($value, $max) {
    $text = trim((string) $value);
    if (function_exists('mb_substr')) return mb_substr($text, 0, $max, 'UTF-8');
    return substr($text, 0, $max);
}

function text_length($value) {
    if (function_exists('mb_strlen')) return mb_strlen($value, 'UTF-8');
    return strlen($value);
}

function normalize_time($value) {
    $value = trim((string) $value);
    if ($value === '') return '';
    $parts = explode(':', $value);
    if (count($parts) < 2 || $parts[0] === '' || $parts[1] === '') return '';
    return str_pad($parts[0], 2, '0', STR_PAD_LEFT) . ':' . str_pad($parts[1], 2, '0', STR_PAD_LEFT);
}

function add_minutes($time, $minutes) {
    $parts = explode(':', normalize_time($time));
    $total = ((int) $parts[0]) * 60 + ((int) $parts[1]) + (int) $minutes;
    $nextHour = str_pad((string) (intdiv($total, 60) % 24), 2, '0', STR_PAD_LEFT);
    $nextMinute = str_pad((string) ($total % 60), 2, '0', STR_PAD_LEFT);
    return $nextHour . ':' . $nextMinute;
}

function ranges_overlap($start, $end, $otherStart, $otherEnd) {
    return $start < $otherEnd && $otherStart < $end;
}

function same_day_blocks($blocks, $date) {
    return array_values(array_filter($blocks, function ($block) use ($date) {
        return $date >= $block['startDate'] && $date <= $block['endDate'];
    }));
}

function is_admin_blocked($blocks, $date, $start, $end) {
    foreach (same_day_blocks($blocks, $date) as $block) {
        if ($block['startTime'] === '' || $block['endTime'] === '') return true;
        $windowStart = $date === $block['startDate'] ? $block['startTime'] : '00:00';
        $windowEnd = $date === $block['endDate'] ? $block['endTime'] : '24:00';
        if ($windowStart >= $windowEnd) continue;
        if (ranges_overlap($start, $end, $windowStart, $windowEnd)) return true;
    }
    return false;
}

function overlapping_bookings($bookings, $date, $start, $end, $ignoreId) {
    return array_values(array_filter($bookings, function ($booking) use ($date, $start, $end, $ignoreId) {
        return $booking['id'] !== $ignoreId
            && $booking['date'] === $date
            && ranges_overlap($start, $end, $booking['startTime'], $booking['endTime']);
    }));
}

function slot_status($bookings, $blocks, $date, $start, $end, $ignoreId, $capacity = CAPACITY) {
    $limit = max(1, (int) $capacity);
    if ($date === '' || $start === '' || $end === '') {
        return ['ok' => false, 'message' => ''];
    }
    if (is_admin_blocked($blocks, $date, $start, $end)) {
        return ['ok' => false, 'message' => 'Tanggal atau jam ini ditutup admin. Pilih waktu lain.'];
    }
    $overlapping = overlapping_bookings($bookings, $date, $start, $end, $ignoreId);
    if (count($overlapping) >= $limit) {
        return ['ok' => false, 'message' => 'Waktu ini sudah penuh (' . $limit . ' sesi berjalan bersamaan). Pilih jam lain.'];
    }
    return ['ok' => true, 'message' => ''];
}

function taken_photographers($bookings, $date, $start, $end, $ignoreId) {
    $taken = [];
    foreach (overlapping_bookings($bookings, $date, $start, $end, $ignoreId) as $booking) {
        if ($booking['photographer'] !== '') $taken[$booking['photographer']] = true;
    }
    return $taken;
}

function first_free_photographer($bookings, $date, $start, $end, $ignoreId) {
    $taken = taken_photographers($bookings, $date, $start, $end, $ignoreId);
    foreach (PHOTOGRAPHERS as $id) {
        if (!isset($taken[$id])) return $id;
    }
    return '';
}

function is_google_maps_link($value) {
    return (bool) preg_match(
        '#https?://(?:maps\\.app\\.goo\\.gl/\\S*|goo\\.gl/maps\\S*|(?:www\\.)?google\\.(?:com|co\\.id)/maps\\S*|maps\\.google\\.(?:com|co\\.id)\\S*)#i',
        (string) $value
    );
}

function make_mock_id($date, $startTime, $packageName) {
    $parts = explode('-', (string) $date);
    if (count($parts) !== 3) return '';
    $start = str_replace(':', '', substr((string) $startTime, 0, 5));
    $name = preg_replace('/\s+/', '', (string) $packageName);
    if ($start === '' || $name === '') return '';
    return substr('M' . $parts[2] . $parts[1] . $parts[0] . $start . $name, 0, 40);
}

function make_booking_id($date, $startTime, $code) {
    $parts = explode('-', $date);
    return $parts[2] . $parts[1] . $parts[0] . str_replace(':', '', $startTime) . $code;
}
