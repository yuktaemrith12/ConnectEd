"""
Assignments + Grading API
Prefix (set in main.py): /api/v1/assignments

Teacher routes:
  GET    /assignments/teacher              — list assignments for this teacher
  POST   /assignments/teacher              — create assignment (multipart)
  PUT    /assignments/teacher/{id}         — update assignment
  DELETE /assignments/teacher/{id}         — delete assignment
  POST   /assignments/teacher/{id}/publish — activate assignment (DRAFT→ACTIVE)
  POST   /assignments/teacher/{id}/close   — close submissions (ACTIVE→CLOSED)
  DELETE /assignments/teacher/attachments/{id}  — remove attachment
  GET    /assignments/teacher/my-classes   — classes+subjects the teacher teaches

  GET    /assignments/{id}/submissions     — list all student submissions
  POST   /grading/manual                   — save a grade/feedback for one submission
  POST   /grading/onsite                   — grade on-site student (creates submission if needed)
  POST   /grading/ai-review/{id}           — trigger AI review for all online submissions
  POST   /grading/publish/{id}             — publish all GRADED submissions

Student routes:
  GET    /assignments/student              — list assignments for enrolled class
  POST   /assignments/{id}/submit          — upload submission files

Parent routes:
  GET    /assignments/parent/{student_id}  — read-only view of child's assignments
"""

import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.admin import Class, ClassSubjectTeacher, StudentProfile, Subject
from app.models.extensions import (
    Assignment, AssignmentAttachment, AssignmentStatusEnum, AssignmentTypeEnum,
    AIReview, AIConfidenceEnum,
    Location,
    Submission, SubmissionAttachment, SubmissionStatusEnum,
)
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

_teacher = Depends(require_role("teacher"))
_student = Depends(require_role("student"))
_parent  = Depends(require_role("parent"))

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads", "assignments",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "jpg", "jpeg", "png", "gif", "zip", "txt"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_teacher_class_subject_pairs(teacher_id: int, db: Session) -> set:
    rows = (
        db.query(ClassSubjectTeacher.class_id, ClassSubjectTeacher.subject_id)
        .filter(ClassSubjectTeacher.teacher_id == teacher_id)
        .all()
    )
    return {(r[0], r[1]) for r in rows}


def _attachment_url(file_path: str) -> str:
    return f"/uploads/assignments/{os.path.basename(file_path)}"


def _serialize_attachment(a: AssignmentAttachment) -> dict:
    return {
        "id": a.id,
        "file_name": a.file_name,
        "file_type": a.file_type,
        "file_size": a.file_size,
        "file_url": _attachment_url(a.file_path),
    }


def _serialize_sub_attachment(a: SubmissionAttachment) -> dict:
    return {
        "id": a.id,
        "file_name": a.file_name,
        "file_type": a.file_type,
        "file_size": a.file_size,
        "file_url": _attachment_url(a.file_path),
    }


