-- ============================================================
--  ConnectEd — Seed: Subjects & Classes
--  Reference data for the academics domain.
--  Idempotent: INSERT IGNORE skips duplicates.
-- ============================================================

USE connected_app;

-- ── Subjects ─────────────────────────────────────────────────
INSERT IGNORE INTO subjects (name) VALUES
    ('Mathematics'),
    ('English'),
    ('Science'),
    ('History'),
    ('Geography'),
    ('Art'),
    ('Physical Education'),
    ('Music'),
    ('ICT');

-- ── Classes ──────────────────────────────────────────────────
INSERT IGNORE INTO classes (name) VALUES
    ('Grade 1-A'), ('Grade 1-B'),
    ('Grade 2-A'), ('Grade 2-B'),
    ('Grade 3-A'), ('Grade 3-B'),
    ('Grade 4-A'), ('Grade 4-B'),
    ('Grade 5-A'), ('Grade 5-B');
