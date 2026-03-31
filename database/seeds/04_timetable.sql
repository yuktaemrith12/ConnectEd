-- ============================================================
--  ConnectEd — Seed 09: Classes, Subjects & Timetable
--  Idempotent — safe to re-run at any time.
--
--  What this script does:
--    1. Ensures 10+ standard subjects exist.
--    2. Ensures 4 base classes exist (Grade 1-A/B, Grade 2-A/B).
--    3. Links sample teachers to their subjects (teacher_subjects).
--    4. Assigns subjects to classes (class_subjects).
--    5. Assigns teachers to class+subject combos (class_subject_teachers).
--    6. Seeds sample Mon/Tue timetable entries for Grade 1-A and Grade 2-A.
--    7. Prints a verification summary.
--
--  Depends on: 01_roles / 02_users seeds already run.
-- ============================================================

USE connected_app;

-- ════════════════════════════════════════════════════════════════
--  1) SUBJECTS  (10+ standard subjects)
-- ════════════════════════════════════════════════════════════════

INSERT IGNORE INTO subjects (name) VALUES
  ('Mathematics'),
  ('English'),
  ('Science'),
  ('History'),
  ('Geography'),
  ('Art'),
  ('Music'),
  ('Physical Education'),
  ('ICT'),
  ('Religious Education'),
  ('Drama');

-- ════════════════════════════════════════════════════════════════
--  2) CLASSES  (4+ base classes)
-- ════════════════════════════════════════════════════════════════

INSERT IGNORE INTO classes (name) VALUES
  ('Grade 1-A'),
  ('Grade 1-B'),
  ('Grade 2-A'),
  ('Grade 2-B');

-- ════════════════════════════════════════════════════════════════
--  3) TEACHER ↔ SUBJECT capability  (teacher_subjects)
--     Links the sample teachers seeded in 02_users.sql.
-- ════════════════════════════════════════════════════════════════

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'sarah.johnson@teacher.connected.com'  AND s.name = 'Mathematics';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'michael.chen@teacher.connected.com'   AND s.name = 'Science';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'priya.sharma@teacher.connected.com'   AND s.name = 'English';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'james.oconnor@teacher.connected.com'  AND s.name = 'History';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'fatima.hassan@teacher.connected.com'  AND s.name = 'Geography';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'david.martinez@teacher.connected.com' AND s.name = 'Art';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'anita.patel@teacher.connected.com'    AND s.name = 'Physical Education';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'robert.kim@teacher.connected.com'     AND s.name = 'Music';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'lisa.thompson@teacher.connected.com'  AND s.name = 'ICT';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'ahmed.ali@teacher.connected.com'      AND s.name = 'Mathematics';

-- Emma AK → Art + Drama
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'emmaak@teacher.connected.com'         AND s.name = 'Art';

INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'emmaak@teacher.connected.com'         AND s.name = 'Drama';

-- ════════════════════════════════════════════════════════════════
--  4) CLASS ↔ SUBJECT assignments  (class_subjects)
-- ════════════════════════════════════════════════════════════════

-- Grade 1-A: core + electives (including Drama for Emma AK)
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 1-A'
  AND s.name IN ('Mathematics','English','Science','Art','Drama','Physical Education','Music');

-- Grade 1-B: same subjects
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 1-B'
  AND s.name IN ('Mathematics','English','Science','Art','Drama','Physical Education','Music');

-- Grade 2-A: slightly different mix
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 2-A'
  AND s.name IN ('Mathematics','English','Science','History','Geography','ICT');

-- Grade 2-B: same as 2-A
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 2-B'
  AND s.name IN ('Mathematics','English','Science','History','Geography','ICT');

-- ════════════════════════════════════════════════════════════════
--  5) CLASS-SUBJECT-TEACHER  (class_subject_teachers)
-- ════════════════════════════════════════════════════════════════

-- Grade 1-A
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Mathematics'        AND u.email='sarah.johnson@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='English'            AND u.email='priya.sharma@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Science'            AND u.email='michael.chen@teacher.connected.com';
-- Art + Drama: Emma AK (verification checklist items)
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Art'                AND u.email='emmaak@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Drama'              AND u.email='emmaak@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Music'              AND u.email='robert.kim@teacher.connected.com';

-- Grade 1-B
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Mathematics'        AND u.email='ahmed.ali@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='English'            AND u.email='priya.sharma@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Science'            AND u.email='michael.chen@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Art'                AND u.email='david.martinez@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Drama'              AND u.email='emmaak@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Music'              AND u.email='robert.kim@teacher.connected.com';

