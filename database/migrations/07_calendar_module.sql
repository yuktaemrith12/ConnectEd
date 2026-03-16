-- ============================================================
-- Migration 07: Calendar / Events Module
-- Run after: 06_fees_module.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    title                VARCHAR(255) NOT NULL,
    type                 ENUM('Academic', 'Exam', 'Holiday', 'Meeting', 'Other') NOT NULL DEFAULT 'Academic',
    start_date           DATE         NOT NULL,
    end_date             DATE         NOT NULL,
    start_time           TIME         NULL,
    end_time             TIME         NULL,
    target_audience_type ENUM('All', 'Students', 'Teachers', 'Parents', 'Specific Classes') NOT NULL DEFAULT 'All',
    description          TEXT         NULL,
    published            TINYINT(1)   NOT NULL DEFAULT 0,
    created_by_id        INT          NOT NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_creator
        FOREIGN KEY (created_by_id) REFERENCES users(id),

    CONSTRAINT chk_event_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS event_target_classes (
    event_id INT NOT NULL,
    class_id INT NOT NULL,

    PRIMARY KEY (event_id, class_id),
    CONSTRAINT fk_etc_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_etc_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
