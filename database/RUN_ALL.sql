-- ============================================================
--  ConnectEd — Master Setup Script
--  Builds the entire database from scratch in one run.
--
--  Usage (MySQL Workbench):
--    File > Open SQL Script > RUN_ALL.sql > Execute All (⚡)
--
--  Usage (CLI):
--    mysql -u root -p < database/RUN_ALL.sql
--
--  Safe to re-run: all tables use IF NOT EXISTS,
--  all seeds use INSERT IGNORE.
-- ============================================================

-- ── Create database ──────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS connected_app
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE connected_app;

-- ═════════════════════════════════════════════════════════════
--  SCHEMA MIGRATIONS (order matters — dependencies first)
-- ═════════════════════════════════════════════════════════════

-- 01: Roles, Users, Audit Logs
SOURCE migrations/01_users_admin.sql;

-- 02: Subjects, Classes, Class↔Subject junction
SOURCE migrations/02_academics.sql;

-- 03: Student/Teacher Profiles, Parent↔Student, Teacher↔Subject
SOURCE migrations/03_profiles.sql;

-- 04: Timetable Entries
SOURCE migrations/04_timetable.sql;

-- 05: Attendance Records
SOURCE migrations/05_attendance.sql;

-- 06: Academic Periods, Fee Plans, Payments, Installments, Notifications
SOURCE migrations/06_fees.sql;

-- 07: Events, Event↔Class targeting
SOURCE migrations/07_events.sql;

-- ═════════════════════════════════════════════════════════════
--  SEED DATA
-- ═════════════════════════════════════════════════════════════

-- Seed 01: Roles (admin, teacher, student, parent)
SOURCE seeds/01_roles.sql;

-- Seed 02: Base Users (4 login accounts, password: 12345)
SOURCE seeds/02_users.sql;

-- Seed 03: Subjects & Classes
SOURCE seeds/03_academics.sql;

-- ═════════════════════════════════════════════════════════════
SELECT '✅ RUN_ALL complete — all migrations and seeds applied.' AS status;
