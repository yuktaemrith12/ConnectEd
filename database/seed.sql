-- ============================================================
--  ConnectEd — MySQL Seed Data
--  Step 2 of 2: Run this AFTER schema.sql in MySQL Workbench
--  (File > Open SQL Script → seed.sql → Execute All)
--
--  All 4 users share the password: 12345
--  Hash was generated with bcrypt cost factor 12 via:
--      python -c "import bcrypt; print(bcrypt.hashpw(b'12345', bcrypt.gensalt(12)).decode())"
-- ============================================================

USE connected_app;

-- ── Roles ────────────────────────────────────────────────────
INSERT IGNORE INTO roles (name) VALUES ('admin');
INSERT IGNORE INTO roles (name) VALUES ('teacher');
INSERT IGNORE INTO roles (name) VALUES ('student');
INSERT IGNORE INTO roles (name) VALUES ('parent');

-- ── Users (password: 12345) ──────────────────────────────────
INSERT IGNORE INTO users (email, hashed_password, full_name, role_id, is_active)
VALUES
(
    'yuktae@admin.connected.com',
    '$2b$12$jnFOd2fxWdly1w1rJdBUwuuK1btNTUkKW.FT2DUm5Qtzla7JYUaYa',
    'Yukta E',
    (SELECT id FROM roles WHERE name = 'admin'),
    1
),
(
    'emmaak@teacher.connected.com',
    '$2b$12$jnFOd2fxWdly1w1rJdBUwuuK1btNTUkKW.FT2DUm5Qtzla7JYUaYa',
    'Emma AK',
    (SELECT id FROM roles WHERE name = 'teacher'),
    1
),
(
    'renveerr@student.connected.com',
    '$2b$12$jnFOd2fxWdly1w1rJdBUwuuK1btNTUkKW.FT2DUm5Qtzla7JYUaYa',
    'Renveer R',
    (SELECT id FROM roles WHERE name = 'student'),
    1
),
(
    'oormilae@parent.connected.com',
    '$2b$12$jnFOd2fxWdly1w1rJdBUwuuK1btNTUkKW.FT2DUm5Qtzla7JYUaYa',
    'Oormila E',
    (SELECT id FROM roles WHERE name = 'parent'),
    1
);

-- ── Verification ─────────────────────────────────────────────
-- After running, confirm 4 rows exist:
-- SELECT u.email, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id;
