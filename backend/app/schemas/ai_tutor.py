"""
Pydantic v2 schemas for the AI Tutor feature.
"""

from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel


# Helper

class ClassSubjectRead(BaseModel):
    class_id:    int
    class_name:  str
    subject_id:  int
    subject_name: str


# Tutor

class CreateTutorRequest(BaseModel):
    class_id:    int
    subject_id:  int
    display_name: Optional[str] = None
    is_active:   bool = False


class UpdateTutorRequest(BaseModel):
    display_name:    Optional[str]        = None
    system_prompt:   Optional[str]        = None
    is_active:       Optional[bool]       = None
    personality:     Optional[str]        = None
    teaching_style:  Optional[str]        = None
    tone:            Optional[str]        = None
    emphasis_topics: Optional[List[str]]  = None
    icon_emoji:      Optional[str]        = None


class TutorRead(BaseModel):
    id:              int
    class_id:        int
    class_name:      str
    subject_id:      int
    subject_name:    str
    teacher_id:      int
    display_name:    Optional[str]
    system_prompt:   Optional[str]
    personality:     str = "supportive"
    teaching_style:  str = "detailed"
    tone:            str = "friendly"
    emphasis_topics: Optional[List[str]] = None
    icon_emoji:      Optional[str] = None
    is_active:       bool
    doc_count:       int = 0
    chapter_count:   int = 0
    created_at:      str

    model_config = {"from_attributes": True}


class TutorDetail(TutorRead):
    chapters:  List[ChapterRead]  = []
    documents: List[DocumentRead] = []


# Chapter

class CreateChapterRequest(BaseModel):
    term:         str
    chapter_name: str
    topic:        Optional[str] = None
    sort_order:   int = 0


class UpdateChapterRequest(BaseModel):
    term:         Optional[str]  = None
    chapter_name: Optional[str]  = None
    topic:        Optional[str]  = None
    sort_order:   Optional[int]  = None
    is_unlocked:  Optional[bool] = None


class ChapterRead(BaseModel):
    id:           int
    tutor_id:     int
    term:         Optional[str]
    chapter_name: Optional[str]
    topic:        Optional[str]
    sort_order:   int
    is_unlocked:  bool
    doc_count:    int = 0
    created_at:   str

    model_config = {"from_attributes": True}


# Document

class UpdateDocumentRequest(BaseModel):
    is_enabled: Optional[bool] = None
    chapter_id: Optional[int]  = None
    doc_type:   Optional[str]  = None


class DocumentRead(BaseModel):
    id:                int
    tutor_id:          int
    chapter_id:        Optional[int]
    chapter_name:      Optional[str]
    doc_type:          str
    original_filename: str
    file_size_bytes:   int
    mime_type:         str
    is_indexed:        bool
    is_enabled:        bool
    created_at:        str

    model_config = {"from_attributes": True}


# Transcript

class ApproveTranscriptRequest(BaseModel):
    edited_transcript: Optional[str] = None
    chapter_id:        Optional[int] = None


class TranscriptRead(BaseModel):
    id:                  int
    tutor_id:            int
    chapter_id:          Optional[int]
    raw_transcript:      Optional[str]
    approved_transcript: Optional[str]
    status:              str
    reviewed_by:         Optional[int]
    reviewed_at:         Optional[str]
    is_indexed:          bool
    is_enabled:          bool
    created_at:          str

    model_config = {"from_attributes": True}


# Chat

class ChatRequest(BaseModel):
    tutor_id:   int
    session_id: Optional[int] = None
    mode:       str = "learn"
    message:    str
    difficulty: str = "intermediate"


class SourceCitation(BaseModel):
    document_id:   Optional[int] = None
    transcript_id: Optional[int] = None
    filename:      Optional[str] = None
    doc_type:      Optional[str] = None
    chunk_text:    str
    chunk_index:   int = 0


class InfographicRead(BaseModel):
    id:                int
    tutor_id:          int
    message_id:        int
    normalized_concept: Optional[str] = None
    accessibility_alt:  Optional[str] = None
    url:               str  # served via /api/v1/ai-tutor/infographics/{id}
    created_at:        str

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    session_id:    int
    message_id:    int
    content:       str
    sources:       List[SourceCitation] = []
    confidence:    Optional[str] = None
    response_type: Optional[str] = None
    infographic:   Optional[InfographicRead] = None


class ChatMessageRead(BaseModel):
    id:            int
    session_id:    int
    role:          str
    content:       str
    sources:       List[SourceCitation] = []
    confidence:    Optional[str] = None
    response_type: Optional[str] = None
    created_at:    str


class ChatSessionRead(BaseModel):
    id:               int
    tutor_id:         int
    tutor_name:       Optional[str]
    subject_name:     str
    mode:             str
    started_at:       str
    last_activity_at: str
    message_count:    int = 0


# Exercise Variation

class ExerciseVariationRequest(BaseModel):
    tutor_id:             int
    exercise_description: str
    mode:                 str = "practice"
    difficulty:           str = "intermediate"


class ExerciseVariationResponse(BaseModel):
    content:    str
    sources:    List[SourceCitation] = []
    confidence: Optional[str] = None


# Student Discovery

class StudentTutorRead(BaseModel):
    id:            int
    class_id:      int
    class_name:    str
    subject_id:    int
    subject_name:  str
    display_name:  Optional[str]
    icon_emoji:    Optional[str] = None
    doc_count:     int = 0
    chapter_count: int = 0


# Forward references update
TutorDetail.model_rebuild()
