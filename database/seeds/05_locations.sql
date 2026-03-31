-- ============================================================
--  ConnectEd — Seed 10: Sample Locations
--
--  Idempotent — safe to re-run (INSERT IGNORE on name).
--  Populates the locations table used by the Admin → Locations
--  page and by timetable entries for physical/online sessions.
-- ============================================================

USE connected_app;

INSERT IGNORE INTO locations (name, type, capacity, is_active) VALUES
  ('Room 101',          'Classroom', 30, 1),
  ('Room 102',          'Classroom', 30, 1),
  ('Room 103',          'Classroom', 28, 1),
  ('Room 201',          'Classroom', 32, 1),
  ('Room 202',          'Classroom', 32, 1),
  ('Science Lab A',     'Lab',       24, 1),
  ('Science Lab B',     'Lab',       24, 1),
  ('Computer Lab',      'Lab',       30, 1),
  ('Main Hall',         'Hall',      200, 1),
  ('Assembly Hall',     'Hall',      150, 1),
  ('Library',           'Library',   50, 1),
  ('Sports Hall / Gym', 'Gym',       80, 1),
  ('Art Room',          'Classroom', 20, 1),
  ('Music Room',        'Classroom', 20, 1),
  ('Drama Studio',      'Classroom', 25, 1);

-- Verification
SELECT id, name, type, capacity, is_active
FROM locations
ORDER BY type, name;
