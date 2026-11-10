CREATE TABLE IF NOT EXISTS bookings (
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
  location VARCHAR(160) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  extra_photos INT NOT NULL DEFAULT 0,
  include_mua TINYINT(1) NOT NULL DEFAULT 0,
  makeup_date VARCHAR(10) NOT NULL DEFAULT '',
  makeup_time VARCHAR(5) NOT NULL DEFAULT '',
  hair_style VARCHAR(20) NOT NULL DEFAULT '',
  mua_address VARCHAR(240) NOT NULL DEFAULT '',
  mua_map VARCHAR(300) NOT NULL DEFAULT '',
  total_price INT NOT NULL DEFAULT 0,
  booking_fee INT NOT NULL DEFAULT 100000,
  photographer VARCHAR(8) NOT NULL DEFAULT '',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'dp',
  sort_order BIGINT NOT NULL DEFAULT 0,
  source VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_bookings_date (session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blocks (
  id VARCHAR(40) NOT NULL,
  start_date CHAR(10) NOT NULL,
  end_date CHAR(10) NOT NULL,
  start_time VARCHAR(5) NOT NULL DEFAULT '',
  end_time VARCHAR(5) NOT NULL DEFAULT '',
  reason VARCHAR(120) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS photographers (
  id VARCHAR(8) NOT NULL,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  notes VARCHAR(240) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mocks (
  id VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  package_id VARCHAR(32) NOT NULL,
  package_name VARCHAR(80) NOT NULL,
  location VARCHAR(160) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  session_date CHAR(10) NOT NULL DEFAULT '',
  start_time VARCHAR(5) NOT NULL DEFAULT '',
  extra_photos INT NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(40) NOT NULL,
  service TINYINT NOT NULL,
  website TINYINT NOT NULL,
  message VARCHAR(1000) NOT NULL DEFAULT '',
  created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
