Use connected_app;
-- ============================================================
-- Migration 05: Attendance Module
-- Run after: 04_user_lifecycle_audit.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_records (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    student_id  INT         NOT NULL,
    date        DATE        NOT NULL,
    status      ENUM('Present', 'Absent', 'Late') NOT NULL DEFAULT 'Present',
    marked_by_id INT        NOT NULL,
    remarks     TEXT        NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_att_student
        FOREIGN KEY (student_id)  REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_marker
        FOREIGN KEY (marked_by_id) REFERENCES users(id),

    -- One record per student per day
    CONSTRAINT uq_att_student_date UNIQUE (student_id, date)
);
