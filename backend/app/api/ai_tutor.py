"""
AI Tutor API — subject-specific RAG-powered tutors.
Prefix (set in main.py): /api/v1/ai-tutor
"""

import logging
import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.dependencies import require_role
from app.models.admin import Class, ClassSubject, ClassSubjectTeacher, StudentProfile, Subject
from app.models.ai_tutor import (
    AiTutor,
    AiTutorChapter,
    AiTutorChatMessage,
    AiTutorChatSession,
    AiTutorDocument,
    AiTutorInfographic,
    AiTutorTranscript,
    AiTutorVectorChunk,
    ChatModeEnum,
    ConfidenceLevelEnum,
    DocTypeEnum,
    TranscriptStatusEnum,
    MessageRoleEnum,
)
from app.models.user import User
from app.schemas.ai_tutor import (
    ApproveTranscriptRequest,
    ChatMessageRead,
    ChatRequest,
    ChatResponse,
    ChatSessionRead,
    ChapterRead,
    ClassSubjectRead,
    CreateChapterRequest,
    CreateTutorRequest,
    DocumentRead,
    ExerciseVariationRequest,
    ExerciseVariationResponse,
    InfographicRead,
    SourceCitation,
    StudentTutorRead,
    TranscriptRead,
    TutorDetail,
    TutorRead,
    UpdateChapterRequest,
    UpdateDocumentRequest,
    UpdateTutorRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_teacher = Depends(require_role("teacher"))
_student = Depends(require_role("student"))


# Upload directory

def _upload_dir(tutor_id: int) -> str:
    base = os.path.join(
        os.path.dirname(  # api/
            os.path.dirname(  # app/
                os.path.abspath(__file__)
            )
        ),
        "..", "uploads", "ai_tutor", str(tutor_id),
    )
    base = os.path.normpath(base)
    os.makedirs(base, exist_ok=True)
    return base


# Shared helpers

def _get_tutor_or_403(tutor_id: int, teacher_id: int, db: Session) -> AiTutor:
    tutor = db.query(AiTutor).filter(
        AiTutor.id == tutor_id,
        AiTutor.teacher_id == teacher_id,
    ).first()
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found or access denied.")
    return tutor


def _build_tutor_read(tutor: AiTutor, db: Session) -> TutorRead:
    doc_count     = db.query(func.count(AiTutorDocument.id)).filter(AiTutorDocument.tutor_id == tutor.id).scalar() or 0
    chapter_count = db.query(func.count(AiTutorChapter.id)).filter(AiTutorChapter.tutor_id == tutor.id).scalar() or 0
    class_   = db.query(Class).filter(Class.id == tutor.class_id).first()
    subject  = db.query(Subject).filter(Subject.id == tutor.subject_id).first()
    return TutorRead(
        id=tutor.id,
        class_id=tutor.class_id,
        class_name=class_.name if class_ else "—",
        subject_id=tutor.subject_id,
        subject_name=subject.name if subject else "—",
        teacher_id=tutor.teacher_id,
        display_name=tutor.display_name,
        system_prompt=tutor.system_prompt,
        personality=tutor.personality.value if tutor.personality else "supportive",
        teaching_style=tutor.teaching_style.value if tutor.teaching_style else "detailed",
        tone=tutor.tone.value if tutor.tone else "friendly",
        emphasis_topics=tutor.emphasis_topics,
        icon_emoji=tutor.icon_emoji,
        is_active=bool(tutor.is_active),
        doc_count=doc_count,
        chapter_count=chapter_count,
        created_at=tutor.created_at.isoformat() if tutor.created_at else "",
    )


def _build_chapter_read(chapter: AiTutorChapter, db: Session) -> ChapterRead:
    doc_count = db.query(func.count(AiTutorDocument.id)).filter(AiTutorDocument.chapter_id == chapter.id).scalar() or 0
    return ChapterRead(
        id=chapter.id,
        tutor_id=chapter.tutor_id,
        term=chapter.term,
        chapter_name=chapter.chapter_name,
        topic=chapter.topic,
        sort_order=chapter.sort_order or 0,
        is_unlocked=bool(chapter.is_unlocked),
        doc_count=doc_count,
        created_at=chapter.created_at.isoformat() if chapter.created_at else "",
    )


def _build_document_read(doc: AiTutorDocument, db: Session) -> DocumentRead:
    chapter = (
        db.query(AiTutorChapter).filter(AiTutorChapter.id == doc.chapter_id).first()
        if doc.chapter_id else None
    )
    return DocumentRead(
        id=doc.id,
        tutor_id=doc.tutor_id,
        chapter_id=doc.chapter_id,
        chapter_name=chapter.chapter_name if chapter else None,
        doc_type=doc.doc_type.value if doc.doc_type else "other",
        original_filename=doc.original_filename or "",
        file_size_bytes=doc.file_size_bytes or 0,
        mime_type=doc.mime_type or "",
        is_indexed=bool(doc.is_indexed),
        is_enabled=bool(doc.is_enabled),
        created_at=doc.created_at.isoformat() if doc.created_at else "",
    )


def _build_transcript_read(tr: AiTutorTranscript) -> TranscriptRead:
    return TranscriptRead(
        id=tr.id,
        tutor_id=tr.tutor_id,
        chapter_id=tr.chapter_id,
        raw_transcript=tr.raw_transcript,
        approved_transcript=tr.approved_transcript,
        status=tr.status.value if tr.status else "pending",
        reviewed_by=tr.reviewed_by,
        reviewed_at=tr.reviewed_at.isoformat() if tr.reviewed_at else None,
        is_indexed=bool(tr.is_indexed),
        is_enabled=bool(tr.is_enabled),
        created_at=tr.created_at.isoformat() if tr.created_at else "",
    )


# Background tasks

def _ingest_document_bg(doc_id: int) -> None:
    from app.services.ai_tutor.document_ingestion import ingest_document
    db = SessionLocal()
    try:
        doc = db.query(AiTutorDocument).filter(AiTutorDocument.id == doc_id).first()
        if doc:
            ingest_document(doc, db)
    except Exception as e:
        logger.error(f"Background ingestion failed for document {doc_id}: {e}")
    finally:
        db.close()


def _ingest_transcript_bg(transcript_id: int) -> None:
    from app.services.ai_tutor.document_ingestion import ingest_transcript
    db = SessionLocal()
    try:
        tr = db.query(AiTutorTranscript).filter(AiTutorTranscript.id == transcript_id).first()
        if tr:
            ingest_transcript(tr, db)
    except Exception as e:
        logger.error(f"Background ingestion failed for transcript {transcript_id}: {e}")
    finally:
        db.close()


# Teacher: class-subject discovery

@router.get("/teacher/class-subjects", response_model=List[ClassSubjectRead])
def get_teacher_class_subjects(
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    """Return all class-subject pairs the current teacher is assigned to teach."""
    rows = db.query(ClassSubjectTeacher).filter(ClassSubjectTeacher.teacher_id == me.id).all()
    result = []
    for row in rows:
        class_  = db.query(Class).filter(Class.id == row.class_id).first()
        subject = db.query(Subject).filter(Subject.id == row.subject_id).first()
        if class_ and subject:
            result.append(ClassSubjectRead(
                class_id=row.class_id,
                class_name=class_.name,
                subject_id=row.subject_id,
                subject_name=subject.name,
            ))
    return result


# Teacher: Tutor CRUD

@router.post("/tutors/", response_model=TutorRead)
def create_tutor(
    body: CreateTutorRequest,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    cst = db.query(ClassSubjectTeacher).filter(
        ClassSubjectTeacher.teacher_id == me.id,
        ClassSubjectTeacher.class_id   == body.class_id,
        ClassSubjectTeacher.subject_id == body.subject_id,
    ).first()
    if not cst:
        raise HTTPException(status_code=403, detail="You are not assigned to teach this class-subject.")

    existing = db.query(AiTutor).filter(
        AiTutor.class_id   == body.class_id,
        AiTutor.subject_id == body.subject_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A tutor already exists for this class-subject.")

    class_  = db.query(Class).filter(Class.id == body.class_id).first()
    subject = db.query(Subject).filter(Subject.id == body.subject_id).first()
    display_name = body.display_name or (
        f"{class_.name if class_ else 'Class'} – {subject.name if subject else 'Subject'} Tutor"
    )

    tutor = AiTutor(
        class_id=body.class_id,
        subject_id=body.subject_id,
        teacher_id=me.id,
        display_name=display_name,
        is_active=1 if body.is_active else 0,
    )
    db.add(tutor)
    db.commit()
    db.refresh(tutor)
    return _build_tutor_read(tutor, db)


@router.get("/tutors/", response_model=List[TutorRead])
def list_tutors(
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tutors = db.query(AiTutor).filter(AiTutor.teacher_id == me.id).order_by(AiTutor.created_at.desc()).all()
    return [_build_tutor_read(t, db) for t in tutors]


@router.get("/tutors/{tutor_id}", response_model=TutorDetail)
def get_tutor(
    tutor_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tutor    = _get_tutor_or_403(tutor_id, me.id, db)
    base     = _build_tutor_read(tutor, db)
    chapters = db.query(AiTutorChapter).filter(AiTutorChapter.tutor_id == tutor_id).order_by(AiTutorChapter.sort_order, AiTutorChapter.id).all()
    docs     = db.query(AiTutorDocument).filter(AiTutorDocument.tutor_id == tutor_id).order_by(AiTutorDocument.created_at.desc()).all()
    return TutorDetail(
        **base.model_dump(),
        chapters=[_build_chapter_read(c, db) for c in chapters],
        documents=[_build_document_read(d, db) for d in docs],
    )


@router.patch("/tutors/{tutor_id}", response_model=TutorRead)
def update_tutor(
    tutor_id: int,
    body: UpdateTutorRequest,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tutor = _get_tutor_or_403(tutor_id, me.id, db)
    if body.display_name    is not None: tutor.display_name    = body.display_name
    if body.system_prompt   is not None: tutor.system_prompt   = body.system_prompt
    if body.is_active       is not None: tutor.is_active       = 1 if body.is_active else 0
    if body.personality     is not None: tutor.personality     = body.personality
    if body.teaching_style  is not None: tutor.teaching_style  = body.teaching_style
    if body.tone            is not None: tutor.tone            = body.tone
    if body.emphasis_topics is not None: tutor.emphasis_topics = body.emphasis_topics
    if body.icon_emoji      is not None: tutor.icon_emoji      = body.icon_emoji
    db.commit()
    db.refresh(tutor)
    return _build_tutor_read(tutor, db)


@router.delete("/tutors/{tutor_id}", status_code=204)
def delete_tutor(
    tutor_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tutor = _get_tutor_or_403(tutor_id, me.id, db)
    try:
        from app.services.ai_tutor import vector_index_manager as vim
        vim.delete_collection(tutor_id)
    except Exception:
        pass
    try:
        shutil.rmtree(_upload_dir(tutor_id), ignore_errors=True)
    except Exception:
        pass
    db.delete(tutor)
    db.commit()
    return Response(status_code=204)


# Teacher: Chapter CRUD

@router.post("/tutors/{tutor_id}/chapters/", response_model=ChapterRead)
def create_chapter(
    tutor_id: int,
    body: CreateChapterRequest,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    _get_tutor_or_403(tutor_id, me.id, db)
    chapter = AiTutorChapter(
        tutor_id=tutor_id,
        term=body.term,
        chapter_name=body.chapter_name,
        topic=body.topic,
        sort_order=body.sort_order,
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return _build_chapter_read(chapter, db)


@router.get("/tutors/{tutor_id}/chapters/", response_model=List[ChapterRead])
def list_chapters(
    tutor_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    _get_tutor_or_403(tutor_id, me.id, db)
    chapters = db.query(AiTutorChapter).filter(
        AiTutorChapter.tutor_id == tutor_id
    ).order_by(AiTutorChapter.sort_order, AiTutorChapter.id).all()
    return [_build_chapter_read(c, db) for c in chapters]


@router.patch("/chapters/{chapter_id}", response_model=ChapterRead)
def update_chapter(
    chapter_id: int,
    body: UpdateChapterRequest,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    chapter = db.query(AiTutorChapter).filter(AiTutorChapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found.")
    _get_tutor_or_403(chapter.tutor_id, me.id, db)
    if body.term         is not None: chapter.term         = body.term
    if body.chapter_name is not None: chapter.chapter_name = body.chapter_name
    if body.topic        is not None: chapter.topic        = body.topic
    if body.sort_order   is not None: chapter.sort_order   = body.sort_order
    if body.is_unlocked  is not None: chapter.is_unlocked  = 1 if body.is_unlocked else 0
    db.commit()
    db.refresh(chapter)
    return _build_chapter_read(chapter, db)


@router.delete("/chapters/{chapter_id}", status_code=204)
def delete_chapter(
    chapter_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    chapter = db.query(AiTutorChapter).filter(AiTutorChapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found.")
    _get_tutor_or_403(chapter.tutor_id, me.id, db)
    db.delete(chapter)
    db.commit()
    return Response(status_code=204)


# Teacher: Document management

@router.post("/tutors/{tutor_id}/documents/", response_model=List[DocumentRead])
async def upload_documents(
    tutor_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    doc_type: str = Form(default="other"),
    chapter_id: Optional[int] = Form(default=None),
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    _get_tutor_or_403(tutor_id, me.id, db)
    upload_path = _upload_dir(tutor_id)
    created: List[AiTutorDocument] = []

    for file in files:
        safe_name = (file.filename or "upload").replace("/", "_").replace("\\", "_")
        ts   = int(datetime.now(timezone.utc).timestamp())
        dest = os.path.join(upload_path, f"{ts}_{safe_name}")

        content = await file.read()
        with open(dest, "wb") as fh:
            fh.write(content)

        doc = AiTutorDocument(
            tutor_id=tutor_id,
            chapter_id=chapter_id,
            doc_type=doc_type,
            original_filename=file.filename,
            storage_path=dest,
            file_size_bytes=len(content),
            mime_type=file.content_type or "application/octet-stream",
            uploaded_by=me.id,
        )
        db.add(doc)
        db.flush()
        background_tasks.add_task(_ingest_document_bg, doc.id)
        created.append(doc)

    db.commit()
    return [_build_document_read(d, db) for d in created]


@router.get("/tutors/{tutor_id}/documents/", response_model=List[DocumentRead])
def list_documents(
    tutor_id: int,
    chapter_id: Optional[int] = Query(None),
    doc_type: Optional[str] = Query(None),
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    _get_tutor_or_403(tutor_id, me.id, db)
    q = db.query(AiTutorDocument).filter(AiTutorDocument.tutor_id == tutor_id)
    if chapter_id is not None:
        q = q.filter(AiTutorDocument.chapter_id == chapter_id)
    if doc_type:
        q = q.filter(AiTutorDocument.doc_type == doc_type)
    return [_build_document_read(d, db) for d in q.order_by(AiTutorDocument.created_at.desc()).all()]


@router.patch("/documents/{doc_id}", response_model=DocumentRead)
def update_document(
    doc_id: int,
    body: UpdateDocumentRequest,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    doc = db.query(AiTutorDocument).filter(AiTutorDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    _get_tutor_or_403(doc.tutor_id, me.id, db)
    if body.is_enabled is not None: doc.is_enabled = 1 if body.is_enabled else 0
    if body.chapter_id is not None: doc.chapter_id = body.chapter_id
    if body.doc_type   is not None: doc.doc_type   = body.doc_type
    db.commit()
    db.refresh(doc)
    return _build_document_read(doc, db)


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    doc = db.query(AiTutorDocument).filter(AiTutorDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    _get_tutor_or_403(doc.tutor_id, me.id, db)

    from app.services.ai_tutor.document_ingestion import remove_document_chunks
    remove_document_chunks(doc, db)

    if doc.storage_path and os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return Response(status_code=204)


# Teacher: Transcript workflow

@router.get("/tutors/{tutor_id}/transcripts/", response_model=List[TranscriptRead])
def list_transcripts(
    tutor_id: int,
    status: Optional[str] = Query(None),
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    _get_tutor_or_403(tutor_id, me.id, db)
    q = db.query(AiTutorTranscript).filter(AiTutorTranscript.tutor_id == tutor_id)
    if status:
        q = q.filter(AiTutorTranscript.status == status)
    return [_build_transcript_read(tr) for tr in q.order_by(AiTutorTranscript.created_at.desc()).all()]


@router.get("/transcripts/{transcript_id}", response_model=TranscriptRead)
def get_transcript(
    transcript_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tr = db.query(AiTutorTranscript).filter(AiTutorTranscript.id == transcript_id).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    _get_tutor_or_403(tr.tutor_id, me.id, db)
    return _build_transcript_read(tr)


@router.post("/transcripts/{transcript_id}/approve", response_model=TranscriptRead)
def approve_transcript(
    transcript_id: int,
    body: ApproveTranscriptRequest,
    background_tasks: BackgroundTasks,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tr = db.query(AiTutorTranscript).filter(AiTutorTranscript.id == transcript_id).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    _get_tutor_or_403(tr.tutor_id, me.id, db)

    tr.status              = TranscriptStatusEnum.approved
    tr.reviewed_by         = me.id
    tr.reviewed_at         = datetime.now(timezone.utc)
    tr.approved_transcript = body.edited_transcript or tr.raw_transcript
    if body.chapter_id:
        tr.chapter_id = body.chapter_id

    db.commit()
    db.refresh(tr)
    background_tasks.add_task(_ingest_transcript_bg, tr.id)
    return _build_transcript_read(tr)


@router.post("/transcripts/{transcript_id}/reject", status_code=204)
def reject_transcript(
    transcript_id: int,
    me: User = _teacher,
    db: Session = Depends(get_db),
):
    tr = db.query(AiTutorTranscript).filter(AiTutorTranscript.id == transcript_id).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    _get_tutor_or_403(tr.tutor_id, me.id, db)

    tr.status      = TranscriptStatusEnum.rejected
    tr.reviewed_by = me.id
    tr.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=204)


# Student: tutor discovery

def _get_student_class_id(student_id: int, db: Session) -> Optional[int]:
    sp = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
    return sp.class_id if sp else None


@router.get("/student/tutors/", response_model=List[StudentTutorRead])
def get_student_tutors(
    me: User = _student,
    db: Session = Depends(get_db),
):
    """Return all active tutors available to the current student."""
    class_id = _get_student_class_id(me.id, db)
    if not class_id:
        return []
    tutors = db.query(AiTutor).filter(
        AiTutor.class_id  == class_id,
        AiTutor.is_active == 1,
    ).all()
    result = []
    for tutor in tutors:
        subject = db.query(Subject).filter(Subject.id == tutor.subject_id).first()
        class_  = db.query(Class).filter(Class.id == tutor.class_id).first()
        doc_count     = db.query(func.count(AiTutorDocument.id)).filter(AiTutorDocument.tutor_id == tutor.id, AiTutorDocument.is_enabled == 1).scalar() or 0
        chapter_count = db.query(func.count(AiTutorChapter.id)).filter(AiTutorChapter.tutor_id == tutor.id).scalar() or 0
        result.append(StudentTutorRead(
            id=tutor.id,
            class_id=tutor.class_id,
            class_name=class_.name if class_ else "—",
            subject_id=tutor.subject_id,
            subject_name=subject.name if subject else "—",
            display_name=tutor.display_name,
            icon_emoji=tutor.icon_emoji,
            doc_count=doc_count,
            chapter_count=chapter_count,
        ))
    return result


# Student: chat

@router.post("/student/chat/", response_model=ChatResponse)
def student_chat(
    body: ChatRequest,
    me: User = _student,
    db: Session = Depends(get_db),
):
    # Verify access
    class_id = _get_student_class_id(me.id, db)
    tutor = db.query(AiTutor).filter(
        AiTutor.id       == body.tutor_id,
        AiTutor.class_id == class_id,
        AiTutor.is_active == 1,
    ).first()
    if not tutor:
        raise HTTPException(status_code=403, detail="Tutor not found or access denied.")

    # Get or create session
    session: Optional[AiTutorChatSession] = None
    if body.session_id:
        session = db.query(AiTutorChatSession).filter(
            AiTutorChatSession.id         == body.session_id,
            AiTutorChatSession.student_id == me.id,
        ).first()
    if not session:
        try:
            mode_enum = ChatModeEnum(body.mode)
        except ValueError:
            mode_enum = ChatModeEnum.learn
        session = AiTutorChatSession(
            tutor_id=body.tutor_id,
            student_id=me.id,
            mode=mode_enum,
        )
        db.add(session)
        db.flush()

    # Load recent history
    recent_msgs = (
        db.query(AiTutorChatMessage)
        .filter(AiTutorChatMessage.session_id == session.id)
        .order_by(AiTutorChatMessage.created_at.desc())
        .limit(20)
        .all()
    )
    history = [
        {
            "role": m.role.value if hasattr(m.role, "value") else m.role,
            "content": m.content,
        }
        for m in reversed(recent_msgs)
    ]

    # Save student message
    user_msg = AiTutorChatMessage(
        session_id=session.id,
        role=MessageRoleEnum.user,
        content=body.message,
    )
    db.add(user_msg)
    db.flush()

    # Run RAG
    confidence = "medium"
    visual_intent = None
    try:
        from app.services.ai_tutor.rag_engine import run_rag_query
        response_text, sources, confidence, visual_intent = run_rag_query(
            tutor_id=body.tutor_id,
            student_message=body.message,
            mode=body.mode,
            history=history,
            custom_system_prompt=tutor.system_prompt,
            difficulty=body.difficulty,
            personality=tutor.personality.value if tutor.personality else "supportive",
            teaching_style=tutor.teaching_style.value if tutor.teaching_style else "detailed",
            tone=tutor.tone.value if tutor.tone else "friendly",
            emphasis_topics=tutor.emphasis_topics,
        )
    except Exception as e:
        logger.error(f"RAG query failed for tutor {body.tutor_id}: {e}")
        response_text = (
            "I'm having trouble accessing the course materials right now. "
            f"Please check that the OPENAI_API_KEY is configured and ChromaDB is installed. "
            f"(Error: {type(e).__name__}: {str(e)[:120]})"
        )
        sources = []
        confidence = "low"

    # Save assistant message
    try:
        conf_enum = ConfidenceLevelEnum(confidence)
    except ValueError:
        conf_enum = None

    assistant_msg = AiTutorChatMessage(
        session_id=session.id,
        role=MessageRoleEnum.assistant,
        content=response_text,
        sources_json=sources if sources else None,
        confidence=conf_enum,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    # Generate infographic if RAG detected visual intent
    infographic_read: Optional[InfographicRead] = None
    if visual_intent:
        try:
            from app.services.ai_tutor.infographic_service import generate_or_reuse
            infographic = generate_or_reuse(
                tutor_id=body.tutor_id,
                message_id=assistant_msg.id,
                visual_intent=visual_intent,
                db=db,
            )
            if infographic:
                infographic_read = InfographicRead(
                    id=infographic.id,
                    tutor_id=infographic.tutor_id,
                    message_id=infographic.message_id,
                    normalized_concept=infographic.normalized_concept,
                    accessibility_alt=infographic.accessibility_alt,
                    url=f"/ai-tutor/infographics/{infographic.id}",
                    created_at=infographic.created_at.isoformat() if infographic.created_at else "",
                )
        except Exception as e:
            logger.warning(f"Infographic generation failed (non-fatal): {e}")

    return ChatResponse(
        session_id=session.id,
        message_id=assistant_msg.id,
        content=response_text,
        sources=[SourceCitation(**s) for s in sources],
        confidence=confidence,
        infographic=infographic_read,
    )


@router.get("/student/sessions/", response_model=List[ChatSessionRead])
def list_student_sessions(
    me: User = _student,
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AiTutorChatSession)
        .filter(AiTutorChatSession.student_id == me.id)
        .order_by(AiTutorChatSession.last_activity_at.desc())
        .limit(20)
        .all()
    )
    result = []
    for s in sessions:
        tutor   = db.query(AiTutor).filter(AiTutor.id == s.tutor_id).first()
        subject = db.query(Subject).filter(Subject.id == tutor.subject_id).first() if tutor else None
        msg_count = db.query(func.count(AiTutorChatMessage.id)).filter(AiTutorChatMessage.session_id == s.id).scalar() or 0
        result.append(ChatSessionRead(
            id=s.id,
            tutor_id=s.tutor_id,
            tutor_name=tutor.display_name if tutor else None,
            subject_name=subject.name if subject else "—",
            mode=s.mode.value if hasattr(s.mode, "value") else s.mode,
            started_at=s.started_at.isoformat() if s.started_at else "",
            last_activity_at=s.last_activity_at.isoformat() if s.last_activity_at else "",
            message_count=msg_count,
        ))
    return result


@router.get("/student/sessions/{session_id}/messages", response_model=List[ChatMessageRead])
def get_session_messages(
    session_id: int,
    me: User = _student,
    db: Session = Depends(get_db),
):
    session = db.query(AiTutorChatSession).filter(
        AiTutorChatSession.id         == session_id,
        AiTutorChatSession.student_id == me.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    msgs = (
        db.query(AiTutorChatMessage)
        .filter(AiTutorChatMessage.session_id == session_id)
        .order_by(AiTutorChatMessage.created_at)
        .all()
    )
    return [
        ChatMessageRead(
            id=m.id,
            session_id=m.session_id,
            role=m.role.value if hasattr(m.role, "value") else m.role,
            content=m.content,
            sources=[SourceCitation(**s) for s in (m.sources_json or [])],
            confidence=m.confidence.value if m.confidence else None,
            response_type=m.response_type,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in msgs
    ]


# Student: exercise variation

@router.post("/student/exercise-variation/", response_model=ExerciseVariationResponse)
def exercise_variation(
    body: ExerciseVariationRequest,
    me: User = _student,
    db: Session = Depends(get_db),
):
    """Generate a variation of an exercise based on class materials."""
    class_id = _get_student_class_id(me.id, db)
    tutor = db.query(AiTutor).filter(
        AiTutor.id       == body.tutor_id,
        AiTutor.class_id == class_id,
        AiTutor.is_active == 1,
    ).first()
    if not tutor:
        raise HTTPException(status_code=403, detail="Tutor not found or access denied.")

    prompt = (
        f"Generate a DIFFERENT but similar exercise on the same topic as: "
        f"'{body.exercise_description}'. "
        f"Use different numbers, variables, or scenario while keeping the same concept. "
        f"Format it the same way (## Exercise, hints, ## Solution)."
    )
    try:
        from app.services.ai_tutor.rag_engine import run_rag_query
        response_text, sources, confidence, _visual = run_rag_query(
            tutor_id=body.tutor_id,
            student_message=prompt,
            mode=body.mode,
            history=[],
            custom_system_prompt=tutor.system_prompt,
            difficulty=body.difficulty,
            personality=tutor.personality.value if tutor.personality else "supportive",
            teaching_style=tutor.teaching_style.value if tutor.teaching_style else "detailed",
            tone=tutor.tone.value if tutor.tone else "friendly",
            emphasis_topics=tutor.emphasis_topics,
        )
    except Exception as e:
        logger.error(f"Exercise variation failed for tutor {body.tutor_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return ExerciseVariationResponse(
        content=response_text,
        sources=[SourceCitation(**s) for s in sources],
        confidence=confidence,
    )


# Infographic: serve PNG

@router.get("/infographics/{infographic_id}")
def serve_infographic(
    infographic_id: int,
    me: User = _student,
    db: Session = Depends(get_db),
):
    """Serve a generated infographic PNG.  Only the owning student may access it."""
    infographic = db.query(AiTutorInfographic).filter(
        AiTutorInfographic.id == infographic_id,
    ).first()
    if not infographic:
        raise HTTPException(status_code=404, detail="Infographic not found.")

    # Verify the student owns the chat session linked to this message
    msg = db.query(AiTutorChatMessage).filter(
        AiTutorChatMessage.id == infographic.message_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Infographic not found.")
    session = db.query(AiTutorChatSession).filter(
        AiTutorChatSession.id         == msg.session_id,
        AiTutorChatSession.student_id == me.id,
    ).first()
    if not session:
        raise HTTPException(status_code=403, detail="Access denied.")

    if not infographic.storage_path or not os.path.isfile(infographic.storage_path):
        raise HTTPException(status_code=404, detail="Image file not found.")

    return FileResponse(
        path=infographic.storage_path,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Accessibility-Alt": infographic.accessibility_alt or "",
        },
    )
