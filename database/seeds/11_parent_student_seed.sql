-- ============================================================
--  ConnectEd — Seed 11: Parent–Student Link & Student Profile
--
--  Idempotent — safe to re-run (INSERT IGNORE throughout).
--
--  What this script does:
--    1. Creates a student_profile for Renveer R (renveerr@student)
--       and enrols them in Grade 1-A.
--    2. Links Oormila E (parent) to Renveer R (student) in
--       parent_students so the Parent portal works.
--    3. Prints a verification summary.
--
--  Depends on: 01_roles / 02_users / 03_academics seeds run first.
-- ============================================================

USE connected_app;

-- ════════════════════════════════════════════════════════════════
--  1) Student profile for Renveer R
-- ════════════════════════════════════════════════════════════════

INSERT IGNORE INTO student_profiles (user_id, class_id, student_code)
SELECT u.id, c.id, 'ST0001'
FROM users u
JOIN classes c ON c.name = 'Grade 1-A'
WHERE u.email = 'renveerr@student.connected.com';

-- ════════════════════════════════════════════════════════════════
--  2) Parent–Student link: Oormila E → Renveer R
-- ════════════════════════════════════════════════════════════════

INSERT IGNORE INTO parent_students (parent_id, student_id, relationship_type)
SELECT p.id, s.id, 'Guardian'
FROM users p
JOIN users s ON s.email = 'renveerr@student.connected.com'
WHERE p.email = 'oormilae@parent.connected.com';

-- ════════════════════════════════════════════════════════════════
--  3) Verification
-- ════════════════════════════════════════════════════════════════

SELECT 'student_profiles' AS tbl,
       u.full_name, u.email, c.name AS class_name, sp.student_code
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
LEFT JOIN classes c ON c.id = sp.class_id
WHERE u.email = 'renveerr@student.connected.com';

SELECT 'parent_students' AS tbl,
       p.full_name AS parent_name, s.full_name AS student_name, ps.relationship_type
FROM parent_students ps
JOIN users p ON p.id = ps.parent_id
JOIN users s ON s.id = ps.student_id
WHERE p.email = 'oormilae@parent.connected.com';
