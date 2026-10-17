CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  company         VARCHAR(255) NOT NULL,
  role_title      VARCHAR(255) NOT NULL,
  source          VARCHAR(100) NULL,
  status          ENUM('applied', 'screening', 'interview', 'offer', 'rejected')
                  NOT NULL DEFAULT 'applied',
  applied_on      DATE NULL,
  salary_expected INT UNSIGNED NULL,
  notes           TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_applications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- supports "my applications, filtered by status, newest first" + keyset paging
  KEY idx_applications_user_status_created (user_id, status, created_at, id),
  KEY idx_applications_user_company (user_id, company)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti        CHAR(36) PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_refresh_tokens_user (user_id)
) ENGINE=InnoDB;



CREATE TABLE IF NOT EXISTS inbound_events (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id    VARCHAR(255) NOT NULL,
  source      VARCHAR(50)  NOT NULL DEFAULT 'email',
  payload     JSON         NOT NULL,
  received_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- unique, so a redelivered email is refused by the database itself
  UNIQUE KEY uq_inbound_events_event_id (event_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jobs (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inbound_event_id BIGINT UNSIGNED NOT NULL,
  status           ENUM('pending', 'processing', 'done') NOT NULL DEFAULT 'pending',
  attempts         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  run_after        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at        DATETIME NULL,
  last_error       TEXT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_jobs_event
    FOREIGN KEY (inbound_event_id) REFERENCES inbound_events(id) ON DELETE CASCADE,
  -- serves the worker query: oldest pending job whose run_after has passed
  KEY idx_jobs_claim (status, run_after, id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dead_letter (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id           BIGINT UNSIGNED NOT NULL,
  inbound_event_id BIGINT UNSIGNED NOT NULL,
  attempts         TINYINT UNSIGNED NOT NULL,
  error            TEXT NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  replayed_at      DATETIME NULL,
  CONSTRAINT fk_dead_letter_event
    FOREIGN KEY (inbound_event_id) REFERENCES inbound_events(id) ON DELETE CASCADE,
  KEY idx_dead_letter_open (replayed_at, id)
) ENGINE=InnoDB;
