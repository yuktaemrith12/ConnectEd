USE connected;

-- ======================================================
-- ROLES
-- ======================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE -- 'admin' | 'teacher' | 'student'
);

-- ======================================================
-- USERS
-- ======================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Helpful index for trend queries / listing
CREATE INDEX idx_users_role_created ON users(role_id, created_at);

-- ======================================================
-- CLASSES
-- ======================================================
CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE -- e.g. 'Form 1A'
);

-- ======================================================
-- SUBJECTS
-- ======================================================
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE -- e.g. 'Mathematics'
);

-- ======================================================
-- STUDENT PROFILE (1-1 with users)
-- Student can be unassigned (NULL class_id)
-- ======================================================
CREATE TABLE IF NOT EXISTS student_profile (
  user_id INT PRIMARY KEY,
  class_id INT NULL,
  CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

CREATE INDEX idx_student_profile_class ON student_profile(class_id);

-- ======================================================
-- TEACHER PROFILE (1-1 with users)
-- Each teacher has ONE subject they teach
-- ======================================================
CREATE TABLE IF NOT EXISTS teacher_profile (
  user_id INT PRIMARY KEY,
  subject_id INT NOT NULL,
  CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE INDEX idx_teacher_profile_subject ON teacher_profile(subject_id);

-- ======================================================
-- TEACHER <-> CLASSES (many-to-many)
-- One class can have many teachers; one teacher can teach many classes
-- ======================================================
CREATE TABLE IF NOT EXISTS teacher_classes (
  teacher_user_id INT NOT NULL,
  class_id INT NOT NULL,
  PRIMARY KEY (teacher_user_id, class_id),
  CONSTRAINT fk_tc_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tc_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE INDEX idx_teacher_classes_class ON teacher_classes(class_id);

-- ======================================================
-- CLASS GROUPS (used by your class allocation endpoints)
-- One row per class (PK=class_id)
-- ======================================================
CREATE TABLE IF NOT EXISTS class_groups (
  class_id INT PRIMARY KEY,
  subject_id INT NOT NULL,
  teacher_user_id INT NULL,
  CONSTRAINT fk_cg_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cg_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_cg_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ======================================================
-- CLASS TIMETABLE
-- IMPORTANT: matches your ACTUAL DB shape:
-- - day_of_week is ENUM('Monday'...'Friday')
-- - period is INT
-- - start_time/end_time can be NULL if you want, but we keep them NOT NULL for UI consistency
-- - updated_at for dashboard activity / “recently updated”
-- ======================================================
CREATE TABLE IF NOT EXISTS class_timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday') NOT NULL,
  period INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_user_id INT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_tt_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_tt_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY uq_tt (class_id, day_of_week, period)
);

-- For conflict checking (teacher double booking at same time/day)
CREATE INDEX idx_tt_teacher_time ON class_timetable (teacher_user_id, day_of_week, start_time, end_time);

-- For faster timetable loading per class
CREATE INDEX idx_tt_class_day_period ON class_timetable (class_id, day_of_week, period);

-- ======================================================
-- ADMIN ACTIVITY (dashboard recent activity)
-- ======================================================
CREATE TABLE IF NOT EXISTS admin_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(150) NOT NULL,
  actor_name VARCHAR(120) NULL,
  meta JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_activity_created ON admin_activity(created_at);
