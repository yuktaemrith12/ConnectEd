-- ============================================================
--  ConnectEd — 12: Assignments & Grading
--  Domain: assignments, submissions, ai_reviews (+ attachments)
--  Depends on: 11_homework.sql
-- ============================================================

USE connected_app;

-- ── Assignments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
    id                INT          NOT NULL AUTO_INCREMENT,
    class_id          INT          NOT NULL,
    subject_id        INT          NOT NULL,
    teacher_id        INT          NOT NULL,
    type              ENUM('ONLINE','ON_SITE') NOT NULL DEFAULT 'ONLINE',
    title             VARCHAR(255) NOT NULL,
    description       TEXT         NULL,
    due_at            DATETIME     NULL,
    max_score         DECIMAL(6,2) NOT NULL DEFAULT 100,
    rubric            JSON         NULL,
    location          VARCHAR(255) NULL,        -- onsite: room / lab name
    duration          VARCHAR(100) NULL,        -- e.g. "90 minutes"
    answer_sheet_path VARCHAR(500) NULL,        -- teacher answer key
    status            ENUM('DRAFT','ACTIVE','CLOSED','RELEASED') NOT NULL DEFAULT 'DRAFT',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_asgn_class   FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE CASCADE,
    CONSTRAINT fk_asgn_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_asgn_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Assignment Attachments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignment_attachments (
    id            INT          NOT NULL AUTO_INCREMENT,
    assignment_id INT          NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_type     VARCHAR(50)  NOT NULL,
    file_size     INT          NOT NULL DEFAULT 0,
    file_path     VARCHAR(500) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_aa_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Submissions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
    id            INT          NOT NULL AUTO_INCREMENT,
    assignment_id INT          NOT NULL,
    student_id    INT          NOT NULL,
    submitted_at  DATETIME     NULL,
    files         JSON         NULL,          -- [{name, url, size}]
    grade         DECIMAL(6,2) NULL,
    feedback      TEXT         NULL,
    is_onsite     TINYINT(1)   NOT NULL DEFAULT 0,
    status        ENUM('PENDING','SUBMITTED','GRADED','PUBLISHED') NOT NULL DEFAULT 'PENDING',
    ai_reviewed   TINYINT(1)   NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sub_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_student    FOREIGN KEY (student_id)    REFERENCES users(id)       ON DELETE CASCADE,
    UNIQUE KEY uq_sub_asgn_student (assignment_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Submission Attachments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS submission_attachments (
    id            INT          NOT NULL AUTO_INCREMENT,
    submission_id INT          NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_type     VARCHAR(50)  NOT NULL,
    file_size     INT          NOT NULL DEFAULT 0,
    file_path     VARCHAR(500) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sa_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── AI Reviews ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_reviews (
    id                 INT          NOT NULL AUTO_INCREMENT,
    submission_id      INT          NOT NULL,
    suggested_grade    DECIMAL(6,2) NULL,
    suggested_feedback TEXT         NULL,     -- JSON string: StructuredFeedback
    rubric_alignment   JSON         NULL,     -- {criterion: comment} map
    annotations        JSON         NULL,     -- inline annotation array
    confidence_score   ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    model_info         JSON         NULL,     -- {model_id, version, timestamp}
    triggered_by       INT          NULL,
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_air_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_air_teacher    FOREIGN KEY (triggered_by)  REFERENCES users(id)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
