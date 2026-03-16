-- ============================================================
--  ConnectEd — Admin Features Migration
--  Run this in MySQL Workbench AFTER schema.sql + seed.sql
--  File > Open SQL Script → 02_admin_features.sql → Execute All
-- ============================================================

USE connected_app;

-- ── Subjects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
    id   INT          NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_subjects_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Classes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
    id              INT         NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    head_teacher_id INT          DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_classes_name (name),
    CONSTRAINT fk_classes_teacher
        FOREIGN KEY (head_teacher_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Class ↔ Subject junction ──────────────────────────────────
CREATE TABLE IF NOT EXISTS class_subjects (
    class_id   INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (class_id, subject_id),
    CONSTRAINT fk_cs_class   FOREIGN KEY (class_id)   REFERENCES classes  (id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Student profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
    id           INT         NOT NULL AUTO_INCREMENT,
    user_id      INT         NOT NULL,
    class_id     INT         DEFAULT NULL,
    student_code VARCHAR(20) DEFAULT NULL,   -- e.g. ST001
    PRIMARY KEY (id),
    UNIQUE KEY uq_sp_user         (user_id),
    UNIQUE KEY uq_sp_student_code (student_code),
    CONSTRAINT fk_sp_user  FOREIGN KEY (user_id)  REFERENCES users   (id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Timetable entries ────────────────────────────────────────
-- day      : 'Monday' … 'Friday'
-- time_slot: '9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00'
CREATE TABLE IF NOT EXISTS timetable_entries (
    id         INT         NOT NULL AUTO_INCREMENT,
    class_id   INT         NOT NULL,
    subject_id INT         NOT NULL,
    day        VARCHAR(10) NOT NULL,
    time_slot  VARCHAR(10) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_timetable_slot (class_id, day, time_slot),
    CONSTRAINT fk_tt_class   FOREIGN KEY (class_id)   REFERENCES classes  (id) ON DELETE CASCADE,
    CONSTRAINT fk_tt_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed: Subjects ───────────────────────────────────────────
INSERT IGNORE INTO subjects (name) VALUES
    ('Mathematics'),
    ('English'),
    ('Science'),
    ('History'),
    ('Geography'),
    ('Art'),
    ('Physical Education'),
    ('Music'),
    ('ICT');

-- ── Seed: Classes ────────────────────────────────────────────
INSERT IGNORE INTO classes (name) VALUES
    ('Grade 1-A'), ('Grade 1-B'),
    ('Grade 2-A'), ('Grade 2-B'),
    ('Grade 3-A'), ('Grade 3-B'),
    ('Grade 4-A'), ('Grade 4-B'),
    ('Grade 5-A'), ('Grade 5-B');

-- ── Verification ─────────────────────────────────────────────
-- Run after execution:
-- SELECT * FROM subjects;
-- SELECT * FROM classes;
