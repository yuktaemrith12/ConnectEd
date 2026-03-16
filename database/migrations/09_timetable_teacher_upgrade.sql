-- ============================================================
--  ConnectEd — 09: Timetable Teacher Upgrade
--  Domain: class_subject_teachers, timetable_entries upgrade
--  Depends on: 02_academics.sql, 03_profiles.sql, 04_timetable.sql
-- ============================================================

USE connected_app;

-- ── Class-Subject-Teacher assignments ─────────────────────────
-- Defines which teacher teaches which subject in which class.
CREATE TABLE IF NOT EXISTS class_subject_teachers (
    class_id   INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    PRIMARY KEY (class_id, subject_id, teacher_id),
    CONSTRAINT fk_cst_class   FOREIGN KEY (class_id)   REFERENCES classes  (id) ON DELETE CASCADE,
    CONSTRAINT fk_cst_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
    CONSTRAINT fk_cst_teacher FOREIGN KEY (teacher_id) REFERENCES users    (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Add teacher_id to timetable_entries ───────────────────────
-- Allow NULL initially so existing rows are not broken.
-- (Using information_schema guard — ADD COLUMN IF NOT EXISTS is MariaDB-only)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'timetable_entries'
      AND COLUMN_NAME  = 'teacher_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE timetable_entries ADD COLUMN teacher_id INT DEFAULT NULL AFTER subject_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK only if it doesn't already exist
SET @fk_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'fk_tt_teacher'
      AND TABLE_NAME = 'timetable_entries'
      AND TABLE_SCHEMA = DATABASE()
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE timetable_entries ADD CONSTRAINT fk_tt_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
