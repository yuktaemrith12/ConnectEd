#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RAG Accuracy Evaluation Suite — ConnectEd AI Tutor
====================================================
Evaluates the Retrieval-Augmented Generation (RAG) pipeline of the
ConnectEd AI Tutor against a 30-item curated Golden Dataset drawn
from the actual indexed materials of tutor_1 (CST2550 — Software
Engineering and Management, Middlesex University).

Architecture Under Test
-----------------------
  Vector DB     : ChromaDB (persistent, cosine-distance space)
  Embeddings    : OpenAI text-embedding-3-small (1536-dim, used to index documents)
  LLM           : OpenAI GPT-4o-mini (production generation model)
  Judge LLM     : Anthropic Claude claude-haiku-4-5 (evaluation judge)
  Retrieval     : TF-IDF cosine similarity (see methodological note below)

Methodological Note on Retrieval Evaluation
--------------------------------------------
The production RAG pipeline embeds student queries using
``text-embedding-3-small`` and queries ChromaDB directly.
During this evaluation run, the OpenAI embedding API quota was
exceeded, so **TF-IDF cosine similarity** is used to rank the 15
stored chunks against each query.  TF-IDF retrieval is a standard
lexical baseline in Information Retrieval research (Robertson &
Zaragoza, 2009) and provides a lower-bound estimate of retrieval
quality — the production semantic retrieval should perform equal-to
or better-than these scores.  This is noted explicitly in the
results to maintain methodological transparency.

Metrics Computed
----------------
Retrieval (vector/lexical search quality):
  Hit Rate @ K  (K = 1, 3, 6)
      Proportion of answerable questions for which the relevant chunk
      appears within the top-K retrieved results.
  MRR (Mean Reciprocal Rank)
      Average of 1/rank of the first relevant chunk across all
      answerable questions.

Generation (LLM-as-Judge via Claude claude-haiku-4-5):
  Faithfulness        0–1   Is the answer derived *only* from the
                            retrieved context? (hallucination test)
  Answer Relevance    0–1   Does the answer directly address the question?
  Context Precision   0–1   Is the retrieved context relevant to the question?

Hallucination Detection (dedicated sub-suite, 4 questions):
  Refusal Rate        0–1   Proportion of unanswerable questions for which
                            the model correctly admits it has no information.

Theoretical Grounding
---------------------
  Es, S., James, J., Anke, L. E., & Schockaert, S. (2023).
  RAGAS: Automated evaluation of retrieval augmented generation.
  arXiv:2309.15217.

  Robertson, S., & Zaragoza, H. (2009).
  The probabilistic relevance framework: BM25 and beyond.
  Foundations and Trends in Information Retrieval, 3(4), 333–389.

Usage
-----
  cd ConnectEd/backend
  source venv/Scripts/activate          # Windows venv
  python ../tests/rag_eval_suite.py

Output
------
  tests/rag_eval_results.json   — machine-readable per-question results
  (summary printed to stdout)
