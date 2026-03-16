-- ============================================================
--  ConnectEd — 05: Attendance
--  Domain: attendance_records
--  Depends on: 03_profiles.sql (student_profiles), 01_users_admin.sql
-- ============================================================

USE connected_app;

-- ── Attendance Records ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
    id           INT         NOT NULL AUTO_INCREMENT,
    student_id   INT         NOT NULL,
    date         DATE        NOT NULL,
    status       ENUM('Present', 'Absent', 'Late') NOT NULL DEFAULT 'Present',
    marked_by_id INT         NOT NULL,
    remarks      TEXT        NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_att_student
        FOREIGN KEY (student_id)   REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_marker
        FOREIGN KEY (marked_by_id) REFERENCES users(id),
    CONSTRAINT uq_att_student_date UNIQUE (student_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
