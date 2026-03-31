# WhatsApp Notification System — ConnectEd

## Overview

ConnectEd sends real-time WhatsApp notifications to **parents and students** via the **Meta WhatsApp Cloud API (v22.0)**. Users connect their WhatsApp number through the app and choose which notifications to receive. The system uses a **3-tier dispatch pattern**: approved Message Templates (production) → interactive CTA messages (dev fallback) → plain text (last resort).

### Architecture

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Frontend   │────▶│   FastAPI Backend     │────▶│  Meta Cloud API     │
│  (React/TS)  │     │  /api/v1/whatsapp/*   │     │  graph.facebook.com │
└──────────────┘     └──────────┬───────────┘     └──────────┬──────────┘
                               │                            │
                               │  ◀── Webhook ──────────────┘
                               │  (delivery receipts, opt-outs)
                               ▼
                     ┌──────────────────────┐
                     │   MySQL Database     │
                     │  4 WhatsApp tables   │
                     └──────────────────────┘
```

---

## Notification Types

| Toggle | Trigger | Backend Function | Template Name |
|---|---|---|---|
| Attendance | Student marked absent/late | `notify_attendance()` | `connected_attendance_alert` |
| Grades Released | Teacher publishes a grade | `notify_grade_published()` | `connected_grade_released` |
| New Assignments | Teacher posts assignment | `notify_assignment_published()` | `connected_assignment_published` |
| Events & Exams | Admin publishes event/exam | `notify_event_published()` | `connected_event_scheduled` |
| Messages (parent) | Teacher → parent message | `notify_unread_message()` | `connected_message_alert` |
| Messages (student) | Teacher → student message | `notify_student_unread_message()` | `connected_message_alert` |
| Due Reminders | Assignment due within 24h | `notify_assignment_due_reminder()` | `connected_due_reminder` |

All dispatches use **FastAPI BackgroundTasks** for async, non-blocking delivery. Each includes deduplication via `whatsapp_sent_log` to prevent duplicate messages.

---

## Database Schema (MySQL/InnoDB)

| Table | Migration | Purpose |
|---|---|---|
| `whatsapp_notification_settings` | `15_whatsapp_notifications.sql` | Per-user phone number, connection status, 7 notification toggles. Supports both `parent_user_id` and `student_user_id` |
| `whatsapp_sent_log` | `15_whatsapp_notifications.sql` | Deduplication — composite `event_key` strings prevent duplicate sends (e.g. `attendance:session_record:42:parent:7`) |
| `whatsapp_delivery_log` | `23_whatsapp_webhook.sql` | Delivery receipts from Meta status webhooks: `sent → delivered → read → failed`, with error codes |
| `whatsapp_optouts` | `23_whatsapp_webhook.sql` | GDPR-compliant opt-out registry — phone numbers that replied STOP/UNSUBSCRIBE/CANCEL/OPTOUT |

---

## Key Files

| File | Purpose |
|---|---|
| `backend/app/api/whatsapp.py` | 7 notify functions, settings endpoints, webhook handlers, health check, due reminder trigger (835 lines) |
| `backend/app/services/whatsapp_service.py` | `send()`, `send_interactive()`, `send_template()`, `dispatch()`, `_is_opted_out()` (243 lines) |
| `backend/app/models/extensions.py` | `WhatsAppNotificationSetting`, `WhatsAppSentLog`, `WhatsAppDeliveryLog`, `WhatsAppOptout` models |
| `backend/app/schemas/extensions.py` | `WhatsAppSettings`, `WhatsAppSettingsUpdate`, `WhatsAppDeliveryLogRead` schemas |
| `backend/app/core/config.py` | Config variables for WhatsApp |
| `backend/.env` | API credentials and feature flags |
| `frontend/src/app/pages/parent/WhatsAppNotifications.tsx` | Parent settings UI (453 lines) |
| `frontend/src/app/pages/student/WhatsAppNotifications.tsx` | Student settings UI (452 lines) |
| `database/migrations/15_whatsapp_notifications.sql` | Settings + sent log tables |
| `database/migrations/23_whatsapp_webhook.sql` | Delivery log + opt-out tables |

---

## API Endpoints

### Settings (auth: `parent` or `student`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/whatsapp/settings` | Fetch current notification preferences |
| `PATCH` | `/api/v1/whatsapp/settings` | Update phone number / toggle notifications (E.164 validation) |
| `POST` | `/api/v1/whatsapp/disconnect` | Remove phone number and mark disconnected |

### Webhook (public, no auth — required by Meta)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/whatsapp/webhook` | Hub challenge verification (Meta ownership validation) |
| `POST` | `/api/v1/whatsapp/webhook` | Handles delivery receipts, inbound opt-out messages, error callbacks |

### Admin
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/whatsapp/health` | Validates token + phone ID against Meta API, returns `use_templates` flag |
| `POST` | `/api/v1/whatsapp/trigger-due-reminders` | Scans assignments due within 24h and fires reminders |

---

## Message Template Dispatch Flow

```
dispatch() called
    │
    ├── Is phone opted out? → YES → skip, log, return False
    │
    ├── WHATSAPP_USE_TEMPLATES=true AND template_name provided?
    │   └── YES → send_template() via Meta API ("type": "template")
    │              with body_params ({{1}}, {{2}}...) and optional CTA URL button
    │              └── Success? → return True
    │
    ├── FRONTEND_URL set?
    │   └── YES → send_interactive() ("type": "interactive/cta_url")
    │              with tappable button linking to the portal
    │              └── Success? → return True
    │
    └── send() ("type": "text") → plain fallback
```

### 6 Approved Templates

| Template Name | Variables | Button |
|---|---|---|
| `connected_attendance_alert` | `{{1}}` student name, `{{2}}` status, `{{3}}` subject, `{{4}}` date | View Attendance |
| `connected_grade_released` | `{{1}}` student name, `{{2}}` assignment, `{{3}}` subject, `{{4}}` score | View Grade |
| `connected_assignment_published` | `{{1}}` title, `{{2}}` subject, `{{3}}` due date | View Assignment |
| `connected_event_scheduled` | `{{1}}` type, `{{2}}` title, `{{3}}` date | View Event |
| `connected_message_alert` | `{{1}}` sender name | Open Messages |
| `connected_due_reminder` | `{{1}}` title, `{{2}}` subject, `{{3}}` hours remaining | View Assignment |

All templates use **Utility** category, **English** language, and a **dynamic CTA URL button** pointing to the ConnectEd portal.

---

## Webhook System

The webhook endpoint (`POST /api/v1/whatsapp/webhook`) handles:

1. **Delivery Receipts** — Meta sends status updates (`sent → delivered → read → failed`) for each message. Logged to `whatsapp_delivery_log` with error codes on failure.

2. **Opt-Out Processing** — When a user replies **STOP**, **UNSUBSCRIBE**, **CANCEL**, or **OPTOUT**:
   - Phone is added to `whatsapp_optouts` table
   - Matching `whatsapp_notification_settings` row is set to `is_connected = false`
   - All future sends are blocked by `_is_opted_out()` check in `dispatch()`

3. **Error Callbacks** — Message-level failures are captured in the delivery log.

---

## Infrastructure

| Component | Detail |
|---|---|
| **Tunnel** | ngrok static domain: `homothetic-kourtney-supportlessly.ngrok-free.dev` — auto-launched in `start_app.bat` |
| **Auth Token** | Permanent System User token (never-expiring) via Meta Business Manager |
| **Webhook** | Verified in Meta Dev Console, subscribed to `messages` field |
| **Meta App** | Business type app in Meta Developer Console with WhatsApp product |

---

## Environment Variables (`.env`)

```env
META_WHATSAPP_TOKEN=<permanent system user token>
META_PHONE_NUMBER_ID=<phone number ID from Meta Dev Console>
META_WEBHOOK_VERIFY_TOKEN=connected_whatsapp_webhook_secret
WHATSAPP_USE_TEMPLATES=false   # Set true after Meta approves templates
FRONTEND_URL=https://homothetic-kourtney-supportlessly.ngrok-free.dev
```

| Variable | Purpose |
|---|---|
| `META_WHATSAPP_TOKEN` | Permanent system user access token for Meta Cloud API |
| `META_PHONE_NUMBER_ID` | Phone number ID from Meta Developer Console |
| `META_WEBHOOK_VERIFY_TOKEN` | Arbitrary secret matching the webhook config in Meta Dev Console |
| `WHATSAPP_USE_TEMPLATES` | Feature flag — `false` for dev (free-form), `true` for production (templates) |
| `FRONTEND_URL` | Base URL for CTA button links in messages |

---

## Meta WhatsApp Cloud API Setup

### Step 1 — Create a Meta App

1. Go to **developers.facebook.com** → **My Apps** → **Create App**
2. Select **Business** type
3. Name it (e.g. *ConnectEd*)
4. Add the **WhatsApp** product to the app

### Step 2 — Add a Phone Number

You need a **real phone number** (SIM card or landline). VoIP numbers are rejected by Meta.

1. In the Developer Console go to **WhatsApp → Phone Numbers → Add phone number**
2. Fill in Business Name: *ConnectEd*, website, country
3. Enter the phone number in international format
4. Complete verification (SMS OTP or phone call)
5. Note the **Phone Number ID** — needed for `.env`

> **Test number**: Meta provides a free test number (`+1 555 153 9547`) for development. It can only send to numbers manually added as test recipients in **API Setup → Test recipients**.

### Step 3 — Create a Permanent System User Token

1. Go to **business.facebook.com** → **Settings** → **Users** → **System Users**
2. Click **Add** → Name: *ConnectEd Bot*, Role: *Admin*
3. Click **Add Assets** → **Apps** → select ConnectEd → set to **Administrator**
4. Click **Generate New Token** → select ConnectEd → set expiry to **Never** → check:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Click **Generate Token** — **copy immediately**, shown only once

### Step 4 — Configure Webhook

1. In Meta Developer Console → **WhatsApp → Configuration**
2. Set **Callback URL**: `https://homothetic-kourtney-supportlessly.ngrok-free.dev/api/v1/whatsapp/webhook`
3. Set **Verify Token**: `connected_whatsapp_webhook_secret` (must match `.env`)
4. Click **Verify and Save**
5. Under **Webhook Fields**, enable: `messages`

### Step 5 — Submit Message Templates

1. Go to **business.facebook.com** → **WhatsApp Manager** → **Message Templates** → **Create**
2. Submit all 6 templates (see template table above)
3. Wait 24–48 hours for Meta approval

### Step 6 — Go Live

1. Set `WHATSAPP_USE_TEMPLATES=true` in `.env`
2. Restart the backend
3. Verify: `GET /api/v1/whatsapp/health` → `{ "status": "ok", "use_templates": true }`

---

## User Connection Flow

### For Parents
1. Log in → go to **WhatsApp Alerts** in sidebar
2. Click **Connect WhatsApp**
3. Enter WhatsApp number in **E.164 format** (e.g. `+23059853328`)
4. Toggle individual notification types on/off

### For Students
1. Log in → go to **WhatsApp Alerts** in sidebar
2. Same flow as parents — connects directly to the student's own WhatsApp

---

## Troubleshooting

### `401 Unauthorized` — Token expired or invalid

```
WhatsApp send failed — 401: {"error":{"type":"OAuthException",...}}
```

**Fix**: Regenerate system user token in **business.facebook.com → Settings → System Users → ConnectEd Bot → Generate New Token**. Update `META_WHATSAPP_TOKEN` in `.env`. Restart backend.

### `400` — Object does not exist / missing permissions

**Causes:**
- **Phone not verified** → Complete OTP in Developer Console → WhatsApp → Phone Numbers
- **System user missing asset** → Add phone number asset to system user, regenerate token
- **Wrong Phone Number ID** → Copy correct ID from Developer Console, update `.env`

### `131026` — Template not approved or not found

Messages fail silently because templates are in "Pending" status.

**Fix**: Wait for Meta approval (24–48h). Check status in WhatsApp Manager → Message Templates. Ensure `WHATSAPP_USE_TEMPLATES=false` until approved.

### Notifications not being sent (no error)

1. **User not connected** → `is_connected` is `False` in `whatsapp_notification_settings`
2. **Toggle disabled** → The specific notification type is toggled off
3. **Opted out** → Phone is in `whatsapp_optouts` table (user replied STOP)
4. **Stale dedup entry** → Clear: `DELETE FROM whatsapp_sent_log WHERE event_key LIKE 'msg:unread:%';`
5. **Test number not whitelisted** → Add recipient in Developer Console → API Setup → Test recipients

### Messages notification fires once then stops

Expected behaviour. One notification per unread period. When the user reads the conversation, the dedup entry is cleared and they'll be notified for the next message.

### Switching between test and real phone number

Update `META_PHONE_NUMBER_ID` in `.env` and restart:

| Number | Phone Number ID |
|---|---|
| Test (+1 555 153 9547) | `1053154601211368` |
| Real Mauritius (+230 697 3320) | `1019674217900236` |
