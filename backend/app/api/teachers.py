"""
Teacher API — timetable + attendance endpoints.
Prefix (set in main.py): /api/v1/teachers
"""

import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.security import hash_password, verify_password
from app.models.admin import Class, ClassSubject, ClassSubjectTeacher, StudentProfile, TimetableEntry
from app.models.extensions import (
    AttendanceSession, SessionAttendanceRecord,
    SessionStatusEnum, SessionAttendanceStatusEnum,
)
from app.models.admin import TeacherProfile
from app.models.user import User
from app.schemas.admin import TimetableEntryOut
from app.schemas.extensions import (
    AttendanceSessionDetail, BulkMarkRequest, OpenSessionRequest,
    StudentAttendanceRow,
)
from app.services.timetable_service import get_teacher_timetable as _svc_teacher_tt

router = APIRouter()
logger = logging.getLogger(__name__)

_teacher = Depends(require_role("teacher"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_session_detail(session: AttendanceSession, db: Session) -> AttendanceSessionDetail:
    """Build the full AttendanceSessionDetail response from an ORM session."""
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == session.timetable_entry_id).first()
    class_name   = entry.class_.name   if entry and entry.class_   else "—"
    subject_name = entry.subject.name  if entry and entry.subject  else "—"
    teacher_name = entry.teacher.full_name if entry and entry.teacher else "—"
    time_slot    = entry.time_slot if entry else "—"

    # Location name from snapshot FK or just mark n/a
    location_name: Optional[str] = None
    if session.location_id_snapshot:
        from app.models.extensions import Location  # local import avoids circular ref
        loc = db.query(Location).filter(Location.id == session.location_id_snapshot).first()
        location_name = loc.name if loc else None

    # Roster: all students in the class
    class_id = entry.class_id if entry else None
    roster_rows: List[StudentAttendanceRow] = []
    if class_id:
        students = (
            db.query(User)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .filter(StudentProfile.class_id == class_id, User.deleted_at == None)  # noqa: E711
            .order_by(User.full_name)
            .all()
        )
        # Index existing records
        rec_map = {r.student_id: r for r in session.records}
        for stu in students:
            sp = db.query(StudentProfile).filter(StudentProfile.user_id == stu.id).first()
            rec = rec_map.get(stu.id)
            roster_rows.append(StudentAttendanceRow(
                student_id=stu.id,
                student_name=stu.full_name,
                student_code=sp.student_code if sp else "—",
                status=rec.status.value if rec and rec.status else None,
                note=rec.note if rec else None,
                marked_at=rec.marked_at.isoformat() if rec and rec.marked_at else None,
            ))

    return AttendanceSessionDetail(
        session_id=session.id,
        class_name=class_name,
        subject_name=subject_name,
        teacher_name=teacher_name,
        session_date=session.session_date.isoformat(),
        delivery_mode=session.delivery_mode_snapshot,
        location_name=location_name,
        online_join_url=session.online_join_url_snapshot,
        status=session.status.value,
        roster=roster_rows,
    )


# ── Timetable ─────────────────────────────────────────────────────────────────

@router.get("/timetable", response_model=List[TimetableEntryOut])
def teacher_timetable(
    view: str = Query("week", regex="^(day|week)$"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD for day view"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher")),
):
    """
    GET /teachers/timetable
    Returns ONLY published entries where teacher_id matches the current teacher.
    """
    results = _svc_teacher_tt(current_user.id, db, view=view, date_str=date)
    return [TimetableEntryOut(**r) for r in results]


# ── Attendance ─────────────────────────────────────────────────────────────────

