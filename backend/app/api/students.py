"""
Student API — timetable + attendance endpoints.
Prefix (set in main.py): /api/v1/students
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.security import hash_password, verify_password
from app.models.admin import StudentProfile, TimetableEntry
from app.models.extensions import AttendanceSession, SessionAttendanceRecord, SessionAttendanceStatusEnum
from app.models.user import User
from app.schemas.admin import TimetableEntryOut
from app.schemas.extensions import StudentAttendanceSummary, StudentSessionRecord
from app.services.timetable_service import get_student_timetable as _svc_student_tt

router = APIRouter()


# Timetable

@router.get("/timetable", response_model=List[TimetableEntryOut])
def student_timetable(
    view: str = Query("week", regex="^(day|week)$"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD for day view"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    """
    GET /students/timetable
    Returns ONLY published entries for the student's class group.
    """
    results = _svc_student_tt(current_user.id, db, view=view, date_str=date)
    return [TimetableEntryOut(**r) for r in results]


# Attendance

@router.get("/attendance", response_model=StudentAttendanceSummary)
def student_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    """
    GET /students/attendance
    Returns the student's attendance summary and recent session history.
    """
    return _build_student_summary(current_user.id, db)


def _build_student_summary(user_id: int, db: Session) -> StudentAttendanceSummary:
    records = (
        db.query(SessionAttendanceRecord)
        .filter(SessionAttendanceRecord.student_id == user_id)
        .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
        .order_by(AttendanceSession.session_date.desc())
        .all()
    )

    total = len(records)
    present = sum(1 for r in records if r.status == SessionAttendanceStatusEnum.PRESENT)
    absent  = sum(1 for r in records if r.status == SessionAttendanceStatusEnum.ABSENT)
    late    = sum(1 for r in records if r.status == SessionAttendanceStatusEnum.LATE)
    excused = sum(1 for r in records if r.status == SessionAttendanceStatusEnum.EXCUSED)
    unmarked = sum(1 for r in records if r.status is None)

    denominator = total - excused - unmarked
    rate = round((present + late) / denominator * 100, 1) if denominator > 0 else 100.0

    recent: List[StudentSessionRecord] = []
    for rec in records[:30]:
        sess = db.query(AttendanceSession).filter(AttendanceSession.id == rec.attendance_session_id).first()
        if not sess:
            continue
        entry = db.query(TimetableEntry).filter(TimetableEntry.id == sess.timetable_entry_id).first()
        recent.append(StudentSessionRecord(
            session_date=sess.session_date.isoformat(),
            class_name=entry.class_.name    if entry and entry.class_   else "—",
            subject_name=entry.subject.name if entry and entry.subject  else "—",
            time_slot=entry.time_slot       if entry                    else "—",
            delivery_mode=sess.delivery_mode_snapshot,
            status=rec.status.value if rec.status else None,
            note=rec.note,
        ))

    return StudentAttendanceSummary(
        total_sessions=total,
        present_count=present,
        absent_count=absent,
        late_count=late,
        excused_count=excused,
        unmarked_count=unmarked,
        attendance_rate=rate,
        recent=recent,
    )


@router.get("/profile")
def student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    """GET /students/profile — profile info for the logged-in student."""
    sp = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    return {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "student_code": sp.student_code if sp else None,
        "class_name": sp.class_.name if sp and sp.class_ else None,
        "dob": sp.dob.isoformat() if sp and sp.dob else None,
        "phone": sp.phone if sp else None,
    }


@router.patch("/profile/password")
def student_change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    """PATCH /students/profile/password — change own password."""
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
def list_students():
    return {"message": "Students endpoint — coming soon"}
