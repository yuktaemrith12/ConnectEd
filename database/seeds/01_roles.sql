-- ============================================================
--  ConnectEd — Seed: Roles
--  Inserts the 4 system roles (idempotent with INSERT IGNORE).
-- ============================================================

USE connected_app;

INSERT IGNORE INTO roles (name) VALUES ('admin');
INSERT IGNORE INTO roles (name) VALUES ('teacher');
INSERT IGNORE INTO roles (name) VALUES ('student');
INSERT IGNORE INTO roles (name) VALUES ('parent');
