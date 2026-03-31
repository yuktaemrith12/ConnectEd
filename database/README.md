# ConnectEd — Database

## Folder Structure

```
database/
├── README.md              ← You are here
├── RUN_ALL.sql            ← Master script: creates DB + runs all 16 migrations + 6 seeds
├── VERIFY.sql             ← Smoke-test queries to run after setup
├── manage_db.py           ← Python CLI wrapper (reads backend/.env automatically)
│
├── migrations/            ← Schema definitions, ordered 01 → 16
│   ├── 01_users_admin.sql         roles, users, audit_logs
│   ├── 02_academics.sql           subjects, classes, class_subjects
│   ├── 03_profiles.sql            student/teacher profiles, parent_students, teacher_subjects
│   ├── 04_timetable.sql           class_subject_teachers, locations, timetable_entries
│   ├── 05_attendance.sql          attendance_records, attendance_sessions, session_attendance_records
│   ├── 06_fees.sql                academic_periods, fee_plans, fee_payments, installments
│   ├── 07_events.sql              events, event_target_classes
│   ├── 08_homework.sql            homework, homework_attachments, homework_completions
│   ├── 09_assignments_grading.sql assignments, submissions, ai_reviews (+ attachments)
│   ├── 10_messaging.sql           conversations, conversation_participants, messages
│   ├── 11_whatsapp_notifications.sql  whatsapp_notification_settings, sent_log, delivery_log, optouts
│   ├── 12_ai_study_materials.sql  ai_study_materials (transcript → notes pipeline)
│   ├── 13_ai_tutor.sql            ai_tutors, chapters, documents, chat, vector_chunks, infographics
│   ├── 14_video_conferencing.sql  meetings, recordings, emotion_logs, analytics
│   ├── 15_consent_management.sql  consent_records, consent_audit_logs
│   └── 16_whatsapp_webhook.sql    whatsapp_delivery_log, whatsapp_optouts
│
└── seeds/                 ← Demo data (run after migrations)
    ├── 01_roles.sql           admin, teacher, student, parent
    ├── 02_users.sql           4 demo accounts (password: 12345)
    ├── 03_academics.sql       9 subjects + 10 classes
    ├── 04_timetable.sql       class↔subject mappings, teacher assignments, timetable slots
    ├── 05_locations.sql       15 sample locations (classrooms, labs, halls)
    └── 06_parent_student.sql  student profile + parent↔student link
```

## Dependency Chain

```
01_users_admin → 02_academics → 03_profiles → 04_timetable → 05_attendance
                                             → 06_fees
                 02_academics → 07_events

08_homework → 09_assignments_grading
10_messaging → 11_whatsapp_notifications → 16_whatsapp_webhook
12_ai_study_materials → 13_ai_tutor
14_video_conferencing
15_consent_management
```

Seeds run after all migrations: `01 → 02 → 03 → 04 → 05 → 06`

## Fresh Install

**Option A — MySQL Workbench:**
1. File > Open SQL Script > `database/RUN_ALL.sql`
2. Execute All (⚡)
3. Open `database/VERIFY.sql` and run to confirm.

**Option B — CLI:**
```bash
mysql -u root -p < database/RUN_ALL.sql
mysql -u root -p connected_app < database/VERIFY.sql
```

**Option C — manage_db.py:**
```bash
python database/manage_db.py --setup
python database/manage_db.py --verify
```
Reads credentials automatically from `backend/.env`.

## Incremental Updates

To apply a single migration to an existing database, open the relevant file and run it directly. All scripts use `CREATE TABLE IF NOT EXISTS`, so re-running is safe.

## Adding Future Migrations

1. Create `migrations/17_your_feature.sql`
2. Start with `USE connected_app;`
3. Use `CREATE TABLE IF NOT EXISTS` throughout
4. Add a `SOURCE` line in `RUN_ALL.sql`

## Demo Credentials

All 4 demo users share password **`12345`** (bcrypt cost 12).

| Email | Role |
|---|---|
| yuktae@admin.connected.com | admin |
| emmaak@teacher.connected.com | teacher |
| renveerr@student.connected.com | student |
| oormilae@parent.connected.com | parent |

