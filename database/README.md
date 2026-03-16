# ConnectEd — Database Migration System

## Folder Structure

```
database/
├── README.md              ← You are here
├── RUN_ALL.sql            ← Master script (fresh install)
├── VERIFY.sql             ← Smoke-test checks
├── migrations/            ← Schema definitions (dependency-ordered)
│   ├── 01_users_admin.sql    roles, users, audit_logs
│   ├── 02_academics.sql      subjects, classes, class_subjects
│   ├── 03_profiles.sql       student/teacher profiles, junctions
│   ├── 04_timetable.sql      timetable_entries
│   ├── 05_attendance.sql     attendance_records
│   ├── 06_fees.sql           fee_plans, payments, installments, notifications
│   └── 07_events.sql         events, event_target_classes
└── seeds/                 ← Reference / demo data
    ├── 01_roles.sql          admin, teacher, student, parent
    ├── 02_users.sql          4 login accounts (password: 12345)
    └── 03_academics.sql      9 subjects + 10 classes
```

## Run Order (dependency chain)

```
01_users_admin  →  02_academics  →  03_profiles  →  04_timetable
                                        ↓
                                  05_attendance
                                  06_fees
                    02_academics  →  07_events
```

Seeds must run **after** migrations: `01_roles` → `02_users` → `03_academics`.

## Fresh Install

1. Open **MySQL Workbench** (or CLI).
2. Open `database/RUN_ALL.sql`.
3. Execute All — this creates the `connected_app` database, runs all migrations, and inserts seed data.
4. Open `database/VERIFY.sql` and run it to confirm everything is correct.

**CLI alternative:**
```bash
cd ConnectEd
mysql -u root -p < database/RUN_ALL.sql
mysql -u root -p connected_app < database/VERIFY.sql
```

## Incremental Updates

If the database already exists and you only need to apply a specific migration:

1. Open the individual migration file (e.g. `migrations/06_fees.sql`).
2. Run it in MySQL Workbench.

All scripts use `CREATE TABLE IF NOT EXISTS`, so re-running is safe for tables. For column additions in the future, use the `INFORMATION_SCHEMA` pattern (see legacy files for examples).

## Adding Future Migrations

1. Create a new file: `migrations/08_your_domain.sql`.
2. Start with `USE connected_app;`.
3. Use `CREATE TABLE IF NOT EXISTS` for all new tables.
4. Add a `SOURCE` line in `RUN_ALL.sql` in the correct dependency position.
5. If seed data is needed, add a new file in `seeds/`.

## Seed Password

All 4 demo users share password **`12345`**, hashed with bcrypt cost 12. To regenerate:

```python
import bcrypt
print(bcrypt.hashpw(b'12345', bcrypt.gensalt(12)).decode())
```

## Legacy Files

The old migration files (`02_admin_features.sql`, `03_user_management_upgrade.sql`, etc.) have been consolidated into this modular structure. They are kept in the repository for reference but should **not** be run on new installations — use `RUN_ALL.sql` instead.
