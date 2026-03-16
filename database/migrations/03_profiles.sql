-- ============================================================
--  ConnectEd — 03: User Profiles & Relationship Junctions
--  Domain: student_profiles, teacher_profiles, parent_students,
--          teacher_subjects
--  Depends on: 01_users_admin.sql, 02_academics.sql
-- ============================================================

USE connected_app;

-- ── Student Profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
    id           INT         NOT NULL AUTO_INCREMENT,
    user_id      INT         NOT NULL,
    class_id     INT         DEFAULT NULL,
    student_code VARCHAR(20) DEFAULT NULL,
    dob          DATE        DEFAULT NULL,
    address      VARCHAR(255) DEFAULT NULL,
    phone        VARCHAR(20)  DEFAULT NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME    DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sp_user         (user_id),
    UNIQUE KEY uq_sp_student_code (student_code),
    CONSTRAINT fk_sp_user  FOREIGN KEY (user_id)  REFERENCES users   (id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Teacher Profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_profiles (
    id       INT          NOT NULL AUTO_INCREMENT,
    user_id  INT          NOT NULL,
    staff_id VARCHAR(20)  DEFAULT NULL,
    dob      DATE         DEFAULT NULL,
    address  VARCHAR(255) DEFAULT NULL,
    phone    VARCHAR(20)  DEFAULT NULL,
    bio      TEXT         DEFAULT NULL,
    created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME   DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tp_user     (user_id),
    UNIQUE KEY uq_tp_staff_id (staff_id),
    CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Parent ↔ Student links (many-to-many) ────────────────────
CREATE TABLE IF NOT EXISTS parent_students (
    parent_id         INT         NOT NULL,
    student_id        INT         NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'Guardian',
    PRIMARY KEY (parent_id, student_id),
    CONSTRAINT fk_ps_parent  FOREIGN KEY (parent_id)  REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Teacher ↔ Subject links (many-to-many) ───────────────────
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES users    (id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