@router.get("/attendance/my-classes")
def teacher_my_classes(
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """
    GET /teachers/attendance/my-classes
    Returns the distinct classes this teacher is assigned to (from timetable entries).
    """
    rows = (
        db.query(Class)
        .join(TimetableEntry, TimetableEntry.class_id == Class.id)
        .filter(TimetableEntry.teacher_id == current_user.id)
        .distinct()
        .order_by(Class.name)
        .all()
    )
    return [{"id": c.id, "name": c.name} for c in rows]


@router.post("/attendance/open", response_model=AttendanceSessionDetail)
def teacher_open_session(
    payload: OpenSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """
    POST /teachers/attendance/open
    Opens (or fetches existing) attendance session for a given class + date.
    Finds the timetable entry for this teacher+class on the given day.
    Pre-creates null-status records for every student in the class.
    """
    try:
        session_date = date.fromisoformat(payload.session_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="session_date must be YYYY-MM-DD")

    day_name = session_date.strftime("%A")  # "Monday" … "Friday"

    # Find timetable entry
    entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.teacher_id == current_user.id,
            TimetableEntry.class_id == payload.class_id,
            TimetableEntry.day == day_name,
        )
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"No timetable entry found for this class on {day_name}.",
        )

    # Idempotent: return existing session if one already exists
    existing = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.timetable_entry_id == entry.id,
            AttendanceSession.session_date == session_date,
        )
        .first()
    )
    if existing:
        # Ensure all students have a record row
        _ensure_roster(existing, entry.class_id, current_user.id, db)
        db.refresh(existing)
        return _build_session_detail(existing, db)

    # Create new session with snapshot
    session = AttendanceSession(
        timetable_entry_id=entry.id,
        session_date=session_date,
        delivery_mode_snapshot=entry.delivery_mode or "ONSITE",
        location_id_snapshot=entry.location_id,
        online_join_url_snapshot=entry.online_join_url,
        status=SessionStatusEnum.OPEN,
        created_by=current_user.id,
    )
    db.add(session)
    db.flush()  # get session.id

    _ensure_roster(session, entry.class_id, current_user.id, db)
    db.commit()
    db.refresh(session)
    return _build_session_detail(session, db)


def _ensure_roster(session: AttendanceSession, class_id: int, teacher_id: int, db: Session):
    """Create null-status records for any students not yet in the roster."""
    students = (
        db.query(User)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .filter(StudentProfile.class_id == class_id, User.deleted_at == None)  # noqa: E711
        .all()
    )
    existing_ids = {r.student_id for r in session.records}
    for stu in students:
        if stu.id not in existing_ids:
            db.add(SessionAttendanceRecord(
                attendance_session_id=session.id,
                student_id=stu.id,
                status=None,
                marked_by=None,
            ))


