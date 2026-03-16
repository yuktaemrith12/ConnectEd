-- ============================================================
--  ConnectEd — 02: Academics (Subjects, Classes)
--  Domain: subjects, classes, class_subjects junction
--  Depends on: 01_users_admin.sql (users table for head_teacher_id)
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
    id              INT          NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    head_teacher_id INT          DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_classes_name (name),
    CONSTRAINT fk_classes_teacher
        FOREIGN KEY (head_teacher_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Class ↔ Subject junction ─────────────────────────────────
CREATE TABLE IF NOT EXISTS class_subjects (
    class_id   INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (class_id, subject_id),
    CONSTRAINT fk_cs_class   FOREIGN KEY (class_id)   REFERENCES classes  (id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
