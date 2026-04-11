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
--  Usage (manage_db.py):
--    python database/manage_db.py --setup
--
--  Safe to re-run: all tables use IF NOT EXISTS,
--  all seeds use INSERT IGNORE.
-- ============================================================

CREATE DATABASE IF NOT EXISTS connected_app
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE connected_app;

--  SCHEMA MIGRATIONS  (run in order — dependencies first)

SOURCE migrations/01_users_admin.sql;       -- Roles, Users, Audit Logs
SOURCE migrations/02_academics.sql;         -- Subjects, Classes, Class↔Subject
SOURCE migrations/03_profiles.sql;          -- Student/Teacher Profiles, Parent↔Student
SOURCE migrations/04_timetable.sql;         -- Class↔Subject↔Teacher, Locations, Timetable
SOURCE migrations/05_attendance.sql;        -- Attendance Records + Sessions
SOURCE migrations/06_fees.sql;              -- Academic Periods, Fee Plans, Payments
SOURCE migrations/07_events.sql;            -- Events, Event↔Class targeting
SOURCE migrations/08_homework.sql;          -- Homework, Attachments, Completions
SOURCE migrations/09_assignments_grading.sql; -- Assignments, Submissions, AI Reviews
SOURCE migrations/10_messaging.sql;         -- Conversations, Participants, Messages
SOURCE migrations/11_whatsapp_notifications.sql; -- WhatsApp Settings, Sent Log, Delivery, Optouts
SOURCE migrations/12_ai_study_materials.sql; -- Transcript → Notes → Illustration pipeline
SOURCE migrations/13_ai_tutor.sql;          -- RAG Tutor, Chapters, Documents, Chat, Infographics
SOURCE migrations/14_video_conferencing.sql; -- Meetings, Recordings, Emotion Logs, Analytics
SOURCE migrations/15_consent_management.sql; -- GDPR Consent Records + Audit Logs
SOURCE migrations/16_whatsapp_webhook.sql;  -- WhatsApp Delivery Log + Opt-Out Registry

--  SEED DATA

SOURCE seeds/01_roles.sql;        -- Roles (admin, teacher, student, parent)
SOURCE seeds/02_users.sql;        -- 4 demo accounts (password: 12345)
SOURCE seeds/03_academics.sql;    -- Subjects & Classes
SOURCE seeds/04_timetable.sql;    -- Class↔Subject mappings, teacher assignments, timetable slots
SOURCE seeds/05_locations.sql;    -- Sample locations (classrooms, labs, halls)
SOURCE seeds/06_parent_student.sql; -- Student profile + Parent↔Student link

SELECT '✅ RUN_ALL complete — all migrations and seeds applied.' AS status;