def _serialize_ai_review(r: AIReview) -> dict:
    return {
        "id": r.id,
        "suggested_grade": float(r.suggested_grade) if r.suggested_grade is not None else None,
        "suggested_feedback": r.suggested_feedback,
        "rubric_alignment": r.rubric_alignment,
        "annotations": r.annotations,
        "confidence_score": r.confidence_score.value if r.confidence_score else "medium",
        "model_info": r.model_info,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _serialize_submission(sub: Submission) -> dict:
    return {
        "id": sub.id,
        "assignment_id": sub.assignment_id,
        "student_id": sub.student_id,
        "student_name": sub.student.full_name if sub.student else None,
        "student_code": (
            sub.student.student_profile.student_code
            if sub.student and hasattr(sub.student, "student_profile") and sub.student.student_profile
            else None
        ),
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        "files": sub.files,
        "grade": float(sub.grade) if sub.grade is not None else None,
        "feedback": sub.feedback,
        "status": sub.status.value if sub.status else "PENDING",
        "ai_reviewed": sub.ai_reviewed,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
        "sub_attachments": [_serialize_sub_attachment(a) for a in sub.sub_attachments],
        "ai_reviews": [_serialize_ai_review(r) for r in sub.ai_reviews],
    }


def _serialize_assignment(
    a: Assignment,
    include_submission_counts: bool = True,
    student_id: Optional[int] = None,
) -> dict:
    sub_count = len(a.submissions) if include_submission_counts else 0
    graded_count = sum(
        1 for s in a.submissions
        if s.status in (SubmissionStatusEnum.GRADED, SubmissionStatusEnum.PUBLISHED)
    ) if include_submission_counts else 0

    result = {
        "id": a.id,
        "class_id": a.class_id,
        "class_name": a.class_.name if a.class_ else None,
        "subject_id": a.subject_id,
        "subject_name": a.subject.name if a.subject else None,
        "teacher_id": a.teacher_id,
        "teacher_name": a.teacher.full_name if a.teacher else None,
        "type": a.type.value if a.type else "ONLINE",
        "title": a.title,
        "description": a.description,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "max_score": float(a.max_score) if a.max_score is not None else 100.0,
        "rubric": a.rubric,
        "location": a.location,
        "duration": a.duration,
        "status": a.status.value if a.status else "DRAFT",
        "answer_sheet_url": _attachment_url(a.answer_sheet_path) if a.answer_sheet_path else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "attachments": [_serialize_attachment(att) for att in a.attachments],
        "submission_count": sub_count,
        "graded_count": graded_count,
    }
    if student_id is not None:
        sub = next((s for s in a.submissions if s.student_id == student_id), None)
        result["submission"] = _serialize_submission(sub) if sub else None
    return result


async def _save_files(files: List[UploadFile]) -> List[AssignmentAttachment]:
    """Validate & persist uploaded files. Returns attachment ORM objects (unsaved)."""
    saved = []
    for f in files:
        if not f.filename:
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"File type '.{ext}' not allowed.")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(400, f"File '{f.filename}' exceeds 20 MB limit.")
        fname = f"{uuid.uuid4().hex}_{f.filename}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as fp:
            fp.write(content)
        saved.append(
            AssignmentAttachment(
                file_name=f.filename,
                file_type=ext,
                file_size=len(content),
                file_path=fpath,
            )
        )
    return saved


# ── Teacher: class list ────────────────────────────────────────────────────────

@router.get("/teacher/my-classes")
def teacher_get_classes(
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /assignments/teacher/my-classes"""
    rows = (
        db.query(ClassSubjectTeacher, Class, Subject)
        .join(Class,   Class.id   == ClassSubjectTeacher.class_id)
        .join(Subject, Subject.id == ClassSubjectTeacher.subject_id)
        .filter(ClassSubjectTeacher.teacher_id == current_user.id)
        .all()
    )
    by_class: dict = {}
    for cst, cls, subj in rows:
        cid = cst.class_id
        if cid not in by_class:
            by_class[cid] = {"id": cid, "name": cls.name, "subjects": []}
        by_class[cid]["subjects"].append({"id": subj.id, "name": subj.name})
    return list(by_class.values())


# ── Teacher: locations list ────────────────────────────────────────────────────

@router.get("/teacher/locations")
def teacher_get_locations(
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /assignments/teacher/locations — active locations for on-site dropdown."""
    locs = db.query(Location).filter(Location.is_active == True).order_by(Location.name).all()  # noqa: E712
    return [{"id": l.id, "name": l.name, "type": l.type, "capacity": l.capacity} for l in locs]


# ── Teacher: onsite class roster ───────────────────────────────────────────────

@router.get("/{assignment_id}/onsite-roster")
def teacher_onsite_roster(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /assignments/{id}/onsite-roster — all students enrolled in the assignment's class."""
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")

    profiles = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.class_id == asgn.class_id)
        .all()
    )

    # Get existing submission statuses for this assignment
    subs = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id)
        .all()
    )
    sub_map = {s.student_id: s for s in subs}

    roster = []
    for p in profiles:
        sub = sub_map.get(p.user_id)
        roster.append({
            "student_id": p.user_id,
            "student_name": p.user.full_name if p.user else None,
            "student_code": p.student_code,
            "submission_status": sub.status.value if sub else "PENDING",
            "grade": float(sub.grade) if sub and sub.grade is not None else None,
            "feedback": sub.feedback if sub else None,
            "submission_id": sub.id if sub else None,
        })
    return roster


# ── Teacher: CRUD ──────────────────────────────────────────────────────────────

