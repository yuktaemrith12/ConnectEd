-- Migration 16: Add notify_assignments column to whatsapp_notification_settings
-- Run this in MySQL Workbench after migration 15.

ALTER TABLE whatsapp_notification_settings
    ADD COLUMN notify_assignments TINYINT(1) NOT NULL DEFAULT 1
    AFTER notify_grades;
