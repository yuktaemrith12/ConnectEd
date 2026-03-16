-- ============================================================
--  ConnectEd — Seed: Base Users
--  4 login accounts — password: 12345 for all.
--  Hash generated with: bcrypt cost factor 12
--    python -c "import bcrypt; print(bcrypt.hashpw(b'12345', bcrypt.gensalt(12)).decode())"
--  Idempotent: INSERT IGNORE skips if email already exists.
-- ============================================================

USE connected_app;

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
