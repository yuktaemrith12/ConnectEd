-- ============================================================
--  ConnectEd — Seed: Timetable & Teacher Assignments
--  Populates class_subjects, teacher_subjects,
--  class_subject_teachers, and timetable_entries for multiple
--  classes. Idempotent via INSERT IGNORE.
--
--  Depends on: roles, users, subjects, classes already seeded
--              (01_roles, 02_users, 03_academics seeds)
--              AND migration 09_timetable_teacher_upgrade.sql
-- ============================================================

USE connected_app;

-- ════════════════════════════════════════════════════════════════
--  1) CLASS ↔ SUBJECT mappings  (class_subjects)
--     Assign subjects to multiple classes so the timetable
--     validation passes for all of them. 
-- ════════════════════════════════════════════════════════════════

-- Grade 1-A
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 1-A' AND s.name IN ('Mathematics','English','Science','Art','Physical Education','Music');

-- Grade 1-B
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 1-B' AND s.name IN ('Mathematics','English','Science','Art','Physical Education','Music');

-- Grade 2-A
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 2-A' AND s.name IN ('Mathematics','English','Science','History','Geography','ICT');

-- Grade 2-B
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 2-B' AND s.name IN ('Mathematics','English','Science','History','Geography','ICT');

-- Grade 3-A
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 3-A' AND s.name IN ('Mathematics','English','Science','History','Art','Music','ICT');

-- Grade 3-B
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 3-B' AND s.name IN ('Mathematics','English','Science','History','Art','Music','ICT');

-- Grade 4-A
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 4-A' AND s.name IN ('Mathematics','English','Science','Geography','Physical Education','ICT');

-- Grade 4-B
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 4-B' AND s.name IN ('Mathematics','English','Science','Geography','Physical Education','ICT');

-- Grade 5-A
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 5-A' AND s.name IN ('Mathematics','English','Science','History','Geography','Art','ICT');

-- Grade 5-B
INSERT IGNORE INTO class_subjects (class_id, subject_id)
SELECT c.id, s.id FROM classes c, subjects s
WHERE c.name = 'Grade 5-B' AND s.name IN ('Mathematics','English','Science','History','Geography','Art','ICT');


-- ════════════════════════════════════════════════════════════════
--  2) TEACHER ↔ SUBJECT capability  (teacher_subjects)
--     Uses the teachers seeded in seed_sample_users.sql.
--     INSERT IGNORE so re-running is safe.
-- ════════════════════════════════════════════════════════════════

-- (These may already exist from seed_sample_users.sql — INSERT IGNORE is safe)
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'sarah.johnson@teacher.connected.com'  AND s.name = 'Mathematics';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'michael.chen@teacher.connected.com'   AND s.name = 'Science';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'priya.sharma@teacher.connected.com'   AND s.name = 'English';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'james.oconnor@teacher.connected.com'  AND s.name = 'History';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'fatima.hassan@teacher.connected.com'  AND s.name = 'Geography';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'david.martinez@teacher.connected.com' AND s.name = 'Art';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'anita.patel@teacher.connected.com'    AND s.name = 'Physical Education';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'robert.kim@teacher.connected.com'     AND s.name = 'Music';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'lisa.thompson@teacher.connected.com'  AND s.name = 'ICT';
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s WHERE u.email = 'ahmed.ali@teacher.connected.com'      AND s.name = 'Mathematics';


-- ════════════════════════════════════════════════════════════════
--  3) CLASS-SUBJECT-TEACHER assignments (class_subject_teachers)
--     Assigns a specific teacher to each class+subject combo.
-- ════════════════════════════════════════════════════════════════

-- Helper: Grade 1-A
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

-- Helper: Grade 1-B
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
WHERE c.name='Grade 1-B' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 1-B' AND s.name='Music'              AND u.email='robert.kim@teacher.connected.com';

-- Helper: Grade 2-A
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

-- Helper: Grade 2-B
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

-- Helper: Grade 3-A
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='History'     AND u.email='james.oconnor@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='Music'       AND u.email='robert.kim@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-A' AND s.name='ICT'         AND u.email='lisa.thompson@teacher.connected.com';

-- Helper: Grade 3-B  (same assignments as 3-A for simplicity)
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='History'     AND u.email='james.oconnor@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='Music'       AND u.email='robert.kim@teacher.connected.com';
INSERT IGNORE INTO class_subject_teachers (class_id, subject_id, teacher_id)
SELECT c.id, s.id, u.id FROM classes c, subjects s, users u
WHERE c.name='Grade 3-B' AND s.name='ICT'         AND u.email='lisa.thompson@teacher.connected.com';


-- ════════════════════════════════════════════════════════════════
--  4) SAMPLE TIMETABLE ENTRIES  (timetable_entries)
--     Mon–Fri slots for Grade 1-A and Grade 1-B.
--     Uses DELETE + INSERT for idempotent re-runs.
-- ════════════════════════════════════════════════════════════════

-- Clear existing entries for these two classes before re-seeding
-- (Temporarily disable safe-update mode for this DELETE)
SET SQL_SAFE_UPDATES = 0;
DELETE FROM timetable_entries
WHERE class_id IN (SELECT id FROM classes WHERE name IN ('Grade 1-A','Grade 1-B'));
SET SQL_SAFE_UPDATES = 1;

-- Grade 1-A timetable
INSERT INTO timetable_entries (class_id, subject_id, teacher_id, day, time_slot)
SELECT c.id, s.id, u.id, 'Monday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '2:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Music'       AND u.email='robert.kim@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Music'       AND u.email='robert.kim@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Mathematics' AND u.email='sarah.johnson@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-A' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com';

-- Grade 1-B timetable
INSERT INTO timetable_entries (class_id, subject_id, teacher_id, day, time_slot)
SELECT c.id, s.id, u.id, 'Monday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Monday', '2:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Music'       AND u.email='robert.kim@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Tuesday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Wednesday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Music'       AND u.email='robert.kim@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Physical Education' AND u.email='anita.patel@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Thursday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '9:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='English'     AND u.email='priya.sharma@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '10:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Art'         AND u.email='david.martinez@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '11:00' FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Science'     AND u.email='michael.chen@teacher.connected.com'
UNION ALL
SELECT c.id, s.id, u.id, 'Friday', '1:00'  FROM classes c, subjects s, users u WHERE c.name='Grade 1-B' AND s.name='Mathematics' AND u.email='ahmed.ali@teacher.connected.com';


-- ── Verification ───────────────────────────────────────────────
SELECT 'class_subjects'         AS tbl, COUNT(*) AS cnt FROM class_subjects
UNION ALL
SELECT 'teacher_subjects',       COUNT(*) FROM teacher_subjects
UNION ALL
SELECT 'class_subject_teachers', COUNT(*) FROM class_subject_teachers
UNION ALL
SELECT 'timetable_entries',      COUNT(*) FROM timetable_entries;
