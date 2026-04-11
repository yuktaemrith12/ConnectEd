"""
Homework API — Teacher CRUD + Student checklist.
Prefix (set in main.py): /api/v1/homework
"""

import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.admin import (
    Class, ClassSubjectTeacher, StudentProfile, Subject,
)
from app.models.extensions import (
    Homework, HomeworkAttachment, HomeworkCompletion,
    HomeworkStatusEnum,
)
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

_teacher = Depends(require_role("teacher"))
_student = Depends(require_role("student"))

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "homework")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "jpg", "jpeg", "png", "gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# Helpers

def _hw_to_dict(hw: Homework, student_id: int | None = None) -> dict:
    """Serialize a Homework ORM instance to a dict."""
    completion = None
    if student_id:
        completion = next(
            (c for c in hw.completions if c.student_id == student_id), None
        )

    return {
        "id": hw.id,
        "class_id": hw.class_id,
        "class_name": hw.class_.name if hw.class_ else None,
        "subject_id": hw.subject_id,
        "subject_name": hw.subject.name if hw.subject else None,
        "teacher_id": hw.teacher_id,
        "teacher_name": hw.teacher.full_name if hw.teacher else None,
        "title": hw.title,
        "instructions": hw.instructions,
        "due_at": hw.due_at.isoformat() if hw.due_at else None,
        "status": hw.status.value if hw.status else "DRAFT",
        "created_at": hw.created_at.isoformat() if hw.created_at else None,
        "updated_at": hw.updated_at.isoformat() if hw.updated_at else None,
        "attachments": [
            {
                "id": a.id,
                "file_name": a.file_name,
                "file_type": a.file_type,
                "file_size": a.file_size,
                "file_url": f"/uploads/homework/{os.path.basename(a.file_path)}",
            }
            for a in hw.attachments
        ],
        "is_done": completion.is_done if completion else False,
        "done_at": completion.done_at.isoformat() if completion and completion.done_at else None,
    }


