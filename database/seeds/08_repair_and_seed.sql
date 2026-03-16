-- ============================================================
--  ConnectEd — Seed 08: Repair Orphaned Data & Verify Fixtures
--
--  Run this script ONCE in MySQL Workbench after the backend
--  code fixes have been applied.  It is idempotent (safe to
--  re-run).
--
--  What this script does:
--    1. Removes timetable_entries that reference a non-existent
--       subject or teacher (orphaned records that caused 500s).
--    2. Ensures teacher_subjects has valid rows for every sample
--       teacher (guards against missed rows from earlier seeds).
--    3. Ensures class_subject_teachers assignments exist for
--       Grade 1-A and Grade 2-A so the "Manage Class" modal
--       shows teachers correctly.
--    4. Links Emma AK to the Art subject and assigns her to Grade 1-A.
--    5. Prints a quick verification count at the end.
-- ============================================================

USE connected_app;

-- ════════════════════════════════════════════════════════════════
--  STEP 1 — Clean up orphaned timetable_entries
--  (entries whose subject or teacher no longer exists)
-- ════════════════════════════════════════════════════════════════

SET SQL_SAFE_UPDATES = 0;

-- Remove entries pointing to a deleted/missing subject
DELETE FROM timetable_entries
WHERE subject_id NOT IN (SELECT id FROM subjects);

-- Remove entries pointing to a deleted/missing teacher
-- (teacher_id can legitimately be NULL for unassigned slots — keep those)
DELETE FROM timetable_entries
WHERE teacher_id IS NOT NULL
  AND teacher_id NOT IN (SELECT id FROM users WHERE deleted_at IS NULL);

SET SQL_SAFE_UPDATES = 1;

-- ════════════════════════════════════════════════════════════════
--  STEP 2 — Repair teacher_subjects
--  Ensure every sample teacher has at least their primary subject.
--  INSERT IGNORE is safe if the row already exists.
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

-- ════════════════════════════════════════════════════════════════
--  STEP 3 — Repair class_subject_teachers for Grade 1-A
--  (these are needed so the Manage Class modal shows teachers)
-- ════════════════════════════════════════════════════════════════

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Mathematics'        AND u.email='sarah.johnson@teacher.connected.com';

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='English'            AND u.email='priya.sharma@teacher.connected.com';

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Science'            AND u.email='michael.chen@teacher.connected.com';

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Art'                AND u.email='david.martinez@teacher.connected.com';

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com';

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-A' AND s.name='Music'              AND u.email='robert.kim@teacher.connected.com';

-- ════════════════════════════════════════════════════════════════
--  STEP 4 — Repair class_subject_teachers for Grade 2-A
-- ════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════
--  STEP 5 — Emma AK: link to Art + assign to Grade 1-A
--
--  Emma AK is seeded in 02_users.sql as a teacher.
--  Without an explicit teacher_subjects row she won't appear in
--  the subject-teacher dropdown.  Without class_subject_teachers
--  she won't appear in the Manage Class modal for Grade 1-A.
-- ════════════════════════════════════════════════════════════════

-- 5a) Link Emma AK to Art in teacher_subjects
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE u.email = 'emmaak@teacher.connected.com' AND s.name = 'Art';

-- 5b) Assign Emma AK as the Art teacher for Grade 1-A
--     (first ensure Art is a subject of Grade 1-A, then add the teacher link)
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 1-A' AND s.name = 'Art';

INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name = 'Grade 1-A' AND s.name = 'Art' AND u.email = 'emmaak@teacher.connected.com';

-- 5c) Set Emma AK as Head Teacher of Grade 1-A (if not already set)
UPDATE classes c
JOIN users u ON u.email = 'emmaak@teacher.connected.com'
SET c.head_teacher_id = u.id
WHERE c.name = 'Grade 1-A'
  AND c.head_teacher_id IS NULL;

-- ════════════════════════════════════════════════════════════════
--  STEP 6 — Verification counts  (check output in Workbench)
-- ════════════════════════════════════════════════════════════════

SELECT 'timetable_entries (total)'            AS check_item, COUNT(*) AS count FROM timetable_entries
UNION ALL
SELECT 'timetable_entries (orphaned subject)', COUNT(*) FROM timetable_entries WHERE subject_id NOT IN (SELECT id FROM subjects)
UNION ALL
SELECT 'teacher_subjects (total)',             COUNT(*) FROM teacher_subjects
UNION ALL
SELECT 'class_subject_teachers (total)',       COUNT(*) FROM class_subject_teachers
UNION ALL
SELECT 'class_subjects (total)',               COUNT(*) FROM class_subjects
UNION ALL
SELECT 'Emma AK → Art (teacher_subjects)',
    COUNT(*) FROM teacher_subjects ts
    JOIN users u ON u.id = ts.teacher_id AND u.email = 'emmaak@teacher.connected.com'
    JOIN subjects s ON s.id = ts.subject_id AND s.name = 'Art'
UNION ALL
SELECT 'Emma AK → Grade 1-A Art (class_subject_teachers)',
    COUNT(*) FROM class_subject_teachers cst
    JOIN classes c ON c.id = cst.class_id AND c.name = 'Grade 1-A'
    JOIN subjects s ON s.id = cst.subject_id AND s.name = 'Art'
    JOIN users u ON u.id = cst.teacher_id AND u.email = 'emmaak@teacher.connected.com';
