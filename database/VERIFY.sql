-- ============================================================
--  ConnectEd — Verification / Smoke Tests
--  Run after RUN_ALL.sql to confirm the setup is correct.
--
--  Expected results are shown as comments next to each query.
-- ============================================================

USE connected_app;

-- ── 1. Table Count ───────────────────────────────────────────
-- Should return ~53 tables across all modules
SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'connected_app';

-- Full list with estimated row counts
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.tables
WHERE table_schema = 'connected_app'
ORDER BY TABLE_NAME;

-- ── 2. Core Auth ─────────────────────────────────────────────
-- Expected: 4 roles
SELECT COUNT(*) AS role_count FROM roles;

-- Expected: >= 4 seed users
SELECT COUNT(*) AS user_count FROM users WHERE deleted_at IS NULL;

-- Seed users with roles
SELECT u.id, u.email, u.full_name, r.name AS role
FROM users u
JOIN roles r ON u.role_id = r.id
ORDER BY u.id;

-- ── 3. Academics ─────────────────────────────────────────────
-- Expected: >= 9 subjects
SELECT COUNT(*) AS subject_count FROM subjects;

-- Expected: >= 10 classes
SELECT COUNT(*) AS class_count FROM classes;

-- ── 4. Key Column Checks ─────────────────────────────────────
-- users.deleted_at (soft delete)
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = 'connected_app'
  AND table_name = 'users'
  AND column_name = 'deleted_at';

-- timetable_entries.delivery_mode (online/onsite)
SELECT COLUMN_NAME, DATA_TYPE
FROM information_schema.columns
WHERE table_schema = 'connected_app'
  AND table_name = 'timetable_entries'
  AND column_name IN ('delivery_mode', 'location_id', 'online_join_url', 'is_published');

-- ai_reviews.annotations (grading annotations)
SELECT COLUMN_NAME
FROM information_schema.columns
WHERE table_schema = 'connected_app'
  AND table_name = 'ai_reviews'
  AND column_name = 'annotations';

-- consent_records table exists
SELECT COUNT(*) AS consent_table_exists
FROM information_schema.tables
WHERE table_schema = 'connected_app'
  AND table_name = 'consent_records';

-- ── 5. Foreign Key Integrity ─────────────────────────────────
-- Expected: 0 (no orphaned users)
SELECT COUNT(*) AS orphaned_users
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE r.id IS NULL;

-- ── 6. Module Coverage ───────────────────────────────────────
-- Confirm one key table per major module exists
SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='attendance_sessions')    AS attendance_sessions,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='assignments')            AS assignments,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='conversations')         AS messaging,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='ai_tutors')             AS ai_tutor,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='meetings')              AS video_conferencing,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='consent_records')       AS consent,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='connected_app' AND table_name='whatsapp_sent_log')     AS whatsapp;

-- ══════════════════════════════════════════════════════════════
SELECT '✅ All verification checks complete.' AS status;
