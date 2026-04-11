
-- Migration 21: Video Conferencing & AI Teaching Analytics
-- Tables: meetings, meeting_recordings, meeting_emotion_logs, meeting_analytics
-- Run AFTER migration 20.

CREATE TABLE IF NOT EXISTS meetings (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    room_name   VARCHAR(255) NOT NULL UNIQUE,
    teacher_id  INT NOT NULL,
    class_id    INT NOT NULL,
    subject_id  INT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    status      ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
    started_at  DATETIME NULL,
    ended_at    DATETIME NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    INDEX idx_meetings_teacher  (teacher_id),
    INDEX idx_meetings_class    (class_id),
    INDEX idx_meetings_status   (status)
);

CREATE TABLE IF NOT EXISTS meeting_recordings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id      INT NOT NULL,
    storage_path    VARCHAR(500) NOT NULL,
    duration_s      INT NOT NULL DEFAULT 0,
    has_transcript  TINYINT(1) NOT NULL DEFAULT 0,
    has_analytics   TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_mrec_meeting (meeting_id)
);

CREATE TABLE IF NOT EXISTS meeting_emotion_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id   INT NOT NULL,
    student_id   INT NOT NULL DEFAULT 0,
    timestamp_s  FLOAT NOT NULL,
    emotion      VARCHAR(50) NOT NULL,
    confidence   FLOAT NOT NULL DEFAULT 0.0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_mel_meeting (meeting_id),
    INDEX idx_mel_emotion (emotion)
);

CREATE TABLE IF NOT EXISTS meeting_analytics (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id  INT NOT NULL UNIQUE,
    report_json JSON,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
