-- ============================================================
--  ConnectEd — Migration 10: Attendance Sessions & Locations
--  Idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
--
--  What this script does:
--    1. Creates `locations` table (rooms managed by admin)
--    2. Extends `timetable_entries` with delivery mode + location
--    3. Creates `attendance_sessions` (one per class occurrence)
--    4. Creates `session_attendance_records` (per-student markers)
--
--  Depends on: migrations 01–09 already applied.
-- ============================================================

USE connected_app;

-- ════════════════════════════════════════════════════════════════
--  1) LOCATIONS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS locations (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(50)  NOT NULL DEFAULT 'Classroom',
    capacity   INT          NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ════════════════════════════════════════════════════════════════
--  2) EXTEND timetable_entries
-- ════════════════════════════════════════════════════════════════

-- Helper: add column only if it doesn't already exist (MySQL-compatible)
DELIMITER $$
DROP PROCEDURE IF EXISTS _add_col_if_missing$$
CREATE PROCEDURE _add_col_if_missing(
    IN tbl  VARCHAR(64),
    IN col  VARCHAR(64),
    IN col_def VARCHAR(255)
)
BEGIN
    SET @col_exists = (
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
    );
    IF @col_exists = 0 THEN
        SET @ddl = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', col, ' ', col_def);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL _add_col_if_missing('timetable_entries', 'delivery_mode',   "VARCHAR(10) NOT NULL DEFAULT 'ONSITE'");
CALL _add_col_if_missing('timetable_entries', 'location_id',     'INT NULL');
CALL _add_col_if_missing('timetable_entries', 'online_join_url', 'VARCHAR(500) NULL');
CALL _add_col_if_missing('timetable_entries', 'online_provider', 'VARCHAR(50) NULL');

DROP PROCEDURE IF EXISTS _add_col_if_missing;

-- Add FK only if it doesn't already exist
SET @fk_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = 'connected_app'
      AND TABLE_NAME        = 'timetable_entries'
      AND CONSTRAINT_NAME   = 'fk_te_location'
      AND CONSTRAINT_TYPE   = 'FOREIGN KEY'
);
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE timetable_entries ADD CONSTRAINT fk_te_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ════════════════════════════════════════════════════════════════
--  3) ATTENDANCE SESSIONS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id                       INT          AUTO_INCREMENT PRIMARY KEY,
    timetable_entry_id       INT          NOT NULL,
    session_date             DATE         NOT NULL,
    delivery_mode_snapshot   VARCHAR(20)  NOT NULL DEFAULT 'ONSITE',
    location_id_snapshot     INT          NULL,
    online_join_url_snapshot VARCHAR(500) NULL,
    status                   ENUM('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
    created_by               INT          NOT NULL,
    created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_as_entry   FOREIGN KEY (timetable_entry_id) REFERENCES timetable_entries(id) ON DELETE CASCADE,
    CONSTRAINT fk_as_creator FOREIGN KEY (created_by)         REFERENCES users(id),
    UNIQUE KEY uq_session (timetable_entry_id, session_date)
);

-- ════════════════════════════════════════════════════════════════
--  4) SESSION ATTENDANCE RECORDS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS session_attendance_records (
    id                    INT  AUTO_INCREMENT PRIMARY KEY,
    attendance_session_id INT  NOT NULL,
    student_id            INT  NOT NULL,
    status                ENUM('PRESENT','ABSENT','LATE','EXCUSED') NULL,
    marked_at             DATETIME NULL,
    marked_by             INT  NULL,
    note                  TEXT NULL,

    CONSTRAINT fk_sar_session  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sar_student  FOREIGN KEY (student_id)            REFERENCES users(id),
    CONSTRAINT fk_sar_marker   FOREIGN KEY (marked_by)             REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_session_student (attendance_session_id, student_id)
);

-- ════════════════════════════════════════════════════════════════
--  5) VERIFICATION
-- ════════════════════════════════════════════════════════════════

SELECT 'locations' AS tbl, COUNT(*) AS cnt FROM locations;
SELECT 'attendance_sessions' AS tbl, COUNT(*) AS cnt FROM attendance_sessions;
SELECT 'session_attendance_records' AS tbl, COUNT(*) AS cnt FROM session_attendance_records;

SELECT
    COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'connected_app'
  AND TABLE_NAME   = 'timetable_entries'
  AND COLUMN_NAME IN ('delivery_mode','location_id','online_join_url','online_provider')
ORDER BY ORDINAL_POSITION;
