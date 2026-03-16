"""
SQLAlchemy models for the AI Tutor feature.

Tables (created by 18_ai_tutor.sql + 19_ai_tutor_improvements.sql):
  ai_tutors              — one tutor per class-subject combination
  ai_tutor_chapters      — chapters/terms that organise content
  ai_tutor_documents     — uploaded academic material (PDF, PPTX, DOCX, TXT)
  ai_tutor_transcripts   — class session transcripts pending teacher approval
  ai_tutor_chat_sessions — student conversation sessions
  ai_tutor_chat_messages — individual messages in a session
  ai_tutor_vector_chunks — metadata for ChromaDB-indexed text chunks
"""

import enum

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class DocTypeEnum(str, enum.Enum):
    handbook       = "handbook"
    curriculum     = "curriculum"
    lesson         = "lesson"
    worksheet      = "worksheet"
    homework       = "homework"
    mock_test      = "mock_test"
    past_paper     = "past_paper"
    marking_scheme = "marking_scheme"
    other          = "other"


class TranscriptStatusEnum(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"


class ChatModeEnum(str, enum.Enum):
    learn     = "learn"
    revision  = "revision"
    practice  = "practice"
    exam_prep = "exam_prep"
    recap     = "recap"


class MessageRoleEnum(str, enum.Enum):
    user      = "user"
    assistant = "assistant"
    system    = "system"


class PersonalityEnum(str, enum.Enum):
    strict     = "strict"
    supportive = "supportive"
    neutral    = "neutral"


class TeachingStyleEnum(str, enum.Enum):
    concise      = "concise"
    detailed     = "detailed"
    step_by_step = "step_by_step"


class ToneEnum(str, enum.Enum):
    formal    = "formal"
    friendly  = "friendly"
    academic  = "academic"


class ConfidenceLevelEnum(str, enum.Enum):
    high   = "high"
    medium = "medium"
    low    = "low"


# ── Models ────────────────────────────────────────────────────────────────────

class AiTutor(Base):
    __tablename__ = "ai_tutors"
    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    class_id       = Column(Integer, ForeignKey("classes.id",   ondelete="CASCADE"), nullable=False)
    subject_id     = Column(Integer, ForeignKey("subjects.id",  ondelete="CASCADE"), nullable=False)
    teacher_id     = Column(Integer, ForeignKey("users.id",     ondelete="CASCADE"), nullable=False)
    display_name   = Column(String(255))
    system_prompt  = Column(Text)
    personality    = Column(Enum(PersonalityEnum),   default=PersonalityEnum.supportive)
    teaching_style = Column(Enum(TeachingStyleEnum), default=TeachingStyleEnum.detailed)
    tone           = Column(Enum(ToneEnum),           default=ToneEnum.friendly)
    emphasis_topics = Column(JSON, nullable=True)
    icon_emoji     = Column(String(10), nullable=True)
    is_active      = Column(Integer, default=0)
    created_at     = Column(DateTime, default=func.now())
    updated_at     = Column(DateTime, default=func.now(), onupdate=func.now())

    chapters      = relationship("AiTutorChapter",     back_populates="tutor", cascade="all, delete-orphan")
    documents     = relationship("AiTutorDocument",    back_populates="tutor", cascade="all, delete-orphan")
    transcripts   = relationship("AiTutorTranscript",  back_populates="tutor", cascade="all, delete-orphan")
    chat_sessions = relationship("AiTutorChatSession", back_populates="tutor", cascade="all, delete-orphan")


class AiTutorChapter(Base):
    __tablename__ = "ai_tutor_chapters"
    __table_args__ = (
        UniqueConstraint("tutor_id", "term", "chapter_name", name="uq_tutor_term_chapter"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    tutor_id     = Column(Integer, ForeignKey("ai_tutors.id", ondelete="CASCADE"), nullable=False)
    term         = Column(String(50))
    chapter_name = Column(String(255))
    topic        = Column(String(255))
    sort_order   = Column(Integer, default=0)
    is_unlocked  = Column(Integer, default=1)
    created_at   = Column(DateTime, default=func.now())

    tutor       = relationship("AiTutor",           back_populates="chapters")
    documents   = relationship("AiTutorDocument",   back_populates="chapter")
    transcripts = relationship("AiTutorTranscript", back_populates="chapter")


class AiTutorDocument(Base):
    __tablename__ = "ai_tutor_documents"

    id                = Column(Integer,     primary_key=True, autoincrement=True)
    tutor_id          = Column(Integer,     ForeignKey("ai_tutors.id",          ondelete="CASCADE"),   nullable=False)
    chapter_id        = Column(Integer,     ForeignKey("ai_tutor_chapters.id",  ondelete="SET NULL"),  nullable=True)
    doc_type          = Column(Enum(DocTypeEnum), default=DocTypeEnum.other)
    original_filename = Column(String(500))
    storage_path      = Column(String(500))
    file_size_bytes   = Column(BigInteger)
    mime_type         = Column(String(100))
    is_indexed        = Column(Integer, default=0)
    is_enabled        = Column(Integer, default=1)
    uploaded_by       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at        = Column(DateTime, default=func.now())
    updated_at        = Column(DateTime, default=func.now(), onupdate=func.now())

    tutor         = relationship("AiTutor",            back_populates="documents")
    chapter       = relationship("AiTutorChapter",     back_populates="documents")
    vector_chunks = relationship("AiTutorVectorChunk", back_populates="document", cascade="all, delete-orphan")


class AiTutorTranscript(Base):
    __tablename__ = "ai_tutor_transcripts"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    tutor_id            = Column(Integer, ForeignKey("ai_tutors.id",         ondelete="CASCADE"),   nullable=False)
    chapter_id          = Column(Integer, ForeignKey("ai_tutor_chapters.id", ondelete="SET NULL"),  nullable=True)
    recording_id        = Column(Integer, nullable=True)
    raw_transcript      = Column(Text(length=4294967295))   # LONGTEXT
    approved_transcript = Column(Text(length=4294967295), nullable=True)
    status              = Column(Enum(TranscriptStatusEnum), default=TranscriptStatusEnum.pending)
    reviewed_by         = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at         = Column(DateTime, nullable=True)
    is_indexed          = Column(Integer, default=0)
    is_enabled          = Column(Integer, default=1)
    created_at          = Column(DateTime, default=func.now())

    tutor         = relationship("AiTutor",            back_populates="transcripts")
    chapter       = relationship("AiTutorChapter",     back_populates="transcripts")
    vector_chunks = relationship("AiTutorVectorChunk", back_populates="transcript", cascade="all, delete-orphan")


class AiTutorChatSession(Base):
    __tablename__ = "ai_tutor_chat_sessions"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    tutor_id         = Column(Integer, ForeignKey("ai_tutors.id", ondelete="CASCADE"), nullable=False)
    student_id       = Column(Integer, ForeignKey("users.id",     ondelete="CASCADE"), nullable=False)
    mode             = Column(Enum(ChatModeEnum), default=ChatModeEnum.learn)
    started_at       = Column(DateTime, default=func.now())
    last_activity_at = Column(DateTime, default=func.now(), onupdate=func.now())

    tutor    = relationship("AiTutor",            back_populates="chat_sessions")
    messages = relationship("AiTutorChatMessage", back_populates="session", cascade="all, delete-orphan")


class AiTutorChatMessage(Base):
    __tablename__ = "ai_tutor_chat_messages"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    session_id    = Column(Integer, ForeignKey("ai_tutor_chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role          = Column(Enum(MessageRoleEnum), nullable=False)
    content       = Column(Text(length=4294967295), nullable=False)  # LONGTEXT
    sources_json  = Column(JSON, nullable=True)
    confidence    = Column(Enum(ConfidenceLevelEnum), nullable=True)
    response_type = Column(String(50), nullable=True)
    created_at    = Column(DateTime, default=func.now())

    session = relationship("AiTutorChatSession", back_populates="messages")


class AiTutorVectorChunk(Base):
    __tablename__ = "ai_tutor_vector_chunks"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    tutor_id      = Column(Integer, ForeignKey("ai_tutors.id",             ondelete="CASCADE"), nullable=False)
    document_id   = Column(Integer, ForeignKey("ai_tutor_documents.id",    ondelete="CASCADE"), nullable=True)
    transcript_id = Column(Integer, ForeignKey("ai_tutor_transcripts.id",  ondelete="CASCADE"), nullable=True)
    chunk_index   = Column(Integer)
    chunk_text    = Column(Text)
    vector_id     = Column(String(255))
    created_at    = Column(DateTime, default=func.now())

    document   = relationship("AiTutorDocument",   back_populates="vector_chunks")
    transcript = relationship("AiTutorTranscript", back_populates="vector_chunks")


class AiTutorInfographic(Base):
    """DALL-E 3 generated infographic linked to an assistant chat message.

    The concept_hash (SHA-256 of tutor_id + normalized_concept) enables
    intelligent caching: if two students ask for the same concept diagram,
    the image is generated only once.
    """
    __tablename__ = "ai_tutor_infographics"

    id                 = Column(Integer,      primary_key=True, autoincrement=True)
    tutor_id           = Column(Integer,      ForeignKey("ai_tutors.id",              ondelete="CASCADE"), nullable=False)
    message_id         = Column(Integer,      ForeignKey("ai_tutor_chat_messages.id", ondelete="CASCADE"), nullable=False)
    prompt_used        = Column(Text,         nullable=True)
    normalized_concept = Column(String(500),  nullable=True)
    concept_hash       = Column(String(64),   nullable=True, index=True)
    storage_path       = Column(String(500),  nullable=True)
    accessibility_alt  = Column(Text,         nullable=True)
    created_at         = Column(DateTime,     default=func.now())
