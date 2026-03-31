# AI Tutor — RAG System Explained

## What is RAG?

**RAG (Retrieval-Augmented Generation)** is the technique that powers the AI Tutor.

Instead of letting the AI answer freely from its general training data (which could hallucinate or go off-topic), RAG forces it to:

1. **Search** the teacher's uploaded class materials first
2. **Retrieve** the most relevant chunks of text
3. **Answer** using only what it found

The result is an AI that only knows what the teacher has uploaded — no more, no less.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     TEACHER SIDE                        │
│                                                         │
│  Uploads PDF / PPTX / DOCX / TXT                        │
│          ↓                                              │
│  document_ingestion.py                                  │
│   • Splits file into chunks (~500 tokens each)          │
│   • Embeds each chunk → vector via OpenAI               │
│   • Stores vectors in ChromaDB (one collection/tutor)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     STUDENT SIDE                        │
│                                                         │
│  Student sends a message                                │
│          ↓                                              │
│  rag_engine.py  (run_rag_query)                         │
│   1. Embed the question → query vector                  │
│   2. Search ChromaDB → top 6 similar chunks             │
│   3. Filter out low-relevance chunks (distance > 1.4)   │
│   4. Build system prompt (mode + personality + context) │
│   5. Call GPT-4o-mini with the assembled prompt         │
│   6. Return: response text + source citations +         │
│              confidence level                           │
└─────────────────────────────────────────────────────────┘
```

---

## Document Ingestion (Teacher Uploads)

**File:** `backend/app/services/ai_tutor/document_ingestion.py`

When a teacher uploads a file:

| Step | What happens |
|------|-------------|
| 1 | File is parsed (PyMuPDF for PDF, python-pptx for PPTX, etc.) |
| 2 | Text is split into overlapping chunks of ~500 tokens |
| 3 | Each chunk is embedded using `text-embedding-3-small` (OpenAI) |
| 4 | Vectors + metadata are stored in ChromaDB collection `tutor_{id}` |
| 5 | `is_indexed = True` is set on the document record in MySQL |

This runs as a **FastAPI background task** so the teacher doesn't have to wait.

---

## Query Pipeline (Student Asks a Question)

**File:** `backend/app/services/ai_tutor/rag_engine.py`

### Step 1 — Embed the question
The student's message is converted to a vector using the same `text-embedding-3-small` model.

```
"What is Newton's second law?" → [0.12, -0.45, 0.88, 0.03, ...]
                                   (1536-dimensional vector)
```

### Step 2 — Search ChromaDB
ChromaDB compares the question vector against all stored chunk vectors using **cosine distance**. The 6 closest chunks are returned.

```
Chunk A: "F = ma is Newton's second law..."  → distance 0.3  ✅
Chunk B: "Velocity is the rate of change..."  → distance 0.9  ✅
Chunk C: "The French Revolution began..."     → distance 1.8  ❌ filtered
```

### Step 3 — Filter by relevance
Chunks with `distance > 1.4` are discarded. Only genuinely relevant material is passed to the AI.

### Step 4 — Build the system prompt
**File:** `backend/app/services/ai_tutor/mode_prompts.py`

The full system prompt is assembled from several layers:

```
[Base context / custom system prompt]
      +
[Personality modifier]   e.g. "Be warm and encouraging..."
      +
[Teaching style modifier] e.g. "Break into numbered steps..."
      +
[Tone modifier]          e.g. "Use conversational language..."
      +
[Difficulty modifier]    e.g. "Assume no prior knowledge..."
      +
[Mode instructions]      e.g. Learn / Revision / Practice / Exam Prep / Recap template
      +
[Emphasis topics]        e.g. "Give extra depth to: Algebra, Kinematics"
      +
[Retrieved context]      The actual chunks from class materials
```

### Step 5 — Call GPT-4o-mini
The assembled prompt + last 10 messages of chat history are sent to `gpt-4o-mini`.

### Step 6 — Confidence scoring
Based on how many retrieved chunks were relevant:

| Relevant chunks (distance < 1.4) | Confidence | Student sees |
|---|---|---|
| 3 or more | `high` | Green indicator |
| 1–2 | `medium` | Amber indicator |
| 0 | `low` | Red indicator + warning banner |

---

## The Five Learning Modes

Each mode changes the **structure of the AI's response**:

| Mode | Purpose | Response structure |
|------|---------|-------------------|
| **Learn** | Explain a concept | Summary → Explanation → Worked Example → Quick Summary → Try This |
| **Revision** | Study key points | Key Points → Definitions → Comparison Table → Test Yourself |
| **Practice** | Do exercises | Exercise → Instructions → Hints (3 levels) → Full Solution |
| **Exam Prep** | Prepare for exams | Exam Question [marks] → Model Answer → Marking Points → Feedback |
| **Class Recap** | Review a session | What We Covered → Key Takeaways → Definitions → What's Next → Quick Check |

---

## Teacher Personalisation Controls

Teachers can configure each tutor's behaviour from the Settings tab:

| Setting | Options | Effect on prompt |
|---------|---------|-----------------|
| **Personality** | Supportive / Neutral / Strict | Changes how feedback is delivered |
| **Teaching Style** | Detailed / Step-by-Step / Concise | Changes explanation depth |
| **Tone** | Friendly / Academic / Formal | Changes language register |
| **Difficulty** | Beginner / Intermediate / Advanced | Changes assumed prior knowledge |
| **Emphasis Topics** | Free-text tags | Tells the AI to prioritise certain topics |
| **Icon Emoji** | Emoji picker | Displayed on the tutor card |
| **Custom System Prompt** | Free text | Overrides the base persona entirely |

---

## Confidence Indicator

The frontend (`ConfidenceIndicator.tsx`) shows a 4-bar visual meter on every AI response:

```
High     ████  (green)   — 3+ relevant chunks found
Medium   ██░░  (amber)   — 1–2 relevant chunks found
Low      █░░░  (red)     — 0 relevant chunks found
                           + warning: "This answer may go beyond your class materials"
```

---

## Key Files Reference

| File | Role |
|------|------|
| `backend/app/services/ai_tutor/document_ingestion.py` | Splits, embeds, and stores uploaded files |
| `backend/app/services/ai_tutor/rag_engine.py` | The full RAG query pipeline |
| `backend/app/services/ai_tutor/mode_prompts.py` | Prompt templates + personality/style/tone modifiers |
| `backend/app/services/ai_tutor/vector_index_manager.py` | ChromaDB collection management |
| `backend/app/api/ai_tutor.py` | FastAPI endpoints for teacher + student |
| `frontend/src/app/pages/student/AITutor.tsx` | Student chat interface |
| `frontend/src/app/pages/teacher/AITutorManagement.tsx` | Teacher management dashboard |
| `frontend/src/app/components/ai-tutor/` | UI components (MarkdownRenderer, ConfidenceIndicator, etc.) |

---

## Data Flow Summary

```
Teacher uploads file
    → chunked + embedded → ChromaDB (vector store)
    → metadata stored   → MySQL (document record)

Student sends message
    → embedded → ChromaDB similarity search
    → top chunks retrieved → filtered by distance
    → system prompt assembled (mode + personality + chunks)
    → GPT-4o-mini called
    → response + sources + confidence returned
    → saved to MySQL (ai_tutor_chat_messages)
    → rendered in chat UI with MarkdownRenderer
```
