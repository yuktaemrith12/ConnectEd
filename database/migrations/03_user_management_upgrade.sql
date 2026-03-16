-- ============================================================
--  ConnectEd — User Management Upgrade
--  Run this in MySQL Workbench AFTER 02_admin_features.sql
--  File > Open SQL Script → 03_user_management_upgrade.sql → Execute All
-- ============================================================

USE connected_app;

-- ── Teacher profiles (new table) ──────────────────────────
-- teacher_profiles does NOT exist before this migration
CREATE TABLE IF NOT EXISTS teacher_profiles (
    id       INT          NOT NULL AUTO_INCREMENT,
    user_id  INT          NOT NULL,
    staff_id VARCHAR(20)  DEFAULT NULL,   -- e.g. TCH001
    dob      DATE         DEFAULT NULL,
    address  VARCHAR(255) DEFAULT NULL,
    phone    VARCHAR(20)  DEFAULT NULL,
    bio      TEXT         DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tp_user     (user_id),
    UNIQUE KEY uq_tp_staff_id (staff_id),
    CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Extend student_profiles with extra fields ─────────────
-- MySQL-safe equivalent of "ADD COLUMN IF NOT EXISTS" (version compatible)
SET @db := DATABASE();

-- add dob if missing
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = @db
              AND table_name = 'student_profiles'
              AND column_name = 'dob'
        ),
        'SELECT 1',
        'ALTER TABLE student_profiles ADD COLUMN dob DATE DEFAULT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- add address if missing
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = @db
              AND table_name = 'student_profiles'
              AND column_name = 'address'
        ),
        'SELECT 1',
        'ALTER TABLE student_profiles ADD COLUMN address VARCHAR(255) DEFAULT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- add phone if missing
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = @db
              AND table_name = 'student_profiles'
              AND column_name = 'phone'
        ),
        'SELECT 1',
        'ALTER TABLE student_profiles ADD COLUMN phone VARCHAR(20) DEFAULT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Parent ↔ Student links (many-to-many) ─────────────────
CREATE TABLE IF NOT EXISTS parent_students (
    parent_id         INT         NOT NULL,
    student_id        INT         NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'Guardian',
    PRIMARY KEY (parent_id, student_id),
    CONSTRAINT fk_ps_parent  FOREIGN KEY (parent_id)  REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Teacher ↔ Subject links (many-to-many) ────────────────
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Verification ──────────────────────────────────────────
-- Run after execution:
-- DESCRIBE teacher_profiles;
-- DESCRIBE student_profiles;
-- SELECT * FROM parent_students;
-- SELECT * FROM teacher_subjects;