@router.get("/teacher")
def teacher_list_assignments(
    class_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    type_filter: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    q = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.attachments),
            joinedload(Assignment.class_),
            joinedload(Assignment.subject),
            joinedload(Assignment.teacher),
            joinedload(Assignment.submissions).joinedload(Submission.student),
            joinedload(Assignment.submissions).joinedload(Submission.ai_reviews),
            joinedload(Assignment.submissions).joinedload(Submission.sub_attachments),
        )
        .filter(Assignment.teacher_id == current_user.id)
    )
    if class_id:
        q = q.filter(Assignment.class_id == class_id)
    if subject_id:
        q = q.filter(Assignment.subject_id == subject_id)
    if status:
        q = q.filter(Assignment.status == status.upper())
    if type_filter:
        q = q.filter(Assignment.type == type_filter.upper())
    items = q.order_by(Assignment.created_at.desc()).all()
    return [_serialize_assignment(a) for a in items]


@router.post("/teacher")
async def teacher_create_assignment(
    background_tasks: BackgroundTasks,
    class_id: int = Query(...),
    subject_id: int = Query(...),
    type: str = Query("ONLINE"),
    title: str = Query(...),
    description: Optional[str] = Query(None),
    due_at: Optional[str] = Query(None),
    max_score: float = Query(100),
    rubric: Optional[str] = Query(None),   # JSON string
    location: Optional[str] = Query(None),
    duration: Optional[str] = Query(None),
    publish: bool = Query(False),
    files: List[UploadFile] = File(default=[]),
    answer_sheet: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    pairs = _get_teacher_class_subject_pairs(current_user.id, db)
    if (class_id, subject_id) not in pairs:
        raise HTTPException(403, "You are not assigned to teach this class-subject.")

    due_dt = None
    if due_at:
        try:
            due_dt = datetime.fromisoformat(due_at)
        except ValueError:
            raise HTTPException(400, "Invalid due_at datetime format.")

    rubric_data = None
    if rubric:
        try:
            rubric_data = json.loads(rubric)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid rubric JSON.")

    # Save answer sheet if provided
    answer_sheet_path = None
    if answer_sheet and answer_sheet.filename:
        ext = answer_sheet.filename.rsplit(".", 1)[-1].lower() if "." in answer_sheet.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Answer sheet file type '.{ext}' not allowed.")
        content = await answer_sheet.read()
        fname = f"answerkey_{uuid.uuid4().hex}_{answer_sheet.filename}"
        answer_sheet_path = os.path.join(UPLOAD_DIR, fname)
        with open(answer_sheet_path, "wb") as fp:
            fp.write(content)

    asgn = Assignment(
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=current_user.id,
        type=AssignmentTypeEnum(type.upper()),
        title=title,
        description=description,
        due_at=due_dt,
        max_score=max_score,
        rubric=rubric_data,
        location=location,
        duration=duration,
        answer_sheet_path=answer_sheet_path,
        status=AssignmentStatusEnum.ACTIVE if publish else AssignmentStatusEnum.DRAFT,
    )
    db.add(asgn)
    db.flush()

    attachments = await _save_files(files)
    for att in attachments:
        att.assignment_id = asgn.id
        db.add(att)

    db.commit()
    db.refresh(asgn)
    # Re-query with relationships
    asgn = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.attachments),
            joinedload(Assignment.class_),
            joinedload(Assignment.subject),
            joinedload(Assignment.teacher),
            joinedload(Assignment.submissions),
        )
        .filter(Assignment.id == asgn.id)
        .one()
    )

    # ── WhatsApp: notify parents when assignment is published immediately ─────
    if publish:
        from app.api.whatsapp import notify_assignment_published
        due_str = asgn.due_at.strftime("%b %d, %Y") if asgn.due_at else None
        notify_assignment_published(
            assignment_id=asgn.id,
            class_id=asgn.class_id,
            assignment_title=asgn.title,
            subject_name=asgn.subject.name if asgn.subject else "subject",
            teacher_name=current_user.full_name,
            due_at=due_str,
            db=db,
            background_tasks=background_tasks,
        )

    return _serialize_assignment(asgn)