def _get_teacher_class_ids(teacher_id: int, db: Session) -> set[int]:
    """Get the set of class IDs the teacher is mapped to via class_subject_teachers."""
    rows = (
        db.query(ClassSubjectTeacher.class_id)
        .filter(ClassSubjectTeacher.teacher_id == teacher_id)
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def _get_teacher_class_subject_pairs(teacher_id: int, db: Session) -> set[tuple[int, int]]:
    """Get valid (class_id, subject_id) pairs for a teacher."""
    rows = (
        db.query(ClassSubjectTeacher.class_id, ClassSubjectTeacher.subject_id)
        .filter(ClassSubjectTeacher.teacher_id == teacher_id)
        .all()
    )
    return {(r[0], r[1]) for r in rows}


# Teacher Endpoints

@router.get("/teacher")
def teacher_list_homework(
    class_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /homework/teacher — list homework created by this teacher."""
    q = (
        db.query(Homework)
        .options(joinedload(Homework.attachments), joinedload(Homework.class_), joinedload(Homework.subject), joinedload(Homework.teacher))
        .filter(Homework.teacher_id == current_user.id)
    )
    if class_id:
        q = q.filter(Homework.class_id == class_id)
    if subject_id:
        q = q.filter(Homework.subject_id == subject_id)
    if status:
        q = q.filter(Homework.status == status.upper())
    items = q.order_by(Homework.created_at.desc()).all()
    return [_hw_to_dict(hw) for hw in items]


@router.post("/teacher")
async def teacher_create_homework(
    class_id: int = Query(...),
    subject_id: int = Query(...),
    title: str = Query(...),
    instructions: Optional[str] = Query(None),
    due_date: Optional[str] = Query(None),
    due_time: Optional[str] = Query(None),
    publish: bool = Query(False),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """POST /homework/teacher — create homework with optional files."""
    # Validate teacher teaches this class-subject
    valid_pairs = _get_teacher_class_subject_pairs(current_user.id, db)
    if (class_id, subject_id) not in valid_pairs:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to teach this subject in this class.",
        )

    # Parse due_at
    due_at = None
    if due_date:
        time_str = due_time or "23:59"
        try:
            due_at = datetime.strptime(f"{due_date} {time_str}", "%Y-%m-%d %H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date/time format. Use YYYY-MM-DD and HH:MM.")

    hw = Homework(
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=current_user.id,
        title=title,
        instructions=instructions,
        due_at=due_at,
        status=HomeworkStatusEnum.PUBLISHED if publish else HomeworkStatusEnum.DRAFT,
    )
    db.add(hw)
    db.flush()  # get hw.id

    # Handle file uploads
    for f in files:
        ext = f.filename.rsplit(".", 1)[-1].lower() if f.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type '.{ext}' is not allowed.")

        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{f.filename}' exceeds 10MB limit.")

        unique_name = f"{uuid.uuid4().hex}_{f.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)
        with open(file_path, "wb") as out:
            out.write(content)

        db.add(HomeworkAttachment(
            homework_id=hw.id,
            file_name=f.filename or "untitled",
            file_type=f.content_type or "application/octet-stream",
            file_size=len(content),
            file_path=file_path,
        ))

    db.commit()
    db.refresh(hw)
    return _hw_to_dict(hw)


@router.put("/teacher/{homework_id}")
async def teacher_update_homework(
    homework_id: int,
    title: Optional[str] = Query(None),
    instructions: Optional[str] = Query(None),
    due_date: Optional[str] = Query(None),
    due_time: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """PUT /homework/teacher/{id} — update homework."""
    hw = (
        db.query(Homework)
        .options(joinedload(Homework.attachments), joinedload(Homework.class_), joinedload(Homework.subject), joinedload(Homework.teacher))
        .filter(Homework.id == homework_id, Homework.teacher_id == current_user.id)
        .first()
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found.")

    if title is not None:
        hw.title = title
    if instructions is not None:
        hw.instructions = instructions
    if due_date is not None:
        time_str = due_time or "23:59"
        try:
            hw.due_at = datetime.strptime(f"{due_date} {time_str}", "%Y-%m-%d %H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date/time format.")
    if status is not None:
        hw.status = HomeworkStatusEnum(status.upper())

    # Handle new file uploads
    for f in files:
        ext = f.filename.rsplit(".", 1)[-1].lower() if f.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type '.{ext}' is not allowed.")

        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{f.filename}' exceeds 10MB limit.")

        unique_name = f"{uuid.uuid4().hex}_{f.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)
        with open(file_path, "wb") as out:
            out.write(content)

        db.add(HomeworkAttachment(
            homework_id=hw.id,
            file_name=f.filename or "untitled",
            file_type=f.content_type or "application/octet-stream",
            file_size=len(content),
            file_path=file_path,
        ))

    db.commit()
    db.refresh(hw)
    return _hw_to_dict(hw)


@router.delete("/teacher/{homework_id}")
def teacher_delete_homework(
    homework_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """DELETE /homework/teacher/{id} — delete homework and its attachments."""
    hw = db.query(Homework).filter(
        Homework.id == homework_id,
        Homework.teacher_id == current_user.id,
    ).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found.")

    # Delete physical files
    for att in hw.attachments:
        try:
            if os.path.exists(att.file_path):
                os.remove(att.file_path)
        except OSError:
            pass

    db.delete(hw)
    db.commit()
    return {"detail": "Homework deleted."}


@router.post("/teacher/{homework_id}/publish")
def teacher_publish_homework(
    homework_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """POST /homework/teacher/{id}/publish — publish a draft."""
    hw = db.query(Homework).filter(
        Homework.id == homework_id,
        Homework.teacher_id == current_user.id,
    ).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found.")
    if hw.status == HomeworkStatusEnum.PUBLISHED:
        raise HTTPException(status_code=400, detail="Homework is already published.")

    hw.status = HomeworkStatusEnum.PUBLISHED
    db.commit()
    db.refresh(hw)
    return _hw_to_dict(hw)


@router.delete("/teacher/attachments/{attachment_id}")
def teacher_delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """DELETE /homework/teacher/attachments/{id} — remove a single attachment."""
    att = (
        db.query(HomeworkAttachment)
        .join(Homework, Homework.id == HomeworkAttachment.homework_id)
        .filter(
            HomeworkAttachment.id == attachment_id,
            Homework.teacher_id == current_user.id,
        )
        .first()
    )
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    try:
        if os.path.exists(att.file_path):
            os.remove(att.file_path)
    except OSError:
        pass

    db.delete(att)
    db.commit()
    return {"detail": "Attachment deleted."}


# Teacher helper: Classes & Subjects I teach

@router.get("/teacher/my-classes")
def teacher_homework_classes(
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /homework/teacher/my-classes — classes + subjects the teacher is assigned to."""
    rows = (
        db.query(ClassSubjectTeacher)
        .filter(ClassSubjectTeacher.teacher_id == current_user.id)
        .all()
    )
    classes: dict[int, dict] = {}
    for r in rows:
        cls = db.query(Class).filter(Class.id == r.class_id).first()
        subj = db.query(Subject).filter(Subject.id == r.subject_id).first()
        if not cls or not subj:
            continue
        if cls.id not in classes:
            classes[cls.id] = {"id": cls.id, "name": cls.name, "subjects": []}
        classes[cls.id]["subjects"].append({"id": subj.id, "name": subj.name})
    return list(classes.values())


# Student Endpoints

@router.get("/student")
def student_list_homework(
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _student,
):
    """GET /homework/student — list PUBLISHED homework for the student's class."""
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile or not profile.class_id:
        return []

    q = (
        db.query(Homework)
        .options(
            joinedload(Homework.attachments),
            joinedload(Homework.completions),
            joinedload(Homework.class_),
            joinedload(Homework.subject),
            joinedload(Homework.teacher),
        )
        .filter(
            Homework.class_id == profile.class_id,
            Homework.status == HomeworkStatusEnum.PUBLISHED,
        )
    )
    if subject_id:
        q = q.filter(Homework.subject_id == subject_id)

    # MySQL doesn't support NULLS LAST — use CASE to push NULLs to the end
    from sqlalchemy import case
    items = q.order_by(
        case((Homework.due_at.is_(None), 1), else_=0),
        Homework.due_at.asc(),
        Homework.created_at.desc(),
    ).all()
    return [_hw_to_dict(hw, student_id=current_user.id) for hw in items]


@router.post("/student/{homework_id}/toggle")
def student_toggle_homework(
    homework_id: int,
    db: Session = Depends(get_db),
    current_user: User = _student,
):
    """POST /homework/student/{id}/toggle — mark homework as done/undone."""
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile or not profile.class_id:
        raise HTTPException(status_code=403, detail="Student profile not found.")

    hw = db.query(Homework).filter(
        Homework.id == homework_id,
        Homework.class_id == profile.class_id,
        Homework.status == HomeworkStatusEnum.PUBLISHED,
    ).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found or not published.")

    # Lazy create or toggle
    completion = db.query(HomeworkCompletion).filter(
        HomeworkCompletion.homework_id == homework_id,
        HomeworkCompletion.student_id == current_user.id,
    ).first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if completion:
        completion.is_done = not completion.is_done
        completion.done_at = now if completion.is_done else None
    else:
        completion = HomeworkCompletion(
            homework_id=homework_id,
            student_id=current_user.id,
            is_done=True,
            done_at=now,
        )
        db.add(completion)

    db.commit()
    return {
        "homework_id": homework_id,
        "is_done": completion.is_done,
        "done_at": completion.done_at.isoformat() if completion.done_at else None,
    }
