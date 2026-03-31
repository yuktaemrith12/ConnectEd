# Recording → Transcript → Emotion Detection Pipeline

## Overview

When a teacher ends a class session, ConnectEd automatically runs a 4-step AI pipeline on the recorded video. The output feeds the teacher's Session Reports page, the student's Class Recordings page, and the AI Tutor's knowledge base.

```
LiveKit Room Ends
      │
      ▼
POST /api/v1/video/webhook  (EGRESS_ENDED event)
      │
      ▼
BackgroundTasks → process_recording()
      │
      ├── Step 1: Transcription     (OpenAI Whisper)
      ├── Step 2: Emotion Analysis  (YOLO model, per-second frames)
      ├── Step 3: AI Analytics      (Claude Opus 4.6)
      └── Step 4: RAG Ingestion     (ChromaDB via AI Tutor)
```

Each step is **fault-tolerant** — a failure is logged as a warning but does not abort subsequent steps.

---

## Step 1 — Transcription

**Service:** `backend/app/services/ai/transcription_service.py`
**Called by:** `recording_processor._transcribe()`

### What it does

1. Checks if the MP4 file exceeds the Whisper API's 25 MB limit.
2. If it does, `imageio-ffmpeg` extracts the audio track as a **16 kHz mono WAV** using the bundled ffmpeg binary (no system ffmpeg required).
3. Sends the audio file to **OpenAI Whisper (`whisper-1`)** for synchronous transcription.
4. Returns the plain-text transcript string.

### Language support (interactive T2N flow only)

The recording pipeline always uses Whisper (English). The interactive Transcript-to-Notes flow supports three language modes:

| Mode | Models used | Notes |
|------|-------------|-------|
| `en` | OpenAI Whisper | Default |
| `fr` | OpenAI Whisper | French language hint |
| `mfe_fusion` | Meta MMS + Whisper + GPT-4o | Mauritian Creole hybrid fusion |

#### Creole Hybrid Fusion (`mfe_fusion`)
- **Meta MMS (`facebook/mms-1b-all`)** handles Creole phonetics and grammar.
- **OpenAI Whisper** handles English/French loanwords.
- **GPT-4o** fuses both outputs into a single correct transcript.
- MMS is pre-warmed at server startup to eliminate first-request cold start (~2 GB model).
- Audio is chunked into **30-second segments** processed in parallel via a `ThreadPoolExecutor` (max 4 workers). This exploits O(n²) attention scaling — 120× shorter chunks = dramatically faster inference.
- A progress callback writes partial text to the DB in real time so students see live output.

### Output
The transcript is stored in two places:
- `meeting_analytics.report_json["transcript"]` — full text
- `meeting_analytics.report_json["transcript_snippet"]` — first 400 characters (legacy fallback)
- `meeting_recordings.has_transcript = True`

---

## Step 2 — Emotion Detection

**Service:** `backend/app/services/ai/emotion_service.py`
**Called by:** `recording_processor._generate_ai_report()` → `analyze_video_emotions()`

### What it does

