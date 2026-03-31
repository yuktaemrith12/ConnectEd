-- ============================================================
--  ConnectEd — Migration 11: Homework Module
--
--  Tables:
--    homework              — teacher-created homework items
--    homework_attachments  — file attachments per homework
--    homework_completions  — per-student "Done" toggle
--
--  Idempotent — safe to re-run (IF NOT EXISTS throughout).
-- ============================================================

USE connected_app;

-- ════════════════════════════════════════════════════════════════
--  1) homework
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS homework (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    class_id    INT          NOT NULL,
    subject_id  INT          NOT NULL,
    teacher_id  INT          NOT NULL,
    title       VARCHAR(255) NOT NULL,
    instructions TEXT        NULL,
    due_at      DATETIME     NULL,
    status      ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_hw_class   FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE CASCADE,
    CONSTRAINT fk_hw_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_hw_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ════════════════════════════════════════════════════════════════
--  2) homework_attachments
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS homework_attachments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    homework_id INT          NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_type   VARCHAR(50)  NOT NULL,
    file_size   INT          NOT NULL DEFAULT 0,
    file_path   VARCHAR(500) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hwa_homework FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ════════════════════════════════════════════════════════════════
--  3) homework_completions
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS homework_completions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    homework_id INT     NOT NULL,
    student_id  INT     NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT FALSE,
    done_at     DATETIME NULL,

    CONSTRAINT fk_hwc_homework FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
    CONSTRAINT fk_hwc_student  FOREIGN KEY (student_id)  REFERENCES users(id)    ON DELETE CASCADE,
    CONSTRAINT uq_hwc_student  UNIQUE (homework_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ════════════════════════════════════════════════════════════════
--  Verification
-- ════════════════════════════════════════════════════════════════

SELECT 'homework tables' AS module,
       (SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'connected_app'
          AND table_name IN ('homework','homework_attachments','homework_completions')
       ) AS tables_created;
