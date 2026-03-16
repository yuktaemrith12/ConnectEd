-- ============================================================
-- Migration 12: Assignments + Grading Module
-- Run after: 11_homework.sql
-- ============================================================
Use connected_app;

-- assignments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    class_id     INT NOT NULL,
    subject_id   INT NOT NULL,
    teacher_id   INT NOT NULL,
    type         ENUM('ONLINE','ON_SITE') NOT NULL DEFAULT 'ONLINE',
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    due_at       DATETIME,
    max_score    DECIMAL(6,2) NOT NULL DEFAULT 100,
    rubric       JSON,
    location     VARCHAR(255),          -- for ON_SITE: room/lab name
    duration     VARCHAR(100),          -- e.g. "90 minutes"
    status       ENUM('DRAFT','ACTIVE','CLOSED','RELEASED') NOT NULL DEFAULT 'DRAFT',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_asgn_class    FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE CASCADE,
    CONSTRAINT fk_asgn_subject  FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_asgn_teacher  FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- assignment_attachments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignment_attachments (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id  INT NOT NULL,
    file_name      VARCHAR(255) NOT NULL,
    file_type      VARCHAR(50)  NOT NULL,
    file_size      INT NOT NULL DEFAULT 0,
    file_path      VARCHAR(500) NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aa_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- submissions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id  INT NOT NULL,
    student_id     INT NOT NULL,                 -- users.id
    submitted_at   DATETIME,
    files          JSON,                         -- [{name, url, size}]
    grade          DECIMAL(6,2),
    feedback       TEXT,
    status         ENUM('PENDING','SUBMITTED','GRADED','PUBLISHED') NOT NULL DEFAULT 'PENDING',
    ai_reviewed    TINYINT(1) NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_student    FOREIGN KEY (student_id)    REFERENCES users(id)        ON DELETE CASCADE,
    CONSTRAINT uq_sub_asgn_student UNIQUE (assignment_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- submission_attachments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submission_attachments (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    submission_id  INT NOT NULL,
    file_name      VARCHAR(255) NOT NULL,
    file_type      VARCHAR(50)  NOT NULL,
    file_size      INT NOT NULL DEFAULT 0,
    file_path      VARCHAR(500) NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sa_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ai_reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_reviews (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    submission_id       INT NOT NULL,
    suggested_grade     DECIMAL(6,2),
    suggested_feedback  TEXT,
    rubric_alignment    JSON,            -- {criterion: comment} map
    confidence_score    ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    model_info          JSON,            -- {model_id, version, timestamp}
    triggered_by        INT,             -- teacher user id
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_air_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_air_teacher    FOREIGN KEY (triggered_by)  REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
