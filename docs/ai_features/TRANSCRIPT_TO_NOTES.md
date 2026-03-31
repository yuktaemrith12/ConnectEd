# Transcript-to-Notes — AI Feature Documentation

Converts an audio or video recording into three outputs:
1. **Transcript** — raw text from the audio
2. **Study Notes** — structured Markdown notes (Title, Summary, Key Concepts, Vocabulary)
3. **Visual** — an educational infographic diagram generated from the most important concept

---

## Architecture Overview

```
Student uploads file
        │
        ▼
POST /api/v1/transcript-to-notes/upload
        │  returns job_id immediately (202 Accepted)
        │
        ▼
Background Pipeline (async, non-blocking)
        │
        ├─ Stage 1: Transcription
        │       en/fr  → OpenAI Whisper (whisper-1)
        │       Creole → MMS + Whisper + GPT-4o fusion
        │
        ├─ Stage 2: Notes Generation
        │       GPT-4o converts transcript → Markdown notes
        │
        └─ Stage 3: Illustration
                GPT-4o crafts a concept-specific image prompt
                → gpt-image-1 (primary)
                → DALL-E 3 (fallback)

Frontend polls GET /jobs/{job_id} every 3 seconds
until status = "completed" or "failed"
```

---

## API Reference

Base URL: `http://127.0.0.1:8000/api/v1/transcript-to-notes`

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

---

### POST `/upload`

Upload an audio/video file and start the AI pipeline.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | Audio/video file (see supported formats) |
| `language` | string | No | `"en"` (default), `"fr"`, `"mfe_fusion"` |

**Supported file formats:** `.mp3`, `.wav`, `.mp4`, `.m4a`, `.mov`, `.webm`, `.ogg`, `.flac`

**Max file size:** 100 MB

**Response** `202 Accepted`
```json
{
  "job_id": 12,
  "status": "processing"
}
```

**Example (curl):**
```bash
curl -X POST http://127.0.0.1:8000/api/v1/transcript-to-notes/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@lecture.mp3" \
  -F "language=en"
```

---

### GET `/jobs/{job_id}`

Poll for the current status and results of a job.

**Response fields:**

| Field | Type | Description |
|---|---|---|
| `job_id` | int | Unique job identifier |
| `status` | string | `"processing"` \| `"completed"` \| `"failed"` |
| `current_stage` | string | Active pipeline stage (see below) |
| `language` | string | Language used for this job |
| `source_reference` | string | Original filename |
| `transcript` | string\|null | Raw transcription text |
| `notes_markdown` | string\|null | Structured study notes (Markdown) |
| `illustration_url` | string\|null | `data:image/png;base64,...` or DALL-E URL |
| `error_message` | string\|null | Error detail if status = `"failed"` |
| `created_at` | string\|null | ISO 8601 timestamp |

**Pipeline stages** (shown in `current_stage`):

| Stage | Meaning |
|---|---|
| `queued` | Job created, pipeline not yet started |
| `transcribing` | Audio is being transcribed |
| `generating_notes` | GPT-4o is writing study notes |
| `creating_illustration` | Image is being generated |
| `completed` | All done |

**Example (curl):**
```bash
curl http://127.0.0.1:8000/api/v1/transcript-to-notes/jobs/12 \
  -H "Authorization: Bearer <token>"
```

---

### GET `/history`

Returns the 20 most recent jobs for the authenticated student.

**Response** — array of summary objects (no transcript/notes/image data):
```json
[
  {
    "job_id": 12,
    "status": "completed",
    "current_stage": "completed",
    "language": "en",
    "source_reference": "lecture.mp3",
    "created_at": "2026-03-07T17:30:00"
  }
]
```

---

## AI Models Used

| Stage | Model | Provider | Notes |
|---|---|---|---|
| Transcription (EN/FR) | `whisper-1` | OpenAI | Language hint passed for accuracy |
| Transcription (Creole) | `facebook/mms-1b-all` + `whisper-1` | Meta / OpenAI | Run in parallel, merged by GPT-4o |
| Creole fusion | `gpt-4o` | OpenAI | Merges MMS (Creole base) + Whisper (loanwords) |
| Study notes | `gpt-4o` | OpenAI | Structured Markdown output |
| Image prompt | `gpt-4o` | OpenAI | Extracts key concept and crafts specific diagram prompt |
| Image generation (primary) | `gpt-image-1` | OpenAI | 1536×1024 landscape, quality=high, returns base64 |
| Image generation (fallback) | `dall-e-3` | OpenAI | 1024×1024, returns URL |

