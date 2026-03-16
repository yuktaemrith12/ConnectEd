-- Migration 15: WhatsApp Notification Settings
-- Run this in MySQL Workbench after 14_messaging.sql
-- Stores parent-level WhatsApp preferences and a sent-log for deduplication
Use connected_app;
-- ─── 1. Parent WhatsApp Settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_notification_settings (
    id             INT          NOT NULL AUTO_INCREMENT,
    parent_user_id INT          NOT NULL,
    phone_number   VARCHAR(30)  NULL COMMENT 'E.164 format, e.g. +60123456789',
    is_connected   TINYINT(1)   NOT NULL DEFAULT 0,
    notify_exams       TINYINT(1) NOT NULL DEFAULT 1,
    notify_events      TINYINT(1) NOT NULL DEFAULT 1,
    notify_attendance  TINYINT(1) NOT NULL DEFAULT 1,
    notify_messages    TINYINT(1) NOT NULL DEFAULT 1,
    notify_grades      TINYINT(1) NOT NULL DEFAULT 1,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_whatsapp_parent (parent_user_id),
    CONSTRAINT fk_whatsapp_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 2. Sent-Log (deduplication) ─────────────────────────────────────────────
-- event_key: unique string describing the exact event (e.g. "attendance:session_record:42:parent:7")
CREATE TABLE IF NOT EXISTS whatsapp_sent_log (
    id            INT          NOT NULL AUTO_INCREMENT,
    parent_user_id INT         NOT NULL,
    event_key     VARCHAR(255) NOT NULL COMMENT 'Unique event identifier to prevent duplicate sends',
    sent_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_sent_event (parent_user_id, event_key),
    CONSTRAINT fk_sent_log_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
