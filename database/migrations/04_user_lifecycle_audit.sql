-- ============================================================
--  ConnectEd — User Lifecycle & Audit Migration
--  Run this in MySQL Workbench AFTER 03_user_management_upgrade.sql
--  File > Open SQL Script → 04_user_lifecycle_audit.sql → Execute All
-- ============================================================

USE connected_app;

-- ── Soft Delete: add deleted_at to users ──────────────────
-- Rows with deleted_at IS NOT NULL are treated as deleted by the backend.
ALTER TABLE users
    ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER is_active;

-- ── Audit timestamps on profile tables ────────────────────
ALTER TABLE student_profiles
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE teacher_profiles
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- ── Audit Log table ───────────────────────────────────────
-- Records sensitive admin actions (password resets, deletions, etc.)
CREATE TABLE IF NOT EXISTS audit_logs (
    id         INT          NOT NULL AUTO_INCREMENT,
    admin_id   INT          NOT NULL,           -- who performed the action
    action     VARCHAR(100) NOT NULL,           -- e.g. 'DELETE_USER', 'RESET_PASSWORD'
    target_id  INT          DEFAULT NULL,       -- user ID that was affected
    details    TEXT         DEFAULT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Verification ──────────────────────────────────────────
-- Run after execution:
-- DESCRIBE users;           -- should show deleted_at column
-- DESCRIBE student_profiles; -- should show created_at / updated_at
-- DESCRIBE teacher_profiles; -- should show created_at / updated_at
-- SELECT * FROM audit_logs;