@router.put("/teacher/{assignment_id}")
async def teacher_update_assignment(
    assignment_id: int,
    title: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    due_at: Optional[str] = Query(None),
    max_score: Optional[float] = Query(None),
    rubric: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    duration: Optional[str] = Query(None),
    files: List[UploadFile] = File(default=[]),
    answer_sheet: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")

    if title is not None:
        asgn.title = title
    if description is not None:
        asgn.description = description
    if due_at is not None:
        try:
            asgn.due_at = datetime.fromisoformat(due_at)
        except ValueError:
            raise HTTPException(400, "Invalid due_at datetime format.")
    if max_score is not None:
        asgn.max_score = max_score
    if rubric is not None:
        try:
            asgn.rubric = json.loads(rubric)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid rubric JSON.")
    if location is not None:
        asgn.location = location
    if duration is not None:
        asgn.duration = duration

    # Replace answer sheet if a new one is uploaded
    if answer_sheet and answer_sheet.filename:
        ext = answer_sheet.filename.rsplit(".", 1)[-1].lower() if "." in answer_sheet.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Answer sheet file type '.{ext}' not allowed.")
        content = await answer_sheet.read()
        # Remove old answer sheet file
        if asgn.answer_sheet_path:
            try:
                os.remove(asgn.answer_sheet_path)
            except OSError:
                pass
        fname = f"answerkey_{uuid.uuid4().hex}_{answer_sheet.filename}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as fp:
            fp.write(content)
        asgn.answer_sheet_path = fpath

    new_attachments = await _save_files(files)
    for att in new_attachments:
        att.assignment_id = asgn.id
        db.add(att)

    db.commit()
    asgn = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.attachments),
            joinedload(Assignment.class_),
            joinedload(Assignment.subject),
            joinedload(Assignment.teacher),
            joinedload(Assignment.submissions),
        )
        .filter(Assignment.id == assignment_id)
        .one()
    )
    return _serialize_assignment(asgn)


@router.delete("/teacher/{assignment_id}", status_code=204)
def teacher_delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    from fastapi import Response
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")
    # Delete physical files
    atts = db.query(AssignmentAttachment).filter(AssignmentAttachment.assignment_id == assignment_id).all()
    for att in atts:
        try:
            os.remove(att.file_path)
        except OSError:
            pass
    db.delete(asgn)
    db.commit()
    return Response(status_code=204)