@router.get("/attendance/sessions/{session_id}", response_model=AttendanceSessionDetail)
def teacher_get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /teachers/attendance/sessions/{session_id}"""
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _build_session_detail(session, db)


@router.put("/attendance/sessions/{session_id}/records", response_model=AttendanceSessionDetail)
def teacher_mark_attendance(
    session_id: int,
    payload: BulkMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """PUT /teachers/attendance/sessions/{session_id}/records — bulk upsert status."""
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if session.status == SessionStatusEnum.CLOSED:
        raise HTTPException(status_code=400, detail="Session is already closed")

    valid = {v.value for v in SessionAttendanceStatusEnum}
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    rec_map = {r.student_id: r for r in session.records}
    for item in payload.records:
        if item.status not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid status '{item.status}'")
        rec = rec_map.get(item.student_id)
        if rec is None:
            rec = SessionAttendanceRecord(
                attendance_session_id=session_id,
                student_id=item.student_id,
            )
            db.add(rec)
        rec.status    = SessionAttendanceStatusEnum(item.status)
        rec.note      = item.note
        rec.marked_at = now
        rec.marked_by = current_user.id

    db.commit()
    db.refresh(session)
    return _build_session_detail(session, db)


@router.post("/attendance/sessions/{session_id}/close", response_model=AttendanceSessionDetail)
def teacher_close_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """POST /teachers/attendance/sessions/{session_id}/close — finalize session."""
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if session.status == SessionStatusEnum.CLOSED:
        raise HTTPException(status_code=400, detail="Session is already closed")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Mark all still-null records as ABSENT
    for rec in session.records:
        if rec.status is None:
            rec.status    = SessionAttendanceStatusEnum.ABSENT
            rec.marked_at = now
            rec.marked_by = current_user.id

    session.status = SessionStatusEnum.CLOSED
    db.commit()
    db.refresh(session)

    # ── WhatsApp: notify parents of absent/late students ─────────────────────
    from app.api.whatsapp import notify_attendance
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == session.timetable_entry_id).first()
    subject_name = entry.subject.name if entry and entry.subject else "class"
    session_date_str = session.session_date.strftime("%b %d, %Y") if session.session_date else ""
    for rec in session.records:
        if rec.status in (SessionAttendanceStatusEnum.ABSENT, SessionAttendanceStatusEnum.LATE):
            student_user = db.query(User).filter(User.id == rec.student_id).first()
            if student_user:
                notify_attendance(
                    student_user_id=student_user.id,
                    student_name=student_user.full_name,
                    status=rec.status.value,
                    session_date=session_date_str,
                    subject_name=subject_name,
                    event_key=f"attendance:session_record:{rec.id}",
                    db=db,
                    background_tasks=background_tasks,
                )

    return _build_session_detail(session, db)


@router.get("/stats")
def teacher_stats(
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /teachers/stats — KPI counts for the teacher dashboard."""
    # Distinct class IDs this teacher teaches (via timetable)
    class_ids = {
        r.class_id
        for r in db.query(TimetableEntry.class_id)
        .filter(TimetableEntry.teacher_id == current_user.id)
        .distinct()
        .all()
    }

    # Total active students across those classes
    total_students = 0
    if class_ids:
        total_students = (
            db.query(func.count(StudentProfile.user_id))
            .join(User, User.id == StudentProfile.user_id)
            .filter(
                StudentProfile.class_id.in_(class_ids),
                User.deleted_at == None,  # noqa: E711
            )
            .scalar()
        ) or 0

    # Avg attendance rate from closed sessions created by this teacher
    stats = (
        db.query(
            func.count(SessionAttendanceRecord.student_id).label("total"),
            func.sum(
                case(
                    (
                        SessionAttendanceRecord.status.in_([
                            SessionAttendanceStatusEnum.PRESENT,
                            SessionAttendanceStatusEnum.LATE,
                        ]),
                        1,
                    ),
                    else_=0,
                )
            ).label("present_late"),
        )
        .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
        .filter(
            AttendanceSession.created_by == current_user.id,
            AttendanceSession.status == SessionStatusEnum.CLOSED,
            SessionAttendanceRecord.status.isnot(None),
        )
        .first()
    )
    total_recs = stats.total or 0
    present_late = stats.present_late or 0
    avg_attendance_rate = round(present_late / total_recs * 100, 1) if total_recs > 0 else 0.0

    return {
        "total_students": total_students,
        "avg_attendance_rate": avg_attendance_rate,
    }


@router.get("/profile")
def teacher_profile(
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """GET /teachers/profile — profile info for the logged-in teacher."""
    tp = db.query(TeacherProfile).filter(TeacherProfile.user_id == current_user.id).first()
    # Distinct subjects taught via class_subject_teachers
    subject_rows = (
        db.query(ClassSubjectTeacher)
        .filter(ClassSubjectTeacher.teacher_id == current_user.id)
        .all()
    )
    subject_names = list({row.subject.name for row in subject_rows if row.subject})
    return {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "staff_id": tp.staff_id if tp else None,
        "phone": tp.phone if tp else None,
        "dob": tp.dob.isoformat() if tp and tp.dob else None,
        "subjects": ", ".join(sorted(subject_names)) if subject_names else None,
    }


@router.patch("/profile/password")
def teacher_change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """PATCH /teachers/profile/password — change own password."""
    old_pw = payload.get("old_password", "")
    new_pw = payload.get("new_password", "")
    if not old_pw or not new_pw:
        raise HTTPException(status_code=422, detail="old_password and new_password are required.")
    if len(new_pw) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters.")
    if not verify_password(old_pw, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.hashed_password = hash_password(new_pw)
    db.commit()
    return {"detail": "Password updated successfully."}


@router.get("/")
def list_teachers():
    return {"message": "Teachers endpoint — coming soon"}
