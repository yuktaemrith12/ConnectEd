-- ============================================================
--  ConnectEd — 04: Timetable
--  Domain: class_subject_teachers, locations, timetable_entries
--  Depends on: 02_academics.sql, 03_profiles.sql
-- ============================================================

USE connected_app;

-- Class-Subject-Teacher assignments
-- 3-way junction: which teacher delivers which subject in which class.
CREATE TABLE IF NOT EXISTS class_subject_teachers (
    class_id   INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    PRIMARY KEY (class_id, subject_id, teacher_id),
    CONSTRAINT fk_cst_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
    CONSTRAINT fk_cst_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_cst_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Locations
-- Physical rooms / labs / halls used for in-person sessions.
CREATE TABLE IF NOT EXISTS locations (
    id         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(50)  NOT NULL DEFAULT 'Classroom',
    capacity   INT          NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Timetable Entries
-- One row per class × subject × day × time_slot.
-- day / time_slot: legacy string keys kept for backend compatibility.
-- day_of_week (0=Mon … 4=Fri) and start_time/end_time are the canonical schedule fields.
CREATE TABLE IF NOT EXISTS timetable_entries (
    id              INT          NOT NULL AUTO_INCREMENT,
    class_id        INT          NOT NULL,
    subject_id      INT          NOT NULL,
    teacher_id      INT          NULL,
    -- legacy schedule identifiers (still used by backend UniqueConstraint)
    day             VARCHAR(10)  NOT NULL,
    time_slot       VARCHAR(10)  NOT NULL,
    -- canonical schedule fields
    day_of_week     TINYINT      NULL,           -- 0=Mon … 4=Fri
    start_time      TIME         NULL,
    end_time        TIME         NULL,
    -- room / delivery
    room            VARCHAR(100) NULL,
    online_link     VARCHAR(500) NULL,
    is_published    BOOLEAN      NOT NULL DEFAULT FALSE,
    delivery_mode   VARCHAR(10)  NOT NULL DEFAULT 'ONSITE',   -- 'ONSITE' | 'ONLINE'
    location_id     INT          NULL,
    online_join_url VARCHAR(500) NULL,
    online_provider VARCHAR(50)  NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_timetable_slot (class_id, day, time_slot),
    CONSTRAINT fk_tt_class    FOREIGN KEY (class_id)    REFERENCES classes(id)    ON DELETE CASCADE,
    CONSTRAINT fk_tt_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id)   ON DELETE CASCADE,
    CONSTRAINT fk_tt_teacher  FOREIGN KEY (teacher_id)  REFERENCES users(id)      ON DELETE SET NULL,
    CONSTRAINT fk_tt_location FOREIGN KEY (location_id) REFERENCES locations(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
