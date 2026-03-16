-- ============================================================
--  ConnectEd — Verification / Smoke Tests
--  Run after RUN_ALL.sql to confirm data integrity.
--
--  Expected results are shown as comments next to each query.
-- ============================================================

USE connected_app;

-- ── 1. Table Existence ───────────────────────────────────────
-- Should return 15 rows (one per table)
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.tables
WHERE table_schema = 'connected_app'
ORDER BY TABLE_NAME;

-- ── 2. Role Count ────────────────────────────────────────────
-- Expected: 4
SELECT COUNT(*) AS role_count FROM roles;

-- ── 3. User Count ────────────────────────────────────────────
-- Expected: >= 4 (the 4 seed users)
SELECT COUNT(*) AS user_count FROM users;

-- ── 4. Seed Users with Roles ─────────────────────────────────
-- Should show 4 rows with correct role assignments
SELECT u.id, u.email, u.full_name, r.name AS role
FROM users u
JOIN roles r ON u.role_id = r.id
ORDER BY u.id;

-- ── 5. Subject Count ─────────────────────────────────────────
-- Expected: 9
SELECT COUNT(*) AS subject_count FROM subjects;

-- ── 6. Class Count ───────────────────────────────────────────
-- Expected: 10
SELECT COUNT(*) AS class_count FROM classes;

-- ── 7. Key Column Checks ─────────────────────────────────────
-- Verify deleted_at exists on users
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = 'connected_app'
  AND table_name = 'users'
  AND column_name = 'deleted_at';

-- Verify student_profiles has dob, address, phone, created_at
SELECT COLUMN_NAME
FROM information_schema.columns
WHERE table_schema = 'connected_app'
  AND table_name = 'student_profiles'
  AND column_name IN ('dob', 'address', 'phone', 'created_at')
ORDER BY ORDINAL_POSITION;

-- Verify fee_plans has base_amount, discount_amount, academic_period_id
SELECT COLUMN_NAME
FROM information_schema.columns
WHERE table_schema = 'connected_app'
  AND table_name = 'fee_plans'
  AND column_name IN ('base_amount', 'discount_amount', 'academic_period_id')
ORDER BY ORDINAL_POSITION;

-- ── 8. Foreign Key Integrity ─────────────────────────────────
-- Should return 0 (no orphaned users)
SELECT COUNT(*) AS orphaned_users
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE r.id IS NULL;

-- ══════════════════════════════════════════════════════════════
SELECT '✅ All verification checks complete.' AS status;
