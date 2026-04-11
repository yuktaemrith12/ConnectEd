-- ============================================================
--  ConnectEd — 11: WhatsApp Notifications
--  Domain: whatsapp_notification_settings, whatsapp_sent_log
--  Depends on: 10_messaging.sql
--  (Delivery log + opt-out registry → 16_whatsapp_webhook.sql)
-- ============================================================

USE connected_app;

-- Notification Settings
-- Per-user WhatsApp preferences.
-- Either parent_user_id or student_user_id is set (not both).
CREATE TABLE IF NOT EXISTS whatsapp_notification_settings (
    id                   INT         NOT NULL AUTO_INCREMENT,
    parent_user_id       INT         NULL,
    student_user_id      INT         NULL,
    phone_number         VARCHAR(30) NULL COMMENT 'E.164 format, e.g. +60123456789',
    is_connected         TINYINT(1)  NOT NULL DEFAULT 0,
    notify_exams         TINYINT(1)  NOT NULL DEFAULT 1,
    notify_events        TINYINT(1)  NOT NULL DEFAULT 1,
    notify_attendance    TINYINT(1)  NOT NULL DEFAULT 1,
    notify_messages      TINYINT(1)  NOT NULL DEFAULT 1,
    notify_grades        TINYINT(1)  NOT NULL DEFAULT 1,
    notify_assignments   TINYINT(1)  NOT NULL DEFAULT 1,
    notify_due_reminders TINYINT(1)  NOT NULL DEFAULT 0 COMMENT 'Student only — remind of assignments due within 24h',
    updated_at           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_whatsapp_parent  (parent_user_id),
    UNIQUE KEY uq_whatsapp_student (student_user_id),
    CONSTRAINT fk_whatsapp_parent  FOREIGN KEY (parent_user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_whatsapp_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sent Log
-- Deduplication: one row per (user, event_key) prevents duplicate sends.
CREATE TABLE IF NOT EXISTS whatsapp_sent_log (
    id              INT          NOT NULL AUTO_INCREMENT,
    parent_user_id  INT          NULL,
    student_user_id INT          NULL,
    event_key       VARCHAR(255) NOT NULL COMMENT 'Unique event identifier',
    sent_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sent_event_parent  (parent_user_id,  event_key),
    UNIQUE KEY uq_sent_event_student (student_user_id, event_key),
    CONSTRAINT fk_sent_log_parent  FOREIGN KEY (parent_user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sent_log_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
