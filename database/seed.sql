USE connected;

-- ======================================================
-- ROLES
-- ======================================================
INSERT INTO roles (name) VALUES
  ('admin'),
  ('teacher'),
  ('student');

-- ======================================================
-- CLASSES
-- ======================================================
INSERT INTO classes (name) VALUES
  ('Form 1A'),
  ('Form 1B'),
  ('Form 2A'),
  ('Form 2B'),
  ('Form 3A'),
  ('Form 3B');

-- ======================================================
-- SUBJECTS
-- ======================================================
INSERT INTO subjects (name) VALUES
  ('Mathematics'),
  ('English'),
  ('Computer Science'),
  ('Physics'),
  ('Chemistry'),
  ('French');

-- ======================================================
-- USERS
-- ======================================================

-- 🔐 ADMIN (replace hash)
INSERT INTO users (role_id, full_name, email, password_hash, status)
VALUES (
  (SELECT id FROM roles WHERE name='admin'),
  'Yukta Emrith',
  'yuktae@admin.connected.com',
  'REPLACE_WITH_BCRYPT_HASH_HERE',
  'active'
);

-- 👩‍🏫 TEACHERS
INSERT INTO users (role_id, full_name, email, password_hash, status) VALUES
((SELECT id FROM roles WHERE name='teacher'), 'Emma Ah Kang', 'emmaak@teacher.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='teacher'), 'Janinne Halbacks', 'janineh@teacher.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='teacher'), 'Mrinal Sharma', 'mrinals@teacher.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='teacher'), 'Ravin Papiah', 'ravinp@teacher.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='teacher'), 'Sandrine Meetoo', 'sandrinem@teacher.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='teacher'), 'Suraj Juddoo', 'surajj@teacher.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='teacher'), 'Zia Lalmohamed', 'zial@teacher.connected.com', 'HASH', 'active');

-- 👨‍🎓 STUDENTS
INSERT INTO users (role_id, full_name, email, password_hash, status) VALUES
((SELECT id FROM roles WHERE name='student'), 'John Smith', 'johns@student.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='student'), 'Aisha Khan', 'aishak@student.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='student'), 'Kevin Wong', 'kevinw@student.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='student'), 'Sara Patel', 'sarap@student.connected.com', 'HASH', 'active'),
((SELECT id FROM roles WHERE name='student'), 'Liam Brown', 'liamb@student.connected.com', 'HASH', 'active');

-- ======================================================
-- TEACHER PROFILES (1 teacher → 1 subject)
-- ======================================================
INSERT INTO teacher_profile (user_id, subject_id) VALUES
((SELECT id FROM users WHERE email='emmaak@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='Chemistry')),

((SELECT id FROM users WHERE email='janineh@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='Mathematics')),

((SELECT id FROM users WHERE email='mrinals@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='French')),

((SELECT id FROM users WHERE email='ravinp@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='Computer Science')),

((SELECT id FROM users WHERE email='sandrinem@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='English')),

((SELECT id FROM users WHERE email='surajj@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='Physics')),

((SELECT id FROM users WHERE email='zial@teacher.connected.com'),
 (SELECT id FROM subjects WHERE name='Computer Science'));

-- ======================================================
-- STUDENT PROFILES (assign students to classes)
-- ======================================================
INSERT INTO student_profile (user_id, class_id) VALUES
((SELECT id FROM users WHERE email='johns@student.connected.com'),
 (SELECT id FROM classes WHERE name='Form 1A')),

((SELECT id FROM users WHERE email='aishak@student.connected.com'),
 (SELECT id FROM classes WHERE name='Form 1B')),

((SELECT id FROM users WHERE email='kevinw@student.connected.com'),
 (SELECT id FROM classes WHERE name='Form 2A')),

((SELECT id FROM users WHERE email='sarap@student.connected.com'),
 (SELECT id FROM classes WHERE name='Form 2B')),

((SELECT id FROM users WHERE email='liamb@student.connected.com'),
 (SELECT id FROM classes WHERE name='Form 3A'));

-- ======================================================
-- TEACHER ↔ CLASSES (many-to-many)
-- ======================================================
INSERT INTO teacher_classes (teacher_user_id, class_id) VALUES
((SELECT id FROM users WHERE email='janineh@teacher.connected.com'),
 (SELECT id FROM classes WHERE name='Form 1A')),

((SELECT id FROM users WHERE email='janineh@teacher.connected.com'),
 (SELECT id FROM classes WHERE name='Form 2A')),

((SELECT id FROM users WHERE email='ravinp@teacher.connected.com'),
 (SELECT id FROM classes WHERE name='Form 1B')),

((SELECT id FROM users WHERE email='ravinp@teacher.connected.com'),
 (SELECT id FROM classes WHERE name='Form 3B')),

((SELECT id FROM users WHERE email='sandrinem@teacher.connected.com'),
 (SELECT id FROM classes WHERE name='Form 2B')),

((SELECT id FROM users WHERE email='surajj@teacher.connected.com'),
 (SELECT id FROM classes WHERE name='Form 3A'));

-- ======================================================
-- CLASS GROUPS (used by Class Allocation panel)
-- ======================================================
INSERT INTO class_groups (class_id, subject_id, teacher_user_id) VALUES
((SELECT id FROM classes WHERE name='Form 1A'),
 (SELECT id FROM subjects WHERE name='Mathematics'),
 (SELECT id FROM users WHERE email='janineh@teacher.connected.com')),

((SELECT id FROM classes WHERE name='Form 1B'),
 (SELECT id FROM subjects WHERE name='Computer Science'),
 (SELECT id FROM users WHERE email='ravinp@teacher.connected.com')),

((SELECT id FROM classes WHERE name='Form 2B'),
 (SELECT id FROM subjects WHERE name='English'),
 (SELECT id FROM users WHERE email='sandrinem@teacher.connected.com'));

-- ======================================================
-- ADMIN ACTIVITY (Dashboard demo data)
-- ======================================================
INSERT INTO admin_activity (action, actor_name) VALUES
('New student enrolled', 'John Smith'),
('Class created', 'Admin'),
('Timetable updated', 'Admin'),
('Teacher added', 'Admin');
