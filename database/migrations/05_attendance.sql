-- ============================================================
--  ConnectEd — 05: Attendance
--  Domain: attendance_records, attendance_sessions,
--          session_attendance_records
--  Depends on: 03_profiles.sql, 04_timetable.sql
-- ============================================================

USE connected_app;

-- Attendance Records (flat / legacy model)
-- One row per student per date. Kept for historical data and admin overview.
CREATE TABLE IF NOT EXISTS attendance_records (
    id           INT  NOT NULL AUTO_INCREMENT,
    student_id   INT  NOT NULL,
    date         DATE NOT NULL,
    status       ENUM('Present', 'Absent', 'Late') NOT NULL DEFAULT 'Present',
    marked_by_id INT  NOT NULL,
    remarks      TEXT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_att_student FOREIGN KEY (student_id)   REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_marker  FOREIGN KEY (marked_by_id) REFERENCES users(id),
    UNIQUE KEY uq_att_student_date (student_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance Sessions (session-based model)
-- One session per timetable entry per date, opened by the teacher.
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id                       INT          NOT NULL AUTO_INCREMENT,
    timetable_entry_id       INT          NOT NULL,
    session_date             DATE         NOT NULL,
    delivery_mode_snapshot   VARCHAR(20)  NOT NULL DEFAULT 'ONSITE',
    location_id_snapshot     INT          NULL,      -- snapshot, not FK
    online_join_url_snapshot VARCHAR(500) NULL,
    status                   ENUM('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
    created_by               INT          NOT NULL,
    created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_as_entry   FOREIGN KEY (timetable_entry_id) REFERENCES timetable_entries(id) ON DELETE CASCADE,
    CONSTRAINT fk_as_creator FOREIGN KEY (created_by)         REFERENCES users(id),
    UNIQUE KEY uq_session (timetable_entry_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session Attendance Records
-- Per-student record within a session. NULL status → set to ABSENT on session close.
CREATE TABLE IF NOT EXISTS session_attendance_records (
    id                    INT  NOT NULL AUTO_INCREMENT,
    attendance_session_id INT  NOT NULL,
    student_id            INT  NOT NULL,
    status                ENUM('PRESENT','ABSENT','LATE','EXCUSED') NULL,
    marked_at             DATETIME NULL,
    marked_by             INT  NULL,
    note                  TEXT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_sar_session FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sar_student FOREIGN KEY (student_id)            REFERENCES users(id),
    CONSTRAINT fk_sar_marker  FOREIGN KEY (marked_by)             REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_session_student (attendance_session_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