1. **Loads** the YOLO model lazily (once per process) from `emotion_det_model/best.pt`.
2. Opens the MP4 file with **OpenCV** (`cv2.VideoCapture`).
3. Samples **1 frame per second** (based on the video's actual FPS).
4. Runs YOLO inference on each sampled frame.
5. For each detected bounding box, records the emotion class and confidence score.
6. Saves each detection as a `MeetingEmotionLog` row in the database.

### Detected emotion classes

| Index | Label |
|-------|-------|
| 0 | `engagement` |
| 1 | `confusion` |
| 2 | `boredom` |
| 3 | `frustration` |
| 4 | `understanding` |

> **Note:** `student_id` is set to `0` in all logs — the classroom camera sees multiple students and cannot identify individuals.

### Prerequisites

```bash
pip install ultralytics opencv-python-headless
# Place trained model:
<project_root>/emotion_det_model/best.pt
```

If the model file is missing or `ultralytics` is not installed, the step is **silently skipped** — the rest of the pipeline continues normally.

### Output
- `meeting_emotion_logs` rows (one per detection, per second sampled)
- `meeting_recordings.has_analytics = True`
- Aggregated summary dict: `{ "confusion": 34.2, "engagement": 51.1, ... }` (% of frames)

### Timeline bucketing (for analytics charts)

`get_emotion_timeline()` aggregates raw logs into **10-second windows**, returning:
```json
[
  { "timestamp_s": 0, "engagement": 3, "confusion": 1, "boredom": 0, ... },
  { "timestamp_s": 10, "engagement": 5, "confusion": 2, ... }
]
```
This powers the RecordingPlayer emotion chart on the teacher dashboard.

---

## Step 3 — AI Analytics Report

**Service:** `recording_processor._generate_ai_report()`
**Model:** Claude Opus 4.6 (`claude-opus-4-6`)

### What it does

Sends the transcript (first 2000 chars) and emotion percentage breakdown to Claude with a structured prompt requesting a JSON response.

### Prompt structure

```
You are an educational analytics AI. Analyze this class session data.

Emotion breakdown (% of detected frames): confusion: 34.2%, engagement: 51.1%, ...

Transcript excerpt (first 2000 chars):
...

Return ONLY a JSON object with these exact keys:
- "confusion_peaks": list of {"topic": str, "description": str}
- "ai_suggestions": list of strings
- "engagement_score": integer 0-100
- "summary": one-paragraph string
```

### Claude response parsing

- Markdown code fences (` ```json ... ``` `) are stripped before JSON parsing.
- If Claude returns an empty response, a `ValueError` is raised and caught.
- Parsed fields are merged into the base `report_json` dict alongside `transcript`, `transcript_snippet`, and `emotion_summary`.

### Output — `meeting_analytics.report_json` shape

```json
{
  "meeting_id": 42,
  "emotion_summary": { "engagement": 51.1, "confusion": 34.2 },
  "confusion_peaks": [
    { "topic": "Quadratic equations", "description": "High confusion when introducing the discriminant" }
  ],
  "ai_suggestions": [
    "Pause and check understanding before moving past the discriminant formula.",
    "Use visual diagrams to illustrate parabola orientation."
  ],
  "engagement_score": 67,
  "summary": "The class was generally engaged during the introduction but showed significant confusion during the discriminant section...",
  "transcript": "<full transcript text>",
  "transcript_snippet": "<first 400 chars>"
}
```

### Teacher dashboard display

The Session Reports page (`frontend/src/app/pages/teacher/SessionReports.tsx`) reads this JSON and displays:
- Engagement score gauge
- Confusion peaks list
- AI suggestions list
- Emotion breakdown bar chart

---

## Step 4 — RAG Ingestion

**Service:** `recording_processor._ingest_to_rag()`
**Details:** See `ai_features/AI_TUTOR_RAG_SYSTEM.md`

### What it does

1. Looks up the `AiTutor` for the meeting's class + subject combination.
2. Creates an `AiTutorTranscript` row with status `approved` (auto-approved, no teacher review needed for session transcripts).
3. Calls `ingest_transcript()` which chunks the text, generates embeddings, and stores them in ChromaDB.

The AI Tutor can now answer student questions based on what was actually taught in that specific class session.

> If no AI Tutor exists for the class/subject pair, this step is skipped with a log message.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `meetings` | Session metadata (teacher, class, subject, status, room name) |
| `meeting_recordings` | File path, duration, `has_transcript`, `has_analytics` flags |
| `meeting_emotion_logs` | One row per emotion detection (timestamp, emotion, confidence) |
| `meeting_analytics` | One row per meeting, stores the full `report_json` blob |

Migration file: `database/migrations/21_video_conferencing.sql`

---

## Transcript Retrieval — 3-Layer Fallback

**Endpoint:** `GET /api/v1/video/meetings/{id}/transcript`

Used by the student Class Recordings page to display the session transcript.

```
Layer 1: meeting_analytics.report_json["transcript"]
         → Set by new pipeline runs (post this implementation)

Layer 2: ai_tutor_transcripts.approved_transcript / raw_transcript
         → Set by RAG ingestion (covers all historical meetings)

Layer 3: meeting_analytics.report_json["transcript_snippet"]
         → 400-char partial (last resort, partial: true flag returned)
```

This ensures backward compatibility — meetings processed before the full transcript was stored in `report_json` can still display their transcript via the RAG table.

---

## LiveKit Integration

**Service:** `backend/app/services/video/livekit_service.py`

### Session lifecycle

```
Teacher clicks "Start Class"
  → POST /api/v1/video/meetings
  → LiveKit room created (generate_room_name)
  → Egress recording started (start_egress_recording_async)
  → meeting.status = active

Students join
  → GET /api/v1/video/meetings/{id}/join
  → Subscriber JWT token returned (3-hour TTL)

Teacher clicks "End Class"
  → POST /api/v1/video/meetings/{id}/end
  → LiveKit room deleted (delete_room)
  → Egress stops → EGRESS_ENDED webhook fires

POST /api/v1/video/webhook (EGRESS_ENDED)
  → meeting.status = completed
  → MeetingRecording row created (storage_path, duration_s)
  → BackgroundTasks.add_task(process_recording, ...)
```

### Token types

| Role | Token grants |
|------|-------------|
| Teacher | `can_publish`, `can_subscribe`, `can_publish_data`, `room_admin` |
| Student / Parent | `can_publish`, `can_subscribe`, `can_publish_data` |

Stub tokens (`stub:identity:room`) are returned when `livekit-api` is not installed. The frontend `VideoConference.tsx` treats stub tokens as "LiveKit not configured" and shows a setup message.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIVEKIT_URL` | `ws://localhost:7880` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | `devkey` | LiveKit API key |
| `LIVEKIT_API_SECRET` | `secret` | LiveKit API secret |
| `LIVEKIT_RECORDING_DIR` | `/tmp/recordings` | Host path where MP4 files are written |
| `OPENAI_API_KEY` | *(required)* | Used by Whisper transcription |
| `ANTHROPIC_API_KEY` | *(required)* | Used by Claude analytics report |

---

## Setup Checklist

```bash
# 1. Install Python dependencies
pip install livekit-api livekit-protocol
pip install ultralytics opencv-python-headless
pip install imageio-ffmpeg

# 2. Start LiveKit server (Docker)
docker run -d -p 7880:7880 livekit/livekit-server --dev

# 3. Start LiveKit Egress service (for recording)
# See LiveKit Egress docs for your platform

# 4. Place emotion detection model
# Download or train best.pt → <project_root>/emotion_det_model/best.pt

# 5. Set environment variables
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_RECORDING_DIR=/path/to/recordings
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Key Source Files

| File | Role |
|------|------|
| `backend/app/api/video.py` | REST endpoints, webhook handler |
| `backend/app/services/video/livekit_service.py` | Token generation, room/egress management |
| `backend/app/services/video/recording_processor.py` | Pipeline orchestrator |
| `backend/app/services/ai/transcription_service.py` | Whisper + MMS + Fusion transcription |
| `backend/app/services/ai/emotion_service.py` | YOLO frame analysis |
| `backend/app/models/extensions.py` | ORM models (Meeting, MeetingRecording, MeetingEmotionLog, MeetingAnalytics) |
| `database/migrations/21_video_conferencing.sql` | DB schema |
| `frontend/src/app/pages/teacher/SessionReports.tsx` | Teacher analytics UI |
| `frontend/src/app/pages/student/ClassRecordings.tsx` | Student recordings + transcript UI |