@router.post("/teacher/{assignment_id}/publish")
def teacher_publish_assignment(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")
    if asgn.status == AssignmentStatusEnum.RELEASED:
        raise HTTPException(400, "Assignment is already released.")
    asgn.status = AssignmentStatusEnum.ACTIVE
    db.commit()
    db.refresh(asgn)

    # ── WhatsApp: notify parents of students in this class ───────────────────
    from app.api.whatsapp import notify_assignment_published
    due_str = asgn.due_at.strftime("%b %d, %Y") if asgn.due_at else None
    notify_assignment_published(
        assignment_id=asgn.id,
        class_id=asgn.class_id,
        assignment_title=asgn.title,
        subject_name=asgn.subject.name if asgn.subject else "subject",
        teacher_name=current_user.full_name,
        due_at=due_str,
        db=db,
        background_tasks=background_tasks,
    )

    return {"id": asgn.id, "status": asgn.status.value}


@router.post("/teacher/{assignment_id}/close")
def teacher_close_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")
    asgn.status = AssignmentStatusEnum.CLOSED
    db.commit()
    return {"id": asgn.id, "status": asgn.status.value}


@router.delete("/teacher/attachments/{attachment_id}", status_code=204)
def teacher_delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    from fastapi import Response
    att = db.query(AssignmentAttachment).filter(AssignmentAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(404, "Attachment not found.")
    asgn = db.query(Assignment).filter(Assignment.id == att.assignment_id).first()
    if not asgn or asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")
    try:
        os.remove(att.file_path)
    except OSError:
        pass
    db.delete(att)
    db.commit()
    return Response(status_code=204)


# ── Submissions (teacher view) ─────────────────────────────────────────────────

@router.get("/{assignment_id}/submissions")
def teacher_list_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")

    submissions = (
        db.query(Submission)
        .options(
            joinedload(Submission.student),
            joinedload(Submission.ai_reviews),
            joinedload(Submission.sub_attachments),
        )
        .filter(Submission.assignment_id == assignment_id)
        .all()
    )
    return [_serialize_submission(s) for s in submissions]


# ── Grading ────────────────────────────────────────────────────────────────────

@router.post("/grading/manual")
def grading_manual(
    submission_id: int = Query(...),
    grade: float = Query(...),
    feedback: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    sub = (
        db.query(Submission)
        .options(joinedload(Submission.assignment))
        .filter(Submission.id == submission_id)
        .first()
    )
    if not sub:
        raise HTTPException(404, "Submission not found.")
    if sub.assignment.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")

    sub.grade = grade
    sub.feedback = feedback
    sub.status = SubmissionStatusEnum.GRADED
    db.commit()
    db.refresh(sub)
    return {"submission_id": sub.id, "grade": float(sub.grade), "status": sub.status.value}


@router.post("/grading/onsite")
def grading_onsite(
    assignment_id: int = Query(...),
    student_id: int = Query(...),
    grade: float = Query(...),
    feedback: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """Grade an on-site student directly — creates a submission record if none exists."""
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")

    sub = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == student_id,
    ).first()

    if not sub:
        sub = Submission(
            assignment_id=assignment_id,
            student_id=student_id,
            submitted_at=datetime.now(timezone.utc),
            is_onsite=True,
            status=SubmissionStatusEnum.PENDING,
        )
        db.add(sub)
        db.flush()

    sub.grade = grade
    sub.feedback = feedback
    sub.status = SubmissionStatusEnum.GRADED
    db.commit()
    db.refresh(sub)
    return {"submission_id": sub.id, "student_id": student_id, "grade": float(sub.grade), "status": sub.status.value}


@router.post("/grading/ai-review/{assignment_id}")
def grading_ai_review(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """
    Trigger AI review for all SUBMITTED online submissions for this assignment.
    This is a stub that saves placeholder AIReview rows.
    The real LLM call is wired in via the /ai-review endpoint once the
    Claude API key is configured (see README — AI pipeline section).
    """
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")
    if asgn.type != AssignmentTypeEnum.ONLINE:
        raise HTTPException(400, "AI review is only available for ONLINE assignments.")

    submissions = (
        db.query(Submission)
        .options(joinedload(Submission.sub_attachments))
        .filter(
            Submission.assignment_id == assignment_id,
            Submission.status == SubmissionStatusEnum.SUBMITTED,
        )
        .all()
    )
    if not submissions:
        raise HTTPException(404, "No submitted submissions to review.")

    reviewed = 0
    for sub in submissions:
        # Check if AI agent is available
        try:
            from app.services.ai_grading import run_ai_review  # noqa: F401
            result = run_ai_review(asgn, sub, answer_sheet_path=asgn.answer_sheet_path)
        except (ImportError, RuntimeError) as exc:
            # AI service not configured or API key missing — save stub row
            logger.warning("AI review skipped for submission %s: %s", sub.id, exc)
            result = {
                "suggested_grade": None,
                "suggested_feedback": f"AI review unavailable: {exc}",
                "rubric_alignment": {},
                "confidence_score": "low",
                "model_info": {"status": "not_configured"},
            }

        review = AIReview(
            submission_id=sub.id,
            suggested_grade=result.get("suggested_grade"),
            suggested_feedback=result.get("suggested_feedback"),
            rubric_alignment=result.get("rubric_alignment"),
            annotations=result.get("annotations"),
            confidence_score=AIConfidenceEnum(result.get("confidence_score", "low")),
            model_info=result.get("model_info"),
            triggered_by=current_user.id,
        )
        db.add(review)
        sub.ai_reviewed = True
        reviewed += 1

    db.commit()
    return {"reviewed": reviewed, "assignment_id": assignment_id}


@router.post("/grading/publish/{assignment_id}")
def grading_publish(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.teacher_id != current_user.id:
        raise HTTPException(403, "Not your assignment.")

    submissions = (
        db.query(Submission)
        .filter(
            Submission.assignment_id == assignment_id,
            Submission.status == SubmissionStatusEnum.GRADED,
        )
        .all()
    )
    for sub in submissions:
        sub.status = SubmissionStatusEnum.PUBLISHED

    asgn.status = AssignmentStatusEnum.RELEASED
    db.commit()

    # ── WhatsApp: notify parents of each published student ───────────────────
    from app.api.whatsapp import notify_grade_published
    subject_name = asgn.subject.name if asgn.subject else "subject"
    max_score = float(asgn.max_score) if asgn.max_score else 100.0
    for sub in submissions:
        student = db.query(User).filter(User.id == sub.student_id).first()
        if student and sub.grade is not None:
            grade_str = f"{float(sub.grade):.0f} / {max_score:.0f}"
            notify_grade_published(
                student_user_id=student.id,
                student_name=student.full_name,
                assignment_title=asgn.title,
                subject_name=subject_name,
                grade=grade_str,
                assignment_id=assignment_id,
                db=db,
                background_tasks=background_tasks,
            )

    return {"published": len(submissions), "assignment_id": assignment_id}


# ── Student: list + submit ─────────────────────────────────────────────────────

@router.get("/student")
def student_list_assignments(
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = _student,
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile or not profile.class_id:
        return []

    q = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.attachments),
            joinedload(Assignment.class_),
            joinedload(Assignment.subject),
            joinedload(Assignment.teacher),
            joinedload(Assignment.submissions).joinedload(Submission.ai_reviews),
            joinedload(Assignment.submissions).joinedload(Submission.sub_attachments),
            joinedload(Assignment.submissions).joinedload(Submission.student),
        )
        .filter(
            Assignment.class_id == profile.class_id,
            Assignment.status.in_([
                AssignmentStatusEnum.ACTIVE,
                AssignmentStatusEnum.CLOSED,
                AssignmentStatusEnum.RELEASED,
            ]),
        )
    )
    if subject_id:
        q = q.filter(Assignment.subject_id == subject_id)

    items = q.order_by(Assignment.due_at.asc()).all()
    return [_serialize_assignment(a, student_id=current_user.id) for a in items]


@router.post("/{assignment_id}/submit")
async def student_submit(
    assignment_id: int,
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = _student,
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found.")
    if asgn.type != AssignmentTypeEnum.ONLINE:
        raise HTTPException(400, "On-site assignments do not accept file submissions.")
    if asgn.status not in (AssignmentStatusEnum.ACTIVE,):
        raise HTTPException(400, "Assignment is not accepting submissions.")
    if asgn.due_at and datetime.now(timezone.utc) > asgn.due_at.replace(tzinfo=timezone.utc):
        raise HTTPException(400, "Submission deadline has passed.")

    # Get or create submission row
    sub = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id,
    ).first()
    if not sub:
        sub = Submission(
            assignment_id=assignment_id,
            student_id=current_user.id,
        )
        db.add(sub)
        db.flush()

    if sub.status == SubmissionStatusEnum.PUBLISHED:
        raise HTTPException(400, "Grades have already been released for this submission.")

    # Save uploaded files
    saved_atts = []
    for f in files:
        if not f.filename:
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"File type '.{ext}' not allowed.")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(400, f"File '{f.filename}' exceeds 20 MB limit.")
        fname = f"{uuid.uuid4().hex}_{f.filename}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as fp:
            fp.write(content)
        sa = SubmissionAttachment(
            submission_id=sub.id,
            file_name=f.filename,
            file_type=ext,
            file_size=len(content),
            file_path=fpath,
        )
        db.add(sa)
        saved_atts.append(sa)

    sub.submitted_at = datetime.now(timezone.utc)
    sub.status = SubmissionStatusEnum.SUBMITTED
    db.commit()

    sub = (
        db.query(Submission)
        .options(
            joinedload(Submission.student),
            joinedload(Submission.ai_reviews),
            joinedload(Submission.sub_attachments),
        )
        .filter(Submission.id == sub.id)
        .one()
    )
    return _serialize_submission(sub)


# ── Parent: read-only ──────────────────────────────────────────────────────────

@router.get("/parent/{student_id}")
def parent_view_assignments(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = _parent,
):
    # Verify parent-child link
    from app.models.admin import ParentStudent
    link = db.query(ParentStudent).filter(
        ParentStudent.parent_id == current_user.id,
        ParentStudent.student_id == student_id,
    ).first()
    if not link:
        raise HTTPException(403, "Not your child.")

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
    if not profile or not profile.class_id:
        return []

    items = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.attachments),
            joinedload(Assignment.class_),
            joinedload(Assignment.subject),
            joinedload(Assignment.teacher),
            joinedload(Assignment.submissions).joinedload(Submission.ai_reviews),
            joinedload(Assignment.submissions).joinedload(Submission.sub_attachments),
            joinedload(Assignment.submissions).joinedload(Submission.student),
        )
        .filter(
            Assignment.class_id == profile.class_id,
            Assignment.status.in_([
                AssignmentStatusEnum.ACTIVE,
                AssignmentStatusEnum.CLOSED,
                AssignmentStatusEnum.RELEASED,
            ]),
        )
        .order_by(Assignment.due_at.asc())
        .all()
    )
    return [_serialize_assignment(a, student_id=student_id) for a in items]