-- Grade 2-A
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-A' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-A' AND s.name='History'     AND u.email='james.oconnor@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-A' AND s.name='Geography'   AND u.email='fatima.hassan@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-A' AND s.name='ICT'         AND u.email='lisa.thompson@teacher.connected.com';

-- Grade 2-B
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-B' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-B' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-B' AND s.name='History'     AND u.email='james.oconnor@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-B' AND s.name='Geography'   AND u.email='fatima.hassan@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 2-B' AND s.name='ICT'         AND u.email='lisa.thompson@teacher.connected.com';

-- ════════════════════════════════════════════════════════════════
--  6) TIMETABLE ENTRIES  (Grade 1-A and Grade 2-A, Mon + Tue)
--     Uses DELETE + INSERT IGNORE for idempotent re-runs.
-- ════════════════════════════════════════════════════════════════

SET SQL_SAFE_UPDATES = 0;
DELETE FROM timetable_entries
WHERE class_id IN (
  SELECT id FROM classes WHERE name IN ('Grade 1-A', 'Grade 2-A')
);
SET SQL_SAFE_UPDATES = 1;

-- Grade 1-A — Monday
INSERT INTO timetable_entries (class_id, subject_id, teacher_id, day, time_slot)
SELECT c.id, s.id, u.id, 'Monday', '9:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '10:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='English' AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '11:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Science' AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '1:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Art' AND u.email='emmaak@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '2:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Music' AND u.email='robert.kim@teacher.connected.com';

-- Grade 1-A — Tuesday
INSERT INTO timetable_entries (class_id, subject_id, teacher_id, day, time_slot)
SELECT c.id, s.id, u.id, 'Tuesday', '9:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='English' AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '10:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '11:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '1:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 1-A' AND s.name='Science' AND u.email='michael.chen@teacher.connected.com';

-- Grade 2-A — Monday
INSERT INTO timetable_entries (class_id, subject_id, teacher_id, day, time_slot)
SELECT c.id, s.id, u.id, 'Monday', '9:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '10:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='History' AND u.email='james.oconnor@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '11:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='Science' AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '1:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='Geography' AND u.email='fatima.hassan@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '2:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='ICT' AND u.email='lisa.thompson@teacher.connected.com';

-- Grade 2-A — Tuesday
INSERT INTO timetable_entries (class_id, subject_id, teacher_id, day, time_slot)
SELECT c.id, s.id, u.id, 'Tuesday', '9:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='English' AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '10:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '11:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='History' AND u.email='james.oconnor@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '1:00'
  FROM classes c, subjects s, users u
 WHERE c.name='Grade 2-A' AND s.name='Science' AND u.email='michael.chen@teacher.connected.com';

-- ════════════════════════════════════════════════════════════════
--  7) VERIFICATION SUMMARY
-- ════════════════════════════════════════════════════════════════

SELECT 'subjects'               AS table_name, COUNT(*) AS count FROM subjects
UNION ALL
SELECT 'classes',                COUNT(*) FROM classes
UNION ALL
SELECT 'class_subjects',         COUNT(*) FROM class_subjects
UNION ALL
SELECT 'teacher_subjects',       COUNT(*) FROM teacher_subjects
UNION ALL
SELECT 'class_subject_teachers', COUNT(*) FROM class_subject_teachers
UNION ALL
SELECT 'timetable_entries',      COUNT(*) FROM timetable_entries;

-- Check: Emma AK shows for Art in Grade 1-A
SELECT
  'Emma AK visible for Art in Grade 1-A' AS check_item,
  COUNT(*) AS expect_1
FROM class_subject_teachers cst
JOIN classes c   ON c.id  = cst.class_id   AND c.name  = 'Grade 1-A'
JOIN subjects s  ON s.id  = cst.subject_id AND s.name  = 'Art'
JOIN users u     ON u.id  = cst.teacher_id AND u.email = 'emmaak@teacher.connected.com';

-- Check: Emma AK shows for Drama in Grade 1-A
SELECT
  'Emma AK visible for Drama in Grade 1-A' AS check_item,
  COUNT(*) AS expect_1
FROM class_subject_teachers cst
JOIN classes c   ON c.id  = cst.class_id   AND c.name  = 'Grade 1-A'
JOIN subjects s  ON s.id  = cst.subject_id AND s.name  = 'Drama'
JOIN users u     ON u.id  = cst.teacher_id AND u.email = 'emmaak@teacher.connected.com';
