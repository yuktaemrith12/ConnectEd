"""
Timetable service layer — business logic for timetable CRUD, publish, and filtered queries.
"""

from datetime import time as dt_time
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.admin import TimetableEntry, StudentProfile, TeacherProfile, ClassSubject

DAY_MAP = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4}


def _parse_time(s: Optional[str]) -> Optional[dt_time]:
    """Parse 'HH:MM' or 'H:MM' into a datetime.time, or return None."""
    if not s:
        return None
    parts = s.strip().split(":")
    return dt_time(int(parts[0]), int(parts[1]))


def _entry_to_out(e: TimetableEntry) -> dict:
    """Convert a TimetableEntry ORM instance to the TimetableEntryOut dict."""
    return {
        "id": e.id,
        "class_id": e.class_id,
        "class_name": e.class_.name if e.class_ else None,
        "subject_id": e.subject_id,
        "subject_name": e.subject.name if e.subject else None,
        "teacher_id": e.teacher_id,
        "teacher_name": e.teacher.full_name if e.teacher else None,
        "day": e.day,
        "day_of_week": e.day_of_week,
        "time_slot": e.time_slot,
        "start_time": e.start_time.strftime("%H:%M") if e.start_time else None,
        "end_time": e.end_time.strftime("%H:%M") if e.end_time else None,
        "room": e.room,
        "online_link": e.online_link,
        "is_published": e.is_published,
        "delivery_mode": e.delivery_mode,
        "location_name": e.location.name if e.location else None,
        "online_join_url": e.online_join_url,
    }


# ── Admin CRUD ────────────────────────────────────────────────────────────────

def create_entry_admin(payload, db: Session) -> dict:
    """Create a single timetable entry as a DRAFT."""
    # Validate subject belongs to class
    cs = db.query(ClassSubject).filter(
        ClassSubject.class_id == payload.class_id,
        ClassSubject.subject_id == payload.subject_id,
    ).first()
    if not cs:
        raise HTTPException(status_code=400, detail="Subject is not assigned to this class.")

    entry = TimetableEntry(
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        is_published=False,
        day=payload.day,
        day_of_week=DAY_MAP.get(payload.day),
        time_slot=payload.time_slot,
        start_time=_parse_time(payload.start_time),
        end_time=_parse_time(payload.end_time),
        room=payload.room,
        online_link=payload.online_link,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_to_out(entry)


def update_entry_admin(entry_id: int, payload, db: Session) -> dict:
    """Update a timetable entry."""
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")

    if payload.subject_id is not None:
        entry.subject_id = payload.subject_id
    if payload.teacher_id is not None:
        entry.teacher_id = payload.teacher_id
    if payload.day is not None:
        entry.day = payload.day
        entry.day_of_week = DAY_MAP.get(payload.day)
    if payload.time_slot is not None:
        entry.time_slot = payload.time_slot
    if payload.start_time is not None:
        entry.start_time = _parse_time(payload.start_time)
    if payload.end_time is not None:
        entry.end_time = _parse_time(payload.end_time)
    if payload.room is not None:
        entry.room = payload.room
    if payload.online_link is not None:
        entry.online_link = payload.online_link

    db.commit()
    db.refresh(entry)
    return _entry_to_out(entry)


def delete_entry_admin(entry_id: int, db: Session) -> None:
    """Delete a timetable entry."""
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")
    db.delete(entry)
    db.commit()


# ── Publish ───────────────────────────────────────────────────────────────────

def publish_timetable_for_class(class_id: int, db: Session) -> int:
    """
    Set is_published=True for all draft entries of a class.
    Performs conflict validation before publishing:
      - Teacher double-booking (same teacher, same day, same time_slot in a *different* class)
      - Class overlap (same class, same day, same time_slot already published)
    Returns count of newly published entries.
    """
    drafts: List[TimetableEntry] = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.class_id == class_id, TimetableEntry.is_published == False)  # noqa: E712
        .all()
    )
    if not drafts:
        return 0

    # Conflict validation
    for entry in drafts:
        if entry.teacher_id:
            conflict = (
                db.query(TimetableEntry)
                .filter(
                    TimetableEntry.teacher_id == entry.teacher_id,
                    TimetableEntry.day == entry.day,
                    TimetableEntry.time_slot == entry.time_slot,
                    TimetableEntry.is_published == True,  # noqa: E712
                    TimetableEntry.class_id != class_id,
                )
                .first()
            )
            if conflict:
                teacher_name = entry.teacher.full_name if entry.teacher else f"Teacher#{entry.teacher_id}"
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Conflict: {teacher_name} is already assigned "
                        f"on {entry.day} at {entry.time_slot} in another class."
                    ),
                )

    count = 0
    for entry in drafts:
        entry.is_published = True
        count += 1
    db.commit()
    return count


# ── Student query ─────────────────────────────────────────────────────────────

def get_student_timetable(user_id: int, db: Session, view: str = "week", date_str: Optional[str] = None) -> List[dict]:
    """
    Fetch published timetable entries for the student's class.
    `user_id` is the User.id from the JWT.
    """
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if not profile or not profile.class_id:
        return []

    q = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.class_id == profile.class_id,
            TimetableEntry.is_published == True,  # noqa: E712
        )
    )

    # Day filtering
    if view == "day" and date_str:
        from datetime import datetime
        day_obj = datetime.strptime(date_str, "%Y-%m-%d")
        day_name = day_obj.strftime("%A")  # Monday, Tuesday, etc.
        q = q.filter(TimetableEntry.day == day_name)

    entries = q.order_by(TimetableEntry.day_of_week, TimetableEntry.time_slot).all()
    return [_entry_to_out(e) for e in entries if e.subject is not None]


# ── Teacher query ─────────────────────────────────────────────────────────────

def get_teacher_timetable(user_id: int, db: Session, view: str = "week", date_str: Optional[str] = None) -> List[dict]:
    """
    Fetch published timetable entries assigned to the teacher.
    `user_id` is the User.id from the JWT (teacher_id in timetable_entries references users.id).
    """
    q = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.teacher_id == user_id,
            TimetableEntry.is_published == True,  # noqa: E712
        )
    )

    if view == "day" and date_str:
        from datetime import datetime
        day_obj = datetime.strptime(date_str, "%Y-%m-%d")
        day_name = day_obj.strftime("%A")
        q = q.filter(TimetableEntry.day == day_name)

    entries = q.order_by(TimetableEntry.day_of_week, TimetableEntry.time_slot).all()
    return [_entry_to_out(e) for e in entries if e.subject is not None]
