-- ============================================================
--  ConnectEd — 04: Timetable
--  Domain: timetable_entries
--  Depends on: 02_academics.sql (classes, subjects)
-- ============================================================

USE connected_app;

-- ── Timetable Entries ────────────────────────────────────────
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
