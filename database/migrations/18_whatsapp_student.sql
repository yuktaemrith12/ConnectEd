-- Migration 18: Extend WhatsApp notifications to support students
-- Run this in MySQL Workbench after 16_whatsapp_assignment_notify.sql
--
-- Changes:
--   whatsapp_notification_settings:
--     - parent_user_id -> nullable (student rows leave it NULL)
--     - student_user_id added with its own unique key + FK
--     - notify_due_reminders added (student assignment due reminders)
--
--   whatsapp_sent_log:
--     - parent_user_id -> nullable
--     - student_user_id added with FK
--     - new unique key (student_user_id, event_key) for student dedup

USE connected_app;

-- ─── 1. whatsapp_notification_settings ───────────────────────────────────────

ALTER TABLE whatsapp_notification_settings
    MODIFY COLUMN parent_user_id INT NULL;

ALTER TABLE whatsapp_notification_settings
    ADD COLUMN student_user_id INT NULL AFTER parent_user_id,
    ADD COLUMN notify_due_reminders TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Student only - remind of assignments due within 24h' AFTER notify_assignments,
    ADD CONSTRAINT fk_whatsapp_student
        FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD UNIQUE KEY uq_whatsapp_student (student_user_id);

-- ─── 2. whatsapp_sent_log ─────────────────────────────────────────────────────

ALTER TABLE whatsapp_sent_log
    MODIFY COLUMN parent_user_id INT NULL;

ALTER TABLE whatsapp_sent_log
    ADD COLUMN student_user_id INT NULL AFTER parent_user_id,
    ADD CONSTRAINT fk_sent_log_student
        FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD UNIQUE KEY uq_sent_event_student (student_user_id, event_key);