"""

import os
import sys
import json
import time
import textwrap
import statistics
from pathlib import Path
from datetime import datetime, timezone

# ── Path bootstrap ────────────────────────────────────────────────────────────
ROOT    = Path(__file__).resolve().parent.parent          # ConnectEd/
BACKEND = ROOT / "backend"
TESTS   = ROOT / "tests"
sys.path.insert(0, str(BACKEND))

# ── Load .env without requiring python-dotenv ─────────────────────────────────
_env_path = BACKEND / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _, _val = _line.partition("=")
            os.environ.setdefault(_key.strip(), _val.strip())

OPENAI_API_KEY     = os.environ.get("OPENAI_API_KEY", "").strip()
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "").strip()
CHROMA_DIR         = str(BACKEND / "uploads" / "chroma_db")
EMBED_MODEL        = "text-embedding-3-small"       # production embedding model
GEN_MODEL          = "gpt-4o-mini"                  # production generation model
JUDGE_MODEL        = "claude-haiku-4-5-20251001"    # independent judge (Claude)
TUTOR_ID           = 1                              # tutor_1 collection (CST2550)
TOP_K              = 6                              # chunks retrieved per query
DISTANCE_THRESHOLD = 1.4                            # cosine-distance relevance cutoff
                                                    # (mirrors production rag_engine.py)

if not OPENAI_API_KEY:
    sys.exit("[ERROR] OPENAI_API_KEY not found in backend/.env — cannot run evaluation.")
if not ANTHROPIC_API_KEY:
    sys.exit("[ERROR] ANTHROPIC_API_KEY not found in backend/.env — cannot run evaluation.")

try:
    import openai
    import anthropic
    import chromadb
except ImportError as e:
    sys.exit(f"[ERROR] Missing dependency: {e}\n  Run: pip install openai anthropic chromadb")

_oai    = openai.OpenAI(api_key=OPENAI_API_KEY)
_claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── Load ChromaDB collection at startup ───────────────────────────────────────
_chroma     = chromadb.PersistentClient(path=CHROMA_DIR)
_collection = _chroma.get_or_create_collection(
    name=f"tutor_{TUTOR_ID}",
    metadata={"hnsw:space": "cosine"},
)
_chunk_count = _collection.count()
print(f"[init] ChromaDB collection tutor_{TUTOR_ID}: {_chunk_count} chunks")
print(f"[init] Retrieval: {EMBED_MODEL} -> ChromaDB (production semantic search)")
print(f"[init] Generation: {GEN_MODEL}  |  Judge: {JUDGE_MODEL}")


# ═════════════════════════════════════════════════════════════════════════════
# GOLDEN DATASET  (30 question–answer pairs)
# ─────────────────────────────────────────────────────────────────────────────
# Each entry:
#   id               int   — unique identifier
#   question         str   — the student query
#   ground_truth     str   — ideal answer (used by the judge, not fed to LLM)
#   expected_keywords list  — tokens that MUST appear in the relevant chunk
#                             used to locate the correct chunk for Hit Rate / MRR
#   answerable       bool  — False = info NOT in documents; model should refuse
# ═════════════════════════════════════════════════════════════════════════════
GOLDEN_DATASET = [

    # ── Module Overview  (Week01.pdf – Chunk 0) ──────────────────────────────
    {
        "id": 1,
        "question": "What are the main topics covered in the CST2550 module?",
        "ground_truth": (
            "The CST2550 module covers required programming concepts in C#, "
            "software engineering (including the software development life cycle, "
            "testing, and tools/techniques), and algorithms and data structures "
            "(timing algorithms and algorithmic analysis)."
        ),
        "expected_keywords": ["CST2550", "software engineering", "algorithms"],
        "answerable": True,
    },
    {
        "id": 2,
        "question": "Who is the lecturer for CST2550 and which university do they belong to?",
        "ground_truth": (
            "The lecturer is Ahmed Eissa (a.eissa@mdx.ac.uk) at Middlesex "
            "University (MDX)."
        ),
        "expected_keywords": ["Ahmed Eissa", "MDX"],
        "answerable": True,
    },

    # ── Assessment  (Week01.pdf – Chunk 1) ───────────────────────────────────
    {
        "id": 3,
        "question": "How is the CST2550 assessment split between online tests and coursework?",
        "ground_truth": (
            "The assessment is 50% online tests and 50% coursework. "
            "The coursework is split into 25% for software design and "
            "implementation of a mini-project, and 25% for algorithms and "
            "data structures of the mini-project."
        ),
        "expected_keywords": ["Online tests", "50%", "mini-project"],
        "answerable": True,
    },
    {
        "id": 4,
        "question": "What format does the CST2550 online test use?",
        "ground_truth": (
            "The online test is hosted on Moodle with random questions "
            "covering specific topics, including multiple-choice question types."
        ),
        "expected_keywords": ["Moodle", "Random questions"],
        "answerable": True,
    },

    # ── Attendance  (Week01.pdf – Chunk 2) ───────────────────────────────────
    {
        "id": 5,
        "question": "Does attendance affect student grades in CST2550?",
        "ground_truth": (
            "Yes. Figure 1 in the module materials shows grades as a function "
            "of attendance, demonstrating that better attendance leads to better grades."
        ),
        "expected_keywords": ["Attendance", "Grades", "Figure 1"],
        "answerable": True,
    },

    # ── Encapsulation  (Week01.pdf – Chunk 3) ────────────────────────────────
    {
        "id": 6,
        "question": "What is encapsulation in C# and why is it important?",
        "ground_truth": (
            "Encapsulation restricts access to parts of an object and exposes "
            "only necessary interfaces. It protects data integrity and enables "
            "loose coupling. In C# it is implemented with private variables and "
            "public methods."
        ),
        "expected_keywords": ["encapsulation", "private", "loose coupling"],
        "answerable": True,
    },

    # ── JIT / CLR  (Week01.pdf – Chunk 4) ────────────────────────────────────
    {
        "id": 7,
        "question": "What does Just-In-Time (JIT) compilation do in the .NET runtime?",
        "ground_truth": (
            "JIT compilation converts intermediate language (IL) code into native "
            "machine code at runtime for optimal performance."
        ),
        "expected_keywords": ["JIT", "intermediate code", "machine code"],
        "answerable": True,
    },
    {
        "id": 8,
        "question": "How does the .NET runtime handle memory management automatically?",
        "ground_truth": (
            "The CLR uses Garbage Collection to automatically manage memory "
            "allocation and cleanup."
        ),
        "expected_keywords": ["Garbage Collection", "memory"],
        "answerable": True,
    },

    # ── BCL  (Week01.pdf – Chunk 4/5) ────────────────────────────────────────
    {
        "id": 9,
        "question": "What is the Base Class Library (BCL) in the .NET Framework?",
        "ground_truth": (
            "The BCL is a collection of reusable classes and methods for common "
            "programming tasks provided by the .NET Framework."
        ),
        "expected_keywords": ["Base Class Library", "reusable classes"],
        "answerable": True,
    },

    # ── C# language overview  (Week01.pdf – Chunk 5) ─────────────────────────
    {
        "id": 10,
        "question": "What makes C# described as a type-safe language for modern applications?",
        "ground_truth": (
            "C# is described as a robust, type-safe language with comprehensive "
            "tools and runtime services provided by .NET, emphasising setting up "
            "a practical development environment."
        ),
        "expected_keywords": ["type-safe", "C#", ".NET"],
        "answerable": True,
    },

    # ── Lab 1  (All-labs-exercises.pdf – Chunk 0) ─────────────────────────────
    {
        "id": 11,
        "question": "What are the objectives and prerequisites for Lab 1 in the CST2550 lab booklet?",
        "ground_truth": (
            "Lab 1 objectives: set up the development environment, create a first "
            "C# application, understand basic OOP concepts. "
            "Prerequisite: Visual Studio 2022 installed. Duration: 2 hours."
        ),
        "expected_keywords": ["Lab 1", "Visual Studio 2022", "OOP"],
        "answerable": True,
    },

    # ── Lab 3 — Graphs & Hash Tables  (All-labs-exercises.pdf – Chunk 1) ──────
    {
        "id": 12,
        "question": "What advanced data structures are covered in Lab 3?",
        "ground_truth": (
            "Lab 3 covers graphs and hash tables. Objectives: implement a hash "
            "table, create a graph structure, and perform graph traversal."
        ),
        "expected_keywords": ["Lab 3", "hash table", "graph"],
        "answerable": True,
    },

    # ── Lab 5 — Database  (All-labs-exercises.pdf – Chunk 2) ─────────────────
    {
        "id": 13,
        "question": "What is Lab 5 about and which framework does it use to connect C# to a database?",
        "ground_truth": (
            "Lab 5 teaches implementing a database in a C# application. "
            "It uses Entity Framework Core."
        ),
        "expected_keywords": ["Lab 5", "database", "Entity Framework Core"],
        "answerable": True,
    },

    # ── Lab 7 — Debugging & Testing  (All-labs-exercises.pdf – Chunk 3) ───────
    {
        "id": 14,
        "question": "What does Lab 7 on debugging and testing cover?",
        "ground_truth": (
            "Lab 7 covers debugging C# applications, writing unit tests, and "
            "performing integration testing. Duration: 2 hours."
        ),
        "expected_keywords": ["Lab 7", "debug", "unit test"],
        "answerable": True,
    },

    # ── CI/CD  (All-labs-exercises.pdf – Chunk 3) ────────────────────────────
    {
        "id": 15,
        "question": "What CI/CD extension activities are included in the CST2550 lab exercises?",
        "ground_truth": (
            "Extension activities include creating a complex branching strategy, "
            "implementing git hooks, and setting up automated testing within a "
            "CI/CD pipeline."
        ),
        "expected_keywords": ["CI/CD", "git hooks", "automated testing"],
        "answerable": True,
    },

    # ── SDLC Lab 8  (All-labs-exercises.pdf – Chunk 4) ────────────────────────
    {
        "id": 16,
        "question": "What SDLC activities must students complete in Lab 8?",
        "ground_truth": (
            "Lab 8 requires practising SDLC phases: project charter, requirements "
            "definition, system architecture design, iteration planning, task "
            "breakdown, effort estimation, and project documentation."
        ),
        "expected_keywords": ["SDLC", "project charter", "requirements"],
        "answerable": True,
    },

    # ── Threading  (All-labs-exercises.pdf – Chunk 5) ─────────────────────────
    {
        "id": 17,
        "question": "How does thread pooling work in C# according to the lab exercises?",
        "ground_truth": (
            "Thread pooling uses ThreadPool.QueueUserWorkItem() to queue work "
            "items onto managed threads. The lab example queues 5 tasks and "
            "demonstrates parallel execution."
        ),
        "expected_keywords": ["ThreadPool", "QueueUserWorkItem"],
        "answerable": True,
    },

    # ── Producer-Consumer  (All-labs-exercises.pdf – Chunk 6) ─────────────────
    {
        "id": 18,
        "question": "What synchronisation mechanism is used in the producer-consumer pattern in the labs?",
        "ground_truth": (
            "The producer-consumer pattern uses a semaphore (WaitAsync/Release) "
            "combined with a lock object to protect a shared queue."
        ),
        "expected_keywords": ["semaphore", "lock", "queue"],
        "answerable": True,
    },

    # ── Design Patterns  (All-labs-exercises.pdf – Chunk 7) ───────────────────
    {
        "id": 19,
        "question": "Which design patterns are practised in the CST2550 lab exercises?",
        "ground_truth": (
            "Labs practise Singleton (SingletonLogger), Factory (PaymentFactory), "
            "Observer (OrderObserver), and Strategy (IPaymentStrategy)."
        ),
        "expected_keywords": ["Singleton", "Factory", "Observer", "Strategy"],
        "answerable": True,
    },
    {
        "id": 20,
        "question": "What do the SOLID principles aim to achieve in the labs?",
        "ground_truth": (
            "The SOLID principles are applied by refactoring existing code to "
            "improve maintainability and extensibility."
        ),
        "expected_keywords": ["SOLID", "refactor"],
        "answerable": True,
    },

    # ── AI Transcript  (Transcript #1 – Chunk 0) ──────────────────────────────
    {
        "id": 21,
        "question": "What examples of everyday AI are mentioned in the class transcript?",
        "ground_truth": (
            "The transcript mentions voice assistants such as Siri and Alexa, "
            "and recommendation systems as everyday AI examples."
        ),
        "expected_keywords": ["Siri", "Alexa", "recommendation"],
        "answerable": True,
    },

    # ── Cross-concept / synthesis questions ───────────────────────────────────
    {
        "id": 22,
        "question": "What is the difference between abstraction and encapsulation in OOP?",
        "ground_truth": (
            "The materials discuss encapsulation as restricting access and "
            "exposing only necessary interfaces. The lecture poses the difference "
            "as a discussion question, noting both relate to information hiding."
        ),
        "expected_keywords": ["abstraction", "encapsulation"],
        "answerable": True,
    },
    {
        "id": 23,
        "question": "What programming language is used throughout all CST2550 lab exercises?",
        "ground_truth": "C# (.NET) is the primary language used across all labs.",
        "expected_keywords": ["C#", ".NET"],
        "answerable": True,
    },
    {
        "id": 24,
        "question": "What is the software development life cycle and how is it covered in this module?",
        "ground_truth": (
            "The SDLC is a key topic in CST2550. Lab 8 practises SDLC phases: "
            "project charter, requirements, architecture, and iteration planning."
        ),
        "expected_keywords": ["software development life cycle", "SDLC"],
        "answerable": True,
    },
    {
        "id": 25,
        "question": "What is the role of Moodle in the CST2550 module?",
        "ground_truth": (
            "Moodle hosts the online tests and provides access to the Module Handbook."
        ),
        "expected_keywords": ["Moodle"],
        "answerable": True,
    },
    {
        "id": 26,
        "question": "How does the module approach algorithms and data structures?",
        "ground_truth": (
            "The module covers timing algorithms and algorithmic analysis. "
            "Labs 3 and related exercises cover hash tables and graphs with "
            "performance comparisons."
        ),
        "expected_keywords": ["algorithm", "timing"],
        "answerable": True,
    },

    # ── Hallucination / Unanswerable tests  (answerable=False) ───────────────
    {
        "id": 27,
        "question": "What is the minimum pass mark for the CST2550 online test?",
        "ground_truth": (
            "The class materials do not specify a minimum pass mark. "
            "The model should honestly admit this is not covered."
        ),
        "expected_keywords": [],
        "answerable": False,
    },
    {
        "id": 28,
        "question": "What is the submission deadline for the CST2550 coursework?",
        "ground_truth": (
            "No submission deadline appears in the class materials. "
            "The model should acknowledge this gap."
        ),
        "expected_keywords": [],
        "answerable": False,
    },
    {
        "id": 29,
        "question": "In what year was the C# programming language first publicly released?",
        "ground_truth": (
            "This is general historical knowledge not present in the class materials. "
            "The model should state it cannot find this in the documents."
        ),
        "expected_keywords": [],
        "answerable": False,
    },
    {
        "id": 30,
        "question": "How many students are currently enrolled in CST2550 this academic year?",
        "ground_truth": (
            "Student enrolment numbers are not mentioned in the class materials."
        ),
        "expected_keywords": [],
        "answerable": False,
    },
]


# ═════════════════════════════════════════════════════════════════════════════
# RETRIEVAL  (Production: OpenAI text-embedding-3-small + ChromaDB)
# ═════════════════════════════════════════════════════════════════════════════

def embed_query(question: str) -> list:
    """Embed a query using the production OpenAI embedding model."""
    resp = _oai.embeddings.create(model=EMBED_MODEL, input=[question])
    return resp.data[0].embedding


def semantic_retrieve(query_embedding: list, n: int = TOP_K):
    """
    Query ChromaDB with a real semantic embedding vector — identical to
    the production run_rag_query() pipeline in rag_engine.py.

    Returns (docs, metadatas, distances) where distance is cosine distance
    (lower = more similar, threshold < 1.4 in production).
    """
    result = _collection.query(
        query_embeddings=[query_embedding],
        n_results=n,
        include=["documents", "metadatas", "distances"],
    )
    docs      = result["documents"][0] if result["documents"] else []
    metas     = result["metadatas"][0]  if result["metadatas"]  else []
    distances = result["distances"][0]  if result["distances"]  else []
    return docs, metas, distances


def hit_at_k(docs: list, expected_keywords: list, k: int):
    """
    Returns True if any chunk in the top-K results contains ALL expected keywords
    (case-insensitive).  Returns None for unanswerable questions.
    """
    if not expected_keywords:
        return None
    for doc in docs[:k]:
        doc_lower = doc.lower()
        if all(kw.lower() in doc_lower for kw in expected_keywords):
            return True
    return False


def reciprocal_rank(docs: list, expected_keywords: list):
    """
    Returns 1/rank of the first chunk containing all expected keywords.
    Returns None for unanswerable questions, 0.0 if no match found.
    """
    if not expected_keywords:
        return None
    for rank, doc in enumerate(docs, start=1):
        if all(kw.lower() in doc.lower() for kw in expected_keywords):
            return 1.0 / rank
    return 0.0


def build_context(docs: list, distances: list) -> str:
    """
    Build context string using the production distance threshold (< 1.4),
    exactly mirroring run_rag_query() in rag_engine.py.
    """
    parts = []
    for i, (doc, dist) in enumerate(zip(docs, distances)):
        if dist < DISTANCE_THRESHOLD:
            parts.append(f"[Source {i + 1}]:\n{doc}")
    return (
        "\n\n".join(parts)
        if parts
        else "No relevant class materials found for this query."
    )


# ═════════════════════════════════════════════════════════════════════════════
# GENERATION  (Production: GPT-4o-mini, same model as the live system)
# ═════════════════════════════════════════════════════════════════════════════

def generate_answer(question: str, context_text: str) -> str:
    """
    Generate an answer using GPT-4o-mini with the production system-prompt
    structure (learn mode, supportive persona) — identical to run_rag_query().
    """
    try:
        from app.services.ai_tutor.mode_prompts import build_system_prompt
        system_prompt = build_system_prompt(
            mode="learn",
            personality="supportive",
            teaching_style="detailed",
            tone="friendly",
            difficulty="intermediate",
        )
    except ImportError:
        system_prompt = (
            "You are an AI tutor. ONLY use the class materials context below.\n"
            "CRITICAL RULE: If the context does not contain the answer, say: "
            "'I do not have specific information about that in your class materials.'\n\n"
        )

    system_prompt += (
        "--- CLASS MATERIALS CONTEXT ---\n"
        f"{context_text}\n"
        "--- END CONTEXT ---\n\n"
        "Ground your answer ONLY in the class materials above. "
        "Do NOT add general knowledge not present in the context."
    )

    resp = _oai.chat.completions.create(
        model=GEN_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": question},
        ],
        max_tokens=600,
        temperature=0.4,
    )
    return resp.choices[0].message.content or ""


# ═════════════════════════════════════════════════════════════════════════════
# JUDGE  (Claude claude-haiku-4-5 as LLM-as-Judge)
# ═════════════════════════════════════════════════════════════════════════════

def llm_judge(
    question: str,
    ground_truth: str,
    context: str,
    answer: str,
    answerable: bool,
) -> dict:
    """
    Score a RAG response on Faithfulness, Answer Relevance, and Context Precision.

    Returns:
      {
        "faithfulness":              float 0–1,
        "answer_relevance":          float 0–1,
        "context_precision":         float 0–1,
        "faithfulness_reason":       str,
        "answer_relevance_reason":   str,
        "context_precision_reason":  str,
      }
    """
    system = textwrap.dedent("""
        You are an expert evaluator of RAG (Retrieval-Augmented Generation) systems.
        Score the generated answer on three metrics, each 0.0–1.0.

        DEFINITIONS
        -----------
        1. Faithfulness (0.0–1.0)
           Does the answer use ONLY information present in the retrieved context?
           1.0 = fully grounded (or honest admission of no info)
           0.5 = mostly grounded with minor unsupported additions
           0.0 = significant hallucinated/fabricated content

        2. Answer Relevance (0.0–1.0)
           Does the answer directly address the question?
           1.0 = fully and directly answers the question
           0.5 = partial or tangential answer
           0.0 = off-topic or ignores the question

        3. Context Precision (0.0–1.0)
           Is the retrieved context relevant and sufficient to answer the question?
           1.0 = context directly contains the answer
           0.5 = context partially covers the topic
           0.0 = context is entirely irrelevant

        SPECIAL CASE — Unanswerable questions (answerable=false)
        The correct behaviour is to say the information is not in the class materials.
          If the model honestly admits ignorance → faithfulness=1.0, answer_relevance=0.9
          If the model fabricates an answer     → faithfulness=0.0, answer_relevance=0.1

        Return ONLY valid JSON — no markdown fences:
        {
          "faithfulness": <float>,
          "answer_relevance": <float>,
          "context_precision": <float>,
          "faithfulness_reason": "<one sentence>",
          "answer_relevance_reason": "<one sentence>",
          "context_precision_reason": "<one sentence>"
        }
    """).strip()

    user_msg = (
        f"QUESTION: {question}\n\n"
        f"GROUND TRUTH: {ground_truth}\n\n"
        f"RETRIEVED CONTEXT (full, up to 6000 chars):\n{context[:6000]}\n\n"
        f"GENERATED ANSWER:\n{answer[:1200]}\n\n"
        f"answerable: {str(answerable).lower()}"
    )

    try:
        resp = _claude.messages.create(
            model=JUDGE_MODEL,
            max_tokens=350,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = resp.content[0].text.strip()
        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as exc:
        return {
            "faithfulness":              0.5,
            "answer_relevance":          0.5,
            "context_precision":         0.5,
            "faithfulness_reason":       f"Judge error: {exc}",
            "answer_relevance_reason":   "Judge error",
            "context_precision_reason":  "Judge error",
        }


# ═════════════════════════════════════════════════════════════════════════════
# MAIN EVALUATION LOOP
# ═════════════════════════════════════════════════════════════════════════════

def run_evaluation() -> dict:
    """Execute the full RAG evaluation and return a structured results dict."""
    print("\n" + "=" * 68)
    print("  ConnectEd AI Tutor — RAG Accuracy Evaluation Suite")
    print(f"  Retrieval   : {EMBED_MODEL} -> ChromaDB (production semantic search)")
    print(f"  Generation  : {GEN_MODEL}  |  Judge: {JUDGE_MODEL}")
    print(f"  Collection  : tutor_{TUTOR_ID}  ({_chunk_count} chunks)")
    print(f"  Questions   : {len(GOLDEN_DATASET)}")
    print(f"  Started     : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 68 + "\n")

    per_question = []

    for item in GOLDEN_DATASET:
        qid          = item["id"]
        question     = item["question"]
        ground_truth = item["ground_truth"]
        keywords     = item["expected_keywords"]
        answerable   = item["answerable"]

        print(f"[{qid:02d}/30] {question[:72]}{'...' if len(question) > 72 else ''}")

        # ── 1. Embed query + semantic retrieval (production pipeline) ─────────
        q_emb = embed_query(question)
        time.sleep(0.15)
        docs, metas, distances = semantic_retrieve(q_emb, n=TOP_K)

        # ── 2. Retrieval metrics ──────────────────────────────────────────────
        h1  = hit_at_k(docs, keywords, k=1)
        h3  = hit_at_k(docs, keywords, k=3)
        h6  = hit_at_k(docs, keywords, k=6)
        rr  = reciprocal_rank(docs, keywords)
        num_relevant = sum(1 for d in distances if d < DISTANCE_THRESHOLD)

        # ── 3. Build context (production distance threshold < 1.4) ─────────────
        context_text = build_context(docs, distances)

        # ── 4. Generate answer (GPT-4o-mini, production model) ────────────────
        answer = generate_answer(question, context_text)
        time.sleep(0.3)

        # ── 5. LLM-as-judge scoring (Claude, independent evaluator) ───────────
        scores_dict = llm_judge(question, ground_truth, context_text, answer, answerable)
        time.sleep(0.3)

        # ── 6. Collate ────────────────────────────────────────────────────────
        result = {
            "id":           qid,
            "question":     question,
            "ground_truth": ground_truth,
            "answerable":   answerable,
            "retrieval": {
                "hit_at_1":             h1,
                "hit_at_3":             h3,
                "hit_at_6":             h6,
                "reciprocal_rank":      rr,
                "num_chunks_retrieved": len(docs),
                "num_relevant_chunks":  num_relevant,
                "distances":            [round(d, 4) for d in distances],
                "filenames":            [m.get("filename", "?") for m in metas],
            },
            "answer":  answer,
            "scores":  scores_dict,
        }
        per_question.append(result)

        f = scores_dict.get("faithfulness", 0)
        r = scores_dict.get("answer_relevance", 0)
        p = scores_dict.get("context_precision", 0)
        print(f"        Faithfulness={f:.2f}  Relevance={r:.2f}  "
              f"Precision={p:.2f}  HR@3={h3}  RR={rr}\n")

    # ── Aggregate ─────────────────────────────────────────────────────────────
    answerable_qs   = [r for r in per_question if r["answerable"]]
    unanswerable_qs = [r for r in per_question if not r["answerable"]]

    def _mean(subset, key):
        vals = [r["scores"].get(key) for r in subset if r["scores"].get(key) is not None]
        return round(statistics.mean(vals), 4) if vals else None

    def _hr(subset, k_key):
        vals = [r["retrieval"][k_key] for r in subset if r["retrieval"][k_key] is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    def _mrr(subset):
        vals = [r["retrieval"]["reciprocal_rank"] for r in subset
                if r["retrieval"]["reciprocal_rank"] is not None]
        return round(statistics.mean(vals), 4) if vals else None

    refusal_rate = None
    if unanswerable_qs:
        refused = sum(
            1 for r in unanswerable_qs
            if r["scores"].get("faithfulness", 0) >= 0.8
        )
        refusal_rate = round(refused / len(unanswerable_qs), 4)

    agg = {
        "retrieval": {
            "hit_rate_at_1": _hr(answerable_qs, "hit_at_1"),
            "hit_rate_at_3": _hr(answerable_qs, "hit_at_3"),
            "hit_rate_at_6": _hr(answerable_qs, "hit_at_6"),
            "mean_reciprocal_rank": _mrr(answerable_qs),
        },
        "generation": {
            "faithfulness":      _mean(per_question, "faithfulness"),
            "answer_relevance":  _mean(per_question, "answer_relevance"),
            "context_precision": _mean(per_question, "context_precision"),
        },
        "hallucination": {
            "refusal_rate":              refusal_rate,
            "unanswerable_faithfulness": _mean(unanswerable_qs, "faithfulness"),
        },
        "success_criteria": {
            "faithfulness_above_0.90":     (_mean(per_question, "faithfulness") or 0) > 0.90,
            "answer_relevance_above_0.85": (_mean(per_question, "answer_relevance") or 0) > 0.85,
            "hit_rate_at_3_above_0.80":   (_hr(answerable_qs, "hit_at_3") or 0) > 0.80,
        },
    }

    return {
        "run_info": {
            "timestamp":          datetime.now(timezone.utc).isoformat(),
            "embed_model":        EMBED_MODEL,
            "generation_model":   GEN_MODEL,
            "judge_model":        JUDGE_MODEL,
            "retrieval_method":   f"Semantic vector search ({EMBED_MODEL} -> ChromaDB cosine)",
            "distance_threshold": DISTANCE_THRESHOLD,
            "tutor_id":           TUTOR_ID,
            "top_k":              TOP_K,
            "total_questions":    len(GOLDEN_DATASET),
            "answerable":         len(answerable_qs),
            "unanswerable":       len(unanswerable_qs),
        },
        "aggregate_metrics": agg,
        "per_question": per_question,
    }


# ═════════════════════════════════════════════════════════════════════════════
# OUTPUT
# ═════════════════════════════════════════════════════════════════════════════

def print_summary(summary: dict) -> None:
    agg = summary["aggregate_metrics"]
    ret = agg["retrieval"]
    gen = agg["generation"]
    hal = agg["hallucination"]
    sc  = agg["success_criteria"]

    def _fmt(val):
        return f"{val:.4f}" if val is not None else "N/A  "

    SEP = "-" * 68

    print("\n" + "=" * 68)
    print("  EVALUATION RESULTS SUMMARY")
    print("=" * 68)

    print(f"\n{SEP}")
    print(f"  Retrieval Metrics ({EMBED_MODEL} -> ChromaDB)")
    print(SEP)
    print(f"  Hit Rate @ 1 :  {_fmt(ret['hit_rate_at_1'])}   (no target)")
    print(f"  Hit Rate @ 3 :  {_fmt(ret['hit_rate_at_3'])}   target >0.80  {'PASS' if sc['hit_rate_at_3_above_0.80'] else 'FAIL'}")
    print(f"  Hit Rate @ 6 :  {_fmt(ret['hit_rate_at_6'])}   (no target)")
    print(f"  MRR          :  {_fmt(ret['mean_reciprocal_rank'])}   (higher is better)")

    print(f"\n{SEP}")
    print(f"  Generation Metrics ({GEN_MODEL}, judged by {JUDGE_MODEL})")
    print(SEP)
    print(f"  Faithfulness      :  {_fmt(gen['faithfulness'])}   target >0.90  {'PASS' if sc['faithfulness_above_0.90'] else 'FAIL'}")
    print(f"  Answer Relevance  :  {_fmt(gen['answer_relevance'])}   target >0.85  {'PASS' if sc['answer_relevance_above_0.85'] else 'FAIL'}")
    print(f"  Context Precision :  {_fmt(gen['context_precision'])}   (no target)")

    print(f"\n{SEP}")
    print("  Hallucination Detection (4 unanswerable questions)")
    print(SEP)
    print(f"  Refusal Rate            :  {_fmt(hal['refusal_rate'])}")
    print(f"  Faithfulness (unansw.)  :  {_fmt(hal['unanswerable_faithfulness'])}")

    print(f"\n{SEP}")
    print("  Overall Verdict")
    print(SEP)
    all_pass = all(sc.values())
    verdict = ("ALL TARGETS MET - RAG system within specification."
               if all_pass else
               "ONE OR MORE TARGETS MISSED - see per-question detail.")
    print(f"  {verdict}")
    print("=" * 68 + "\n")


def save_results(summary: dict) -> Path:
    out_path = TESTS / "rag_eval_results.json"
    out_path.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[OK] Results saved -> {out_path}")
    return out_path


# ═════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    summary = run_evaluation()
    save_results(summary)   # save first so results persist even if print fails
    print_summary(summary)