---

## Language Modes

| Value | Label | Transcription | Notes Language |
|---|---|---|---|
| `en` | English | Whisper (en hint) | English |
| `fr` | French | Whisper (fr hint) | French |
| `mfe_fusion` | Creole | MMS + Whisper + GPT-4o | English (Creole/French terms in Vocabulary) |

> **Note:** Creole mode (`mfe_fusion`) downloads the ~2 GB `facebook/mms-1b-all` model on first use. Subsequent requests use the cached model.

---

## Environment Variables

Add these to `backend/.env`:

```env
OPENAI_API_KEY=sk-proj-...      # Required — Whisper, GPT-4o, gpt-image-1, DALL-E 3
GOOGLE_GENAI_API_KEY=...        # Optional — reserved for future Imagen integration
```

These map to `Settings.OPENAI_API_KEY` and `Settings.GOOGLE_GENAI_API_KEY` in `backend/app/core/config.py`.

---

## Database

**Table:** `ai_study_materials`

**Migration file:** `database/migrations/17_ai_study_materials.sql`

Run this migration in MySQL Workbench before first use:
```sql
SOURCE database/migrations/17_ai_study_materials.sql;
```

**Schema summary:**

| Column | Type | Description |
|---|---|---|
| `id` | INT PK | Auto-increment job ID |
| `student_id` | INT FK | References `users.id` (CASCADE delete) |
| `source_type` | ENUM | `'upload'` (class recordings planned) |
| `source_reference` | VARCHAR(500) | Original filename |
| `language` | VARCHAR(20) | Language code used |
| `status` | ENUM | `processing` \| `completed` \| `failed` |
| `current_stage` | VARCHAR(50) | Active pipeline stage |
| `transcript` | LONGTEXT | Raw transcription |
| `notes_markdown` | LONGTEXT | Markdown study notes |
| `illustration_url` | LONGTEXT | Base64 data URI or image URL |
| `error_message` | TEXT | Error detail on failure |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

## File Structure

```
backend/
├── app/
│   ├── api/
│   │   └── transcript_to_notes.py     ← API endpoints + background pipeline
│   ├── services/
│   │   └── ai/
│   │       ├── __init__.py
│   │       ├── transcription_service.py   ← Whisper, MMS, fusion logic
│   │       ├── notes_generator_service.py ← GPT-4o notes generation
│   │       └── illustration_service.py    ← gpt-image-1 / DALL-E 3
│   └── models/
│       └── extensions.py              ← AIStudyMaterial ORM model
├── .env                               ← OPENAI_API_KEY lives here
└── requirements.txt                   ← openai, transformers, torch, librosa

frontend/
└── src/app/
    ├── pages/student/
    │   └── TranscriptToNotes.tsx      ← Student UI with polling
    └── utils/
        └── api.ts                     ← t2nUpload, t2nGetJob, t2nGetHistory
```

---

## Running the Feature

### 1. Install dependencies

```bash
cd backend
venv/Scripts/pip install -r requirements.txt
```

> On first Creole request, `facebook/mms-1b-all` (~2 GB) will be downloaded automatically from Hugging Face.

### 2. Run the database migration

Open MySQL Workbench and run:
```
database/migrations/17_ai_study_materials.sql
```

### 3. Start the backend

```bash
cd backend
venv/Scripts/uvicorn app.main:app --reload --port 8000
```

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

### 5. Navigate to the feature

Log in as a student and go to:
```
http://localhost:5173/student/transcript-to-notes
```

---

## How the Frontend Works

1. Student selects a language (English / French / Creole)
2. Drag-and-drop or file picker to select audio/video
3. `POST /upload` is called → returns `job_id`
4. Frontend polls `GET /jobs/{job_id}` every **3 seconds**
5. Progress bar advances through the 3 pipeline stages
6. On completion, three tabs are shown:
   - **Study Notes** — rendered Markdown (bold, italic, headings, bullets)
   - **Transcript** — raw text
   - **Visual** — generated infographic image
7. Past jobs are shown in a **History** panel on the right

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Unsupported file type | `400` — rejected at upload |
| File > 100 MB | `400` — rejected at upload |
| Transcription fails | Job marked `failed`, `error_message` populated |
| Illustration fails | Non-fatal — notes still saved, `illustration_url` is `null` |
| `gpt-image-1` fails | Auto-falls back to DALL-E 3 |
| Job not found / wrong user | `404` |
