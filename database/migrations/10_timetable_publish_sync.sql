-- ============================================================
--  ConnectEd — 10: Timetable Publish & Sync
--  Adds is_published, start_time, end_time, room, online_link,
--  day_of_week, and timestamps to timetable_entries.
--  Depends on: 04_timetable.sql, 09_timetable_teacher_upgrade.sql
-- ============================================================

USE connected_app;

-- ── Helper: add column if not exists ────────────────────────

DELIMITER $$
DROP PROCEDURE IF EXISTS _add_col_if_missing$$
CREATE PROCEDURE _add_col_if_missing(
    IN tbl VARCHAR(64), IN col VARCHAR(64), IN col_def VARCHAR(255)
)
BEGIN
    SET @cnt = (
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
    );
    IF @cnt = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', col, ' ', col_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ── Add new columns ─────────────────────────────────────────

CALL _add_col_if_missing('timetable_entries', 'is_published',
    'BOOLEAN NOT NULL DEFAULT FALSE AFTER teacher_id');

CALL _add_col_if_missing('timetable_entries', 'start_time',
    'TIME DEFAULT NULL AFTER time_slot');

CALL _add_col_if_missing('timetable_entries', 'end_time',
    'TIME DEFAULT NULL AFTER start_time');

CALL _add_col_if_missing('timetable_entries', 'room',
    'VARCHAR(100) DEFAULT NULL AFTER end_time');

CALL _add_col_if_missing('timetable_entries', 'online_link',
    'VARCHAR(500) DEFAULT NULL AFTER room');

CALL _add_col_if_missing('timetable_entries', 'day_of_week',
    'TINYINT DEFAULT NULL AFTER day');

CALL _add_col_if_missing('timetable_entries', 'created_at',
    'DATETIME DEFAULT CURRENT_TIMESTAMP AFTER online_link');

CALL _add_col_if_missing('timetable_entries', 'updated_at',
    'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

-- ── Back-fill day_of_week from existing day string ──────────
-- (Disable safe-update mode temporarily for Workbench compatibility)

SET SQL_SAFE_UPDATES = 0;

UPDATE timetable_entries SET day_of_week = 0 WHERE day = 'Monday'    AND day_of_week IS NULL;
UPDATE timetable_entries SET day_of_week = 1 WHERE day = 'Tuesday'   AND day_of_week IS NULL;
UPDATE timetable_entries SET day_of_week = 2 WHERE day = 'Wednesday' AND day_of_week IS NULL;
UPDATE timetable_entries SET day_of_week = 3 WHERE day = 'Thursday'  AND day_of_week IS NULL;
UPDATE timetable_entries SET day_of_week = 4 WHERE day = 'Friday'    AND day_of_week IS NULL;

SET SQL_SAFE_UPDATES = 1;

-- ── Cleanup helper ──────────────────────────────────────────

DROP PROCEDURE IF EXISTS _add_col_if_missing;
