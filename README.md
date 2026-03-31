<div align="center">

# ConnectEd
### An AI-Augmented School Management Platform

*Bridging the gap between classroom learning and intelligent technology*

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.5-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-orange)](https://livekit.io/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8s-Emotion_Detection-purple)](https://ultralytics.com/)
[![Tests](https://img.shields.io/badge/Tests-98.3%25_Pass_Rate-brightgreen)](tests/reports/EVALUATION_REPORT.md)

</div>

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [System Architecture](#3-system-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Technology Stack](#5-technology-stack)
6. [AI Subsystems](#6-ai-subsystems)
7. [Role-Based Portals](#7-role-based-portals)
8. [Database Schema](#8-database-schema)
9. [Getting Started](#9-getting-started)
10. [Running the Test Suite](#10-running-the-test-suite)
11. [Evaluation Results](#11-evaluation-results)
12. [Configuration Reference](#12-configuration-reference)

---

## 1. Project Overview

**ConnectEd** is a full-stack, AI-augmented school management system designed for the Mauritian educational context. It provides a unified digital environment for administrators, teachers, students, and parents, combining traditional school management capabilities with cutting-edge AI features including:

- A **Retrieval-Augmented Generation (RAG) AI Tutor** that answers curriculum-specific questions while refusing to hallucinate
- A **Hybrid Speech-to-Notes pipeline** achieving **7.63% WER** on Mauritian Creole — a 91.9% improvement over the Whisper baseline
- Real-time **YOLOv8s Emotion Detection** that analyses student engagement during live classes
- A **WhatsApp Business API** notification layer for parents
- Live **WebRTC video conferencing** with session recording, powered by LiveKit

The platform is built as a dissertation project, with a rigorous evaluation suite achieving an overall **98.3% test pass rate** (172/175 tests).

---

## 2. Key Features

### Core School Management
| Feature | Description |
|---|---|
| **User Management** | Four-role system (Admin, Teacher, Student, Parent) with JWT-based RBAC |
| **Timetable Builder** | Drag-and-drop schedule management with automatic conflict detection |
| **Attendance Tracking** | Per-session attendance with real-time teacher input |
| **Homework & Assignments** | Create, publish, submit, and AI-grade assignments |
| **Fee Management** | Fee plans, payment tracking, and instalment schedules |
| **Messaging** | In-platform secure messaging with RBAC-enforced contact lists |
| **Event Calendar** | School-wide event management with class targeting |
| **WhatsApp Notifications** | Parent/student notifications via Meta WhatsApp Business API |
| **Consent Management** | GDPR-compliant consent tracking with audit logs |

### AI-Powered Features
| Feature | Technology | Key Metric |
|---|---|---|
| **AI Tutor (RAG)** | ChromaDB + OpenAI GPT-4o-mini | Hit Rate@3: 92.3%, Hallucination Refusal: 100% |
| **Transcript-to-Notes** | Hybrid MMS + Whisper + GPT-4o fusion | WER: 7.63% on Mauritian Creole |
| **Emotion Detection** | YOLOv8s fine-tuned model | 3 classes: Engaged / Confused / Disengaged |
| **AI Assignment Grading** | Claude (Anthropic) | Structured rubric-based feedback |
| **AI Study Infographics** | Google Gemini | Visual summaries from uploaded documents |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Browser)                      │
│   React 18 + TypeScript + Vite · Role-based SPA (4 Portals)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST / HTTP
┌──────────────────────────▼──────────────────────────────────────┐
│               BACKEND API  (FastAPI / Uvicorn)                  │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │   Auth +   │  │   Core     │  │  AI        │  │  Video   │  │
│  │   RBAC     │  │ Management │  │ Services   │  │LiveKit   │  │
│  │   (JWT)    │  │(Admin/Teach│  │ (RAG/TTS/  │  │ Egress   │  │
│  │            │  │ /Student/  │  │ Emotion)   │  │Recording)│  │
│  │            │  │ Parent)    │  │            │  │          │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
│                           │                                      │
│              SQLAlchemy ORM (async-compatible)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                  │
┌─────────▼──────────┐          ┌────────────▼───────────┐
│  MySQL 8.x Database│          │  ChromaDB (Vector Store)│
│  (connected_app)   │          │  (AI Tutor Embeddings)  │
│  16 Migration Files│          │  text-embedding-3-small │
└────────────────────┘          └────────────────────────┘

External Services: Meta WhatsApp Cloud API · Anthropic Claude
                   OpenAI GPT-4o / text-embedding · Google Gemini
                   LiveKit Cloud · ngrok (webhook tunnelling)
```

### Video Conferencing Stack

```
Browser (Teacher/Student)
        │  WebRTC (SFU)
        ▼
  LiveKit Server ──── Redis (signalling)
        │
        └──── Egress Recorder ──── backend/uploads/recordings/
```

---

## 4. Repository Structure

```
ConnectEd/
│
├── backend/                        # Python / FastAPI API server
│   ├── app/
│   │   ├── api/                    # Route handlers (16 modules)
│   │   │   ├── admin.py            # Admin CRUD (users, classes, timetable, fees...)
│   │   │   ├── admin_extensions.py # Extended admin (events, locations, attendance...)
│   │   │   ├── ai_tutor.py         # RAG AI Tutor endpoints
│   │   │   ├── assignments.py      # Assignment lifecycle + AI grading
│   │   │   ├── auth.py             # Login / token endpoints
│   │   │   ├── consent.py          # GDPR consent management
│   │   │   ├── homework.py         # Homework CRUD
│   │   │   ├── messages.py         # In-platform secure messaging
│   │   │   ├── teachers.py         # Teacher portal endpoints
│   │   │   ├── students.py         # Student portal endpoints
│   │   │   ├── parents.py          # Parent portal endpoints
│   │   │   ├── transcript_to_notes.py  # Hybrid ASR pipeline
│   │   │   ├── video.py            # LiveKit meeting management
│   │   │   └── whatsapp.py         # WhatsApp webhook + notifications
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings (env-driven)
│   │   │   ├── database.py         # SQLAlchemy engine + session
│   │   │   └── security.py         # JWT + bcrypt helpers
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── ai/                 # Transcription, emotion, illustration services
│   │   │   ├── ai_tutor/           # RAG engine, vector index, document ingestion
│   │   │   ├── video/              # LiveKit token generation, recording lifecycle
│   │   │   ├── ai_grading.py       # Claude-powered assignment grading
│   │   │   ├── whatsapp_service.py # Meta Cloud API integration
│   │   │   └── timetable_service.py
│   │   └── main.py                 # FastAPI app factory + router registration
│   └── requirements.txt            # Python dependencies
│
├── frontend/                       # React 18 + TypeScript SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/
│   │   │   │   ├── admin/          # 10 admin pages
│   │   │   │   ├── teacher/        # 15 teacher pages
│   │   │   │   ├── student/        # 14 student pages
│   │   │   │   └── parent/         # 10 parent pages
│   │   │   ├── components/         # Shared UI components
│   │   │   ├── utils/              # API client, auth helpers
│   │   │   └── routes.ts           # React Router v7 route config
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── database/                       # MySQL schema and seed management
│   ├── migrations/                 # 16 ordered migration scripts
│   │   ├── 01_users_admin.sql      # Roles, users, audit logs
│   │   ├── 02_academics.sql        # Subjects, classes
│   │   ├── ...
│   │   └── 16_whatsapp_webhook.sql # WhatsApp incoming webhook log
│   ├── seeds/                      # Reference data (roles, users, subjects)
│   ├── RUN_ALL.sql                 # Master fresh-install script
│   ├── VERIFY.sql                  # Post-install smoke tests
│   ├── manage_db.py                # Python CLI for automated setup
│   └── README.md                   # Database-specific documentation
│
├── emotion_detection_model/        # YOLOv8s fine-tuned model artefacts
│   ├── best.pt                     # Trained model weights (~64 MB)
│   ├── data.yaml                   # Dataset config (3 classes: Engaged/Confused/Disengaged)
│   ├── scripts/                    # Training pipeline scripts
│   │   ├── train_model.py          # Main YOLOv8 training script
│   │   ├── augment_minority_classes.py
│   │   ├── generate_synthetic_faces.py
│   │   ├── evaluate_model.py
│   │   └── live_inference.py       # Standalone webcam demo
│   └── webapp/                     # Standalone Flask demo webapp
│
├── tests/                          # Pytest test suite
│   ├── conftest.py                 # Shared fixtures + seed credentials
│   ├── test_auth_security.py       # JWT, bcrypt, soft-delete tests
│   ├── test_rbac.py                # Cross-role access enforcement
│   ├── test_api_validation.py      # Input validation (Pydantic schemas)
│   ├── test_models.py              # ORM model unit tests
│   ├── test_functional.py          # End-to-end workflow tests (6 workflows)
│   ├── test_blackbox.py            # Security + edge-case black-box tests
│   ├── test_performance.py         # Response time benchmarks (12 endpoints)
│   ├── test_livekit_security.py    # JWT token integrity + RBAC (30 tests)
│   ├── rag_eval_suite.py           # RAG evaluation (golden dataset, LLM judge)
│   ├── eval_transcription_accuracy.py  # ASR accuracy (WER/CER computation)
│   └── reports/                    # Consolidated evaluation outputs
│       ├── EVALUATION_REPORT.md    # Master test results document
│       ├── perf_results.json       # Performance benchmark raw data
│       └── rag_eval_results.json   # RAG per-question results
│
├── docker-compose.yml              # LiveKit stack (Redis + LiveKit + Egress)
├── livekit.yaml                    # LiveKit server configuration
├── egress.yaml                     # LiveKit Egress recorder configuration
└── start_app.bat                   # One-click launcher (Windows)
```

---

## 5. Technology Stack

### Backend
| Component | Technology | Version |
|---|---|---|
| API Framework | FastAPI | 0.115.5 |
| ASGI Server | Uvicorn (with standard extras) | 0.32.1 |
| ORM | SQLAlchemy | 2.0.36 |
| Data Validation | Pydantic + pydantic-settings | 2.10.2 / 2.6.1 |
| Authentication | JWT (python-jose) + bcrypt (passlib) | 3.3.0 / 1.7.4 |
| Database Driver | PyMySQL | 1.1.1 |
| Document Parsing | PyMuPDF, python-docx, python-pptx | Latest |
| Vector Store | ChromaDB | ≥ 0.5.0 |
| Deep Learning | PyTorch (CPU build) | ≥ 2.0.0 |
| ASR | HuggingFace Transformers (MMS-1B) | ≥ 4.41.0 |
| Audio Processing | Librosa, SoundFile, torchaudio | Latest |
| Computer Vision | Ultralytics YOLOv8 | ≥ 8.0.0 |
| Video SDK | livekit-api | ≥ 0.7.0 |
| AI APIs | Anthropic Claude, OpenAI GPT-4o, Google Gemini | Latest |
| HTTP Client | Requests | ≥ 2.31.0 |

### Frontend
| Component | Technology | Version |
|---|---|---|
| UI Framework | React | 18.3.1 |
| Language | TypeScript | — |
| Build Tool | Vite | 6.3.5 |
| Package Manager | pnpm | — |
| Routing | React Router | v7 |
| UI Components | Radix UI + Material UI (MUI) | Latest |
| Rich Text Editor | Tiptap | v3 |
| Charts | Recharts | 2.15.2 |
| Animation | Motion (formerly Framer Motion) | 12.x |
| Video | livekit-client + @livekit/components-react | ^2.0 |
| Styling | Tailwind CSS v4 | 4.1.12 |

### Infrastructure
| Component | Technology |
|---|---|
| Database | MySQL 8.x |
| Video Conferencing | LiveKit (self-hosted via Docker) |
| Session Recording | LiveKit Egress (Chrome-based renderer) |
| Message Queue | Redis 7 (LiveKit signalling) |
| WhatsApp | Meta WhatsApp Business Cloud API |
| Webhook Tunnel | ngrok (development) |
| Containerisation | Docker Compose |

---

## 6. AI Subsystems

### 6.1 RAG AI Tutor

The AI Tutor uses Retrieval-Augmented Generation to answer curriculum-specific questions accurately while refusing to hallucinate answers about unknown topics.

**Architecture:**

```
Student Question
      │
      ▼
OpenAI text-embedding-3-small (1536-dim)
      │
      ▼
ChromaDB Vector Search (cosine distance, threshold < 1.4)
      │
      ▼
Top-K Relevant Chunks (from teacher-uploaded PDFs, DOCX, PPTX)
      │
      ▼
GPT-4o-mini (temperature=0.4) with mode-specific prompt
      │
      ▼
Structured Response (with confidence indicator)
```

**Evaluation Results (30-question golden dataset):**
- Hit Rate @ 3: **92.3%** (target: > 80% — ✅ PASS)
- Answer Relevance: **92.8%** (target: > 85% — ✅ PASS)
- Hallucination Refusal Rate: **100%** — all unanswerable questions correctly refused
- Semantic vs. TF-IDF baseline improvement: **+33.8 pp** on Context Precision

**Study Modes:** Explanation · Exam Practice · Deep Dive · Quick Summary

### 6.2 Hybrid Transcript-to-Notes (Mauritian Creole)

A two-stage ASR pipeline designed specifically for Mauritian Creole, a low-resource language:

```
MP4 Recording
      │  imageio-ffmpeg (bundled, no system dependency)
      ▼
WAV Audio (16kHz mono)
      │
      ├── MMS-1B (Meta) — low-resource language specialist
      │         WER: 16.03%
      │
      └── Whisper-Base (OpenAI) — English-anchored baseline
                WER: 93.89%
      │
      ▼
Hypothesis Fusion via GPT-4o (selects best candidate per segment)
      │
      ▼
Smart Notes Generation (Claude/GPT-4o) → Key Points + Summary

Hybrid WER: 7.63% (−91.9% vs Whisper baseline)
```

### 6.3 Emotion Detection (YOLOv8s)

A fine-tuned YOLOv8s object detection model that analyses facial expressions in video frames to infer student engagement during live classes.

**Dataset:** Roboflow facial emotion dataset (10 original classes → remapped to 3 educational classes)

| Class | Mapped From |
|---|---|
| **Engaged** | Happy, Thinking, Serious, Excited, Neutral |
| **Confused** | Worried, Fear |
| **Disengaged** | Disgust, Sad, Angry |

**Training Strategy:** Class imbalance mitigated using Mosaic augmentation, synthetic face generation, and minority-class oversampling. Model weights saved at `emotion_detection_model/best.pt`.

---

## 7. Role-Based Portals

The frontend implements a strict role-based SPA with four isolated portals. Authentication is enforced at the route loader level — wrong-role access redirects to `/unauthorized`.

### Admin Portal
- Dashboard (system-wide KPIs)
- User Management (create, edit, soft-delete users; assign roles)
- Class Setup (subjects, class groups)
- Timetable Builder
- Events Calendar
- Fees Overview (fee plans, payment tracking, installments)
- Attendance Overview
- Locations Management
- Consent Compliance (GDPR audit dashboard)

### Teacher Portal
- Dashboard (today's classes, pending tasks)
- Attendance (open/close sessions, mark students)
- Homework (create, publish, view submissions)
- Assignments (create, publish, AI-graded submissions)
- Grading (manual + AI-assisted rubric grading)
- Timetable (personal schedule view)
- Video Conference (start/join LiveKit room)
- Recordings (browse + play past sessions)
- AI Tutor Management (upload documents, configure knowledge base)
- AI Feedback (engagement analytics from emotion detection)
- Messages (student/parent secure messaging)
- Session Reports

### Student Portal
- Dashboard (today's schedule, upcoming deadlines)
- Timetable
- Homework (view, mark complete)
- Assignments (view, submit files/text)
- Grades (per-assignment and overall)
- Attendance (personal record)
- Class Recordings (watch past sessions)
- **AI Tutor** (RAG-powered curriculum Q&A)
- **Transcript-to-Notes** (upload recording → AI notes)
- Live Class (join LiveKit session)
- Messages
- WhatsApp Notifications (opt-in)
- Consent Management

### Parent Portal
- Dashboard (child overview, recent activity)
- Attendance (child's record)
- Grades (child's performance)
- Fees (view invoices and payment status)
- Events (school events)
- Assignments (child's submission status)
- Messages (contact teachers)
- WhatsApp Notifications
- Consent Management

---

## 8. Database Schema

The database is built through **16 ordered migration files** that define the full schema in dependency order:

| Migration | Domain |
|---|---|
| `01_users_admin.sql` | Roles, Users, Audit Logs |
| `02_academics.sql` | Subjects, Classes, Class↔Subject junction |
| `03_profiles.sql` | Student/Teacher profiles, Parent↔Student links |
| `04_timetable.sql` | Timetable entries |
| `05_attendance.sql` | Attendance sessions and records |
| `06_fees.sql` | Academic periods, fee plans, payments, instalments, notifications |
| `07_events.sql` | Events, Event↔Class targeting |
| `08_homework.sql` | Homework and submissions |
| `09_assignments_grading.sql` | Assignments, submissions, AI grading results |
| `10_messaging.sql` | Conversations and messages |
| `11_whatsapp_notifications.sql` | WhatsApp notification log |
| `12_ai_study_materials.sql` | AI Tutor document store |
| `13_ai_tutor.sql` | RAG sessions, messages, vector index metadata |
| `14_video_conferencing.sql` | Meetings, participants, recording metadata |
| `15_consent_management.sql` | Consent records, audit log |
| `16_whatsapp_webhook.sql` | Incoming WhatsApp message log |

---

## 9. Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.12+ |
| Node.js | 18+ |
| pnpm | 8+ |
| MySQL | 8.x |
| Docker Desktop | Latest (for video conferencing) |
| ngrok | Latest (for WhatsApp webhooks) |

---

### Step 1 — Clone the Repository

```bash
git clone <repository-url>
cd ConnectEd
```

---

### Step 2 — Database Setup

**Option A — Automated (recommended):**
```bash
cd database
python manage_db.py --setup
```

**Option B — Manual (MySQL Workbench or CLI):**
```sql
-- In MySQL Workbench: File > Open SQL Script > database/RUN_ALL.sql > Execute All
-- Or via CLI:
mysql -u root -p < database/RUN_ALL.sql
```

Verify the installation:
```bash
mysql -u root -p connected_app < database/VERIFY.sql
```

> **Seed accounts** (all use password `12345`):
> | Role | Email |
> |---|---|
> | Admin | `yuktae@admin.connected.com` |
> | Teacher | `emmaak@teacher.connected.com` |
> | Student | `renveerr@student.connected.com` |
> | Parent | `oormilae@parent.connected.com` |

---

### Step 3 — Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env with your database credentials and API keys
```

**Required `.env` keys:**

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=connected_app

# JWT
SECRET_KEY=your-secret-key

# AI APIs (optional — only needed for AI features)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENAI_API_KEY=AI...

# WhatsApp Business (optional)
META_WHATSAPP_TOKEN=...
META_PHONE_NUMBER_ID=...
META_WABA_ID=...
META_WEBHOOK_VERIFY_TOKEN=...
```

**Start the backend:**
```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Step 4 — Frontend Setup

```bash
cd frontend
pnpm install
pnpm run dev
```

Frontend available at: [http://localhost:5173](http://localhost:5173)

---

### Step 5 — Video Conferencing (Optional)

Video conferencing requires Docker Desktop to be running:

```bash
# Start LiveKit + Egress + Redis
docker compose up -d
```

---

### One-Click Launch (Windows)

Double-click `start_app.bat` to automatically start the backend, frontend, Docker stack, and ngrok tunnel simultaneously.

---

## 10. Running the Test Suite

All tests require a running MySQL instance with the seed data applied.

```bash
cd ConnectEd

# Run the full test suite
pytest tests/ -v

# Run individual suites
pytest tests/test_auth_security.py -v    # Authentication & JWT tests
pytest tests/test_rbac.py -v             # Role-based access control
pytest tests/test_api_validation.py -v   # Input validation
pytest tests/test_functional.py -v       # End-to-end workflows
pytest tests/test_blackbox.py -v         # Security & edge cases
pytest tests/test_performance.py -v      # Response time benchmarks
pytest tests/test_livekit_security.py -v # LiveKit JWT & RBAC

# AI evaluation suites (require API keys)
python tests/rag_eval_suite.py                   # RAG accuracy evaluation
python tests/eval_transcription_accuracy.py      # ASR WER/CER evaluation
```

---

## 11. Evaluation Results

Full results documented in [`tests/reports/EVALUATION_REPORT.md`](tests/reports/EVALUATION_REPORT.md).

### Overall Summary

| Test Suite | Tests | Pass Rate |
|---|---|---|
| Unit Tests (Auth, RBAC, Validation, Models) | 73 | **100%** |
| Functional Workflows (6 end-to-end scenarios) | 29 steps | **100%** |
| Black Box & Security | 20 | **90%** |
| Performance (< 500ms threshold) | 12 endpoints | **100%** |
| LiveKit Security & RBAC | 30 | **100%** |
| Transcription pytest assertions | 8 | **100%** |
| RAG Formal Criteria | 3 | **67%** *(faithfulness near-miss by 2.7 pp)* |
| **Grand Total** | **175** | **98.3%** |

### Performance Benchmarks (12 Core Endpoints)

All 12 tested endpoints meet the < 500ms response time threshold:

| Endpoint | Avg Response Time |
|---|---|
| `POST /auth/login` | 253 ms *(bcrypt cost 12 — intentional)* |
| `GET /auth/me` | 31 ms |
| `GET /admin/dashboard` | 31 ms |
| `GET /admin/users` | 62 ms |
| `GET /teachers/timetable` | 27 ms |
| `GET /students/timetable` | 45 ms |

### Known Issues

| Priority | Issue | Recommended Fix |
|---|---|---|
| High | HTTP 500 on 10,000-char password (bcrypt limit) | Add `max_length=128` to `LoginRequest.password` |
| Medium | XSS payload stored verbatim in messages | Apply `bleach.clean()` before DB persistence |
| Medium | RAG Faithfulness: 0.873 (target > 0.90, near-miss) | Harden faithfulness instruction in system prompt |

---

## 12. Configuration Reference

The backend is entirely driven by environment variables, managed through [`backend/app/core/config.py`](backend/app/core/config.py) (Pydantic `BaseSettings`).

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | *(empty)* | MySQL password |
| `DB_NAME` | `connected_app` | Database name |
| `DATABASE_URL` | *(empty)* | Full SQLAlchemy URL (overrides DB_* if set) |
| `SECRET_KEY` | `change-me-in-production` | JWT signing key — **must be changed in production** |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | JWT token lifetime |
| `ALLOWED_ORIGINS` | `["http://localhost:5173"]` | CORS allowed origins |
| `ANTHROPIC_API_KEY` | *(empty)* | Claude API key (AI grading, notes generation) |
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key (RAG embedding + generation, transcription fusion) |
| `GOOGLE_GENAI_API_KEY` | *(empty)* | Gemini API key (infographic generation) |
| `META_WHATSAPP_TOKEN` | *(empty)* | Meta system user access token |
| `META_PHONE_NUMBER_ID` | *(empty)* | WhatsApp phone number ID |
| `META_WABA_ID` | *(empty)* | WhatsApp Business Account ID |
| `META_WEBHOOK_VERIFY_TOKEN` | *(empty)* | Webhook verification secret |
| `WHATSAPP_USE_TEMPLATES` | `False` | Set `True` in production after Meta template approval |
| `FRONTEND_URL` | *(empty)* | Public frontend URL (used in WhatsApp notification links) |

---

<div align="center">

*ConnectEd — Built as a dissertation project · March 2026*

</div>
