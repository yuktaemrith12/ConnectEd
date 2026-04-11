"""
Admin API — all routes require the 'admin' role.
Prefix (set in main.py): /api/v1/admin
"""

import csv
import io
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User, Role
from app.models.admin import (
    Class, ClassSubject, StudentProfile, Subject, TimetableEntry,
    TeacherProfile, ParentStudent, TeacherSubject, ClassSubjectTeacher,
)
from app.models.extensions import (
    AttendanceRecord, AttendanceStatusEnum,
    AttendanceSession, SessionAttendanceRecord, SessionAttendanceStatusEnum,
    FeePlan, FeePayment,
    Event,
)
from app.schemas.admin import (
    AdminUserRead, AssignClass, ClassCreate, ClassRead,
    ManageClass, StatusToggle, SubjectRead,
    TimetableBulk, TimetableSlot, TeacherRead,
    UserCreate, UserDetailRead, LinkCreate,
    StudentCreateData, TeacherCreateData, ParentCreateData,
    UserUpdate, PasswordReset, StudentSearchResult,
    ClassConfigRead, ClassConfigUpdate,
)

router = APIRouter()
_admin = Depends(require_role("admin"))

LUNCH_SLOT = "12:00"


# Helpers

def _generate_email(first_name: str, last_name: str, role: str) -> str:
    """firstname + first_letter_of_lastname @ role.connected.com"""
    return f"{first_name.strip().lower()}{last_name.strip()[0].lower()}@{role}.connected.com"


def _unique_email(base_email: str, db: Session) -> str:
    """Append a numeric suffix if the base email is already taken."""
    email = base_email
    parts = base_email.split("@")
    counter = 1
    while db.query(User).filter(User.email == email).first():
        email = f"{parts[0]}{counter}@{parts[1]}"
        counter += 1
    return email


def _next_student_code(db: Session) -> str:
    count = db.query(StudentProfile).count() + 1
    return f"ST{count:04d}"


def _next_staff_id(db: Session) -> str:
    count = db.query(TeacherProfile).count() + 1
    return f"TCH{count:03d}"


# Dashboard

@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db), _=_admin):
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    # KPI cards
    total_students = (
        db.query(User)
        .join(User.role)
        .filter(Role.name == "student", User.deleted_at == None)  # noqa: E711
        .count()
    )
    total_teachers = (
        db.query(User)
        .join(User.role)
        .filter(Role.name == "teacher", User.deleted_at == None)   # noqa: E711
        .count()
    )

    # Attendance rate (last 30 days) — from session-based records
    att_total = (
        db.query(func.count(SessionAttendanceRecord.student_id))
        .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
        .filter(
            AttendanceSession.session_date.between(thirty_days_ago, today),
            SessionAttendanceRecord.status.isnot(None),
        )
        .scalar()
    ) or 0
    att_present = (
        db.query(func.count(SessionAttendanceRecord.student_id))
        .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
        .filter(
            AttendanceSession.session_date.between(thirty_days_ago, today),
            SessionAttendanceRecord.status.in_([
                SessionAttendanceStatusEnum.PRESENT,
                SessionAttendanceStatusEnum.LATE,
            ]),
        )
        .scalar()
    ) or 0
    attendance_rate = round((att_present / att_total * 100), 1) if att_total else 0.0

    # Unpaid fees — total outstanding amount across all plans
    plans = db.query(FeePlan).all()
    total_outstanding = 0.0
    paid_count = 0
    partial_unpaid_count = 0
    overdue_count = 0
    for fp in plans:
        paid = float(sum(p.amount_paid for p in fp.payments))
        balance = float(fp.total_amount) - paid
        if balance <= 0:
            paid_count += 1
        else:
            total_outstanding += balance
            is_overdue = fp.due_date < today if fp.due_date else False
            if is_overdue:
                overdue_count += 1
            else:
                partial_unpaid_count += 1

    # Attendance trend (daily) — from session-based records
    from sqlalchemy import case as sql_case, func as sql_func
    att_rows = (
        db.query(
            AttendanceSession.session_date.label("date"),
            sql_func.count(SessionAttendanceRecord.student_id).label("total"),
            sql_func.sum(
                sql_case(
                    (SessionAttendanceRecord.status.in_([
                        SessionAttendanceStatusEnum.PRESENT,
                        SessionAttendanceStatusEnum.LATE,
                    ]), 1),
                    else_=0,
                )
            ).label("present"),
        )
        .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
        .filter(
            AttendanceSession.session_date.between(thirty_days_ago, today),
            SessionAttendanceRecord.status.isnot(None),
        )
        .group_by(AttendanceSession.session_date)
        .order_by(AttendanceSession.session_date)
        .all()
    )
    attendance_trend = [
        {"month": r.date.strftime("%b %d"), "rate": round((r.present / r.total * 100), 1) if r.total else 0}
        for r in att_rows
    ]

    # Fee status distribution (counts of students)
    fee_status = [
        {"name": "Paid",    "value": paid_count,           "color": "#10b981"},
        {"name": "Pending", "value": partial_unpaid_count, "color": "#f59e0b"},
        {"name": "Overdue", "value": overdue_count,        "color": "#ef4444"},
    ]

    # Enrolment by class/grade
    class_rows = (
        db.query(
            Class.name.label("grade"),
            sql_func.count(StudentProfile.id).label("students"),
        )
        .outerjoin(StudentProfile, StudentProfile.class_id == Class.id)
        .group_by(Class.id, Class.name)
        .order_by(Class.name)
        .all()
    )
    enrolment_data = [{"grade": r.grade, "students": r.students} for r in class_rows]

    # Upcoming events (next 5)
    upcoming = (
        db.query(Event)
        .filter(Event.start_date >= today)
        .order_by(Event.start_date)
        .limit(5)
        .all()
    )
    events_data = [
        {
            "title": e.title,
            "date": e.start_date.strftime("%b %d, %Y"),
            "type": e.type.value if hasattr(e.type, "value") else str(e.type),
        }
        for e in upcoming
    ]

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "attendance_rate": attendance_rate,
        "unpaid_fees": round(total_outstanding, 2),
        "attendance_trend": attendance_trend,
        "fee_status": fee_status,
        "enrolment_data": enrolment_data,
        "upcoming_events": events_data,
    }


# Admin Password Change

@router.patch("/profile/password")
def change_own_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lets the logged-in admin change their own password."""
    old_password = payload.get("old_password", "")
    new_password = payload.get("new_password", "")

    if not old_password or not new_password:
        raise HTTPException(status_code=422, detail="old_password and new_password are required.")
    if len(new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters.")
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.hashed_password = hash_password(new_password)
    db.commit()
    return {"detail": "Password updated successfully."}


# Users

@router.get("/users", response_model=List[AdminUserRead])
def list_users(
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=_admin,
):
    """List users, optionally filtered by role and search term. Excludes soft-deleted."""
    q = db.query(User).join(User.role).filter(User.deleted_at == None)  # noqa: E711
    if role:
        q = q.filter(Role.name == role)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (User.full_name.ilike(term)) | (User.email.ilike(term))
        )
    users = q.all()

    result = []
    for u in users:
        class_name = None
        if u.role.name == "student":
            profile = db.query(StudentProfile).filter(StudentProfile.user_id == u.id).first()
            if profile and profile.class_:
                class_name = profile.class_.name

        result.append(
            AdminUserRead(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=u.role.name,
                class_name=class_name,
                is_active=u.is_active,
            )
        )
    return result


@router.post("/users", response_model=AdminUserRead, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _=_admin):
    """Create a new user with auto-generated email and role-specific profile."""
    role_obj = db.query(Role).filter(Role.name == payload.role).first()
    if not role_obj:
        raise HTTPException(status_code=400, detail="Invalid role")

    base_email = _generate_email(payload.first_name, payload.last_name, payload.role)
    email = _unique_email(base_email, db)

    user = User(
        email=email,
        full_name=f"{payload.first_name.strip()} {payload.last_name.strip()}",
        hashed_password=hash_password("12345"),
        role_id=role_obj.id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    class_name = None

    if payload.role == "student":
        data = payload.student or StudentCreateData()
        profile = StudentProfile(
            user_id=user.id,
            student_code=_next_student_code(db),
            class_id=data.class_id,
            dob=data.dob,
            address=data.address,
            phone=data.phone,
        )
        db.add(profile)
        if data.class_id:
            cls = db.query(Class).filter(Class.id == data.class_id).first()
            if cls:
                class_name = cls.name

    elif payload.role == "teacher":
        data = payload.teacher or TeacherCreateData()
        tp = TeacherProfile(
            user_id=user.id,
            staff_id=_next_staff_id(db),
            dob=data.dob,
            address=data.address,
            phone=data.phone,
            bio=data.bio,
        )
        db.add(tp)
        db.flush()
        for sid in (data.subject_ids or []):
            db.add(TeacherSubject(teacher_id=user.id, subject_id=sid))

    elif payload.role == "parent":
        data = payload.parent or ParentCreateData()
        for student_id in data.student_ids:
            db.add(ParentStudent(
                parent_id=user.id,
                student_id=student_id,
                relationship_type=data.relationship,
            ))

    db.commit()
    db.refresh(user)

    return AdminUserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        class_name=class_name,
        is_active=user.is_active,
    )


@router.post("/users/import")
async def bulk_import(  # must come before /users/{user_id}/... routes
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=_admin,
):
    """Bulk CSV import. Expected columns: full_name, email, role, class (optional)."""
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    created, skipped = 0, 0
    for row in reader:
        email = row.get("email", "").strip().lower()
        if not email or db.query(User).filter(User.email == email).first():
            skipped += 1
            continue

        role_name = row.get("role", "student").strip().lower()
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            skipped += 1
            continue

        u = User(
            email=email,
            full_name=row.get("full_name", "").strip(),
            hashed_password=hash_password("changeme123"),
            role_id=role.id,
            is_active=True,
        )
        db.add(u)
        db.flush()

        if role_name == "student":
            profile = StudentProfile(
                user_id=u.id,
                student_code=_next_student_code(db),
            )
            db.add(profile)
            cls_name = row.get("class", "").strip()
            if cls_name:
                cls = db.query(Class).filter(Class.name == cls_name).first()
                if cls:
                    profile.class_id = cls.id

        created += 1

    db.commit()
    return {"created": created, "skipped": skipped}


@router.get("/users/{user_id}/detail", response_model=UserDetailRead)
def get_user_detail(user_id: int, db: Session = Depends(get_db), _=_admin):
    """Return full account + role-specific profile details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    detail = UserDetailRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        is_active=user.is_active,
    )

    if user.role.name == "student":
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
        if profile:
            detail.student_code = profile.student_code
            detail.dob = profile.dob
            detail.address = profile.address
            detail.phone = profile.phone
            if profile.class_:
                detail.class_name = profile.class_.name
        parent_links = db.query(ParentStudent).filter(ParentStudent.student_id == user_id).all()
        detail.linked_parent_ids = [p.parent_id for p in parent_links]

    elif user.role.name == "teacher":
        profile = db.query(TeacherProfile).filter(TeacherProfile.user_id == user_id).first()
        if profile:
            detail.staff_id = profile.staff_id
            detail.dob = profile.dob
            detail.address = profile.address
            detail.phone = profile.phone
            detail.bio = profile.bio
        ts_rows = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).all()
        detail.subject_ids = [ts.subject_id for ts in ts_rows]

    elif user.role.name == "parent":
        child_links = db.query(ParentStudent).filter(ParentStudent.parent_id == user_id).all()
        detail.linked_student_ids = [c.student_id for c in child_links]

    return detail


@router.post("/users/{user_id}/links")
def create_link(
    user_id: int,
    payload: LinkCreate,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Link a parent to students (parent_student) or a teacher to subjects (teacher_subject)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.type == "parent_student":
        for student_id in payload.target_ids:
            exists = db.query(ParentStudent).filter(
                ParentStudent.parent_id == user_id,
                ParentStudent.student_id == student_id,
            ).first()
            if not exists:
                db.add(ParentStudent(
                    parent_id=user_id,
                    student_id=student_id,
                    relationship_type=payload.relationship,
                ))

    elif payload.type == "teacher_subject":
        for subject_id in payload.target_ids:
            exists = db.query(TeacherSubject).filter(
                TeacherSubject.teacher_id == user_id,
                TeacherSubject.subject_id == subject_id,
            ).first()
            if not exists:
                db.add(TeacherSubject(teacher_id=user_id, subject_id=subject_id))

    db.commit()
    return {"status": "ok"}


@router.put("/users/{user_id}", response_model=AdminUserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Update a user's account and role-specific profile fields."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()  # noqa: E711
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.is_active is not None:
        user.is_active = payload.is_active

    class_name = None

    if user.role.name == "student" and payload.student:
        d = payload.student
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id, student_code=_next_student_code(db))
            db.add(profile)
        if d.class_id is not None:
            profile.class_id = d.class_id
        if d.dob is not None:
            profile.dob = d.dob
        if d.address is not None:
            profile.address = d.address
        if d.phone is not None:
            profile.phone = d.phone
        if profile.class_:
            class_name = profile.class_.name

    elif user.role.name == "teacher" and payload.teacher:
        d = payload.teacher
        tp = db.query(TeacherProfile).filter(TeacherProfile.user_id == user_id).first()
        if not tp:
            tp = TeacherProfile(user_id=user_id, staff_id=_next_staff_id(db))
            db.add(tp)
        if d.dob is not None:
            tp.dob = d.dob
        if d.address is not None:
            tp.address = d.address
        if d.phone is not None:
            tp.phone = d.phone
        if d.bio is not None:
            tp.bio = d.bio
        # Replace subject links when subject_ids is explicitly provided
        # None = don't touch; [] = clear all; [1,2,...] = replace
        if d.subject_ids is not None:
            db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).delete()
            for sid in d.subject_ids:
                db.add(TeacherSubject(teacher_id=user_id, subject_id=sid))

    elif user.role.name == "parent" and payload.parent:
        d = payload.parent
        # Replace all parent-student links
        if d.student_ids:
            db.query(ParentStudent).filter(ParentStudent.parent_id == user_id).delete()
            for student_id in d.student_ids:
                db.add(ParentStudent(
                    parent_id=user_id,
                    student_id=student_id,
                    relationship_type=d.relationship,
                ))

    db.commit()
    db.refresh(user)

    return AdminUserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        class_name=class_name,
        is_active=user.is_active,
    )


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), _=_admin):
    """Soft-delete a user (sets deleted_at, deactivates). Data is preserved in DB."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()  # noqa: E711
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    db.commit()
    return Response(status_code=204)


@router.post("/users/{user_id}/password")
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Reset a user's password. Defaults to '12345' if no password provided."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()  # noqa: E711
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(payload.new_password or "12345")
    db.commit()
    return {"status": "ok"}


# Student search (lightweight, for parent-student linking)

@router.get("/students/search", response_model=List[StudentSearchResult])
def search_students(
    q: str = Query(""),
    db: Session = Depends(get_db),
    _=_admin,
):
    """Search active students by name for the parent-student link picker."""
    query = (
        db.query(User)
        .join(User.role)
        .filter(Role.name == "student", User.deleted_at == None)  # noqa: E711
    )
    if q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(User.full_name.ilike(term))
    users = query.limit(50).all()

    result = []
    for u in users:
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == u.id).first()
        class_name = profile.class_.name if profile and profile.class_ else None
        result.append(StudentSearchResult(id=u.id, full_name=u.full_name, class_name=class_name))
    return result


# CSV Export

@router.get("/export/{role}")
def export_users(
    role: str,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=_admin,
):
    """Export users of a given role to CSV."""
    if role not in ("student", "teacher", "parent"):
        raise HTTPException(status_code=400, detail="Invalid role. Use student, teacher, or parent.")

    q = (
        db.query(User)
        .join(User.role)
        .filter(Role.name == role, User.deleted_at == None)  # noqa: E711
    )
    if search:
        term = f"%{search}%"
        q = q.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))
    users = q.all()

    output = io.StringIO()
    writer = csv.writer(output)

    if role == "student":
        writer.writerow(["full_name", "email", "student_code", "class", "dob", "phone", "address", "status"])
        for u in users:
            p = db.query(StudentProfile).filter(StudentProfile.user_id == u.id).first()
            writer.writerow([
                u.full_name, u.email,
                p.student_code if p else "",
                p.class_.name if p and p.class_ else "",
                str(p.dob) if p and p.dob else "",
                p.phone or "" if p else "",
                p.address or "" if p else "",
                "active" if u.is_active else "suspended",
            ])

    elif role == "teacher":
        writer.writerow(["full_name", "email", "staff_id", "phone", "address", "bio", "subjects", "status"])
        all_subjects = {s.id: s.name for s in db.query(Subject).all()}
        for u in users:
            tp = db.query(TeacherProfile).filter(TeacherProfile.user_id == u.id).first()
            ts_ids = [ts.subject_id for ts in db.query(TeacherSubject).filter(TeacherSubject.teacher_id == u.id).all()]
            subject_names = ", ".join(all_subjects[sid] for sid in ts_ids if sid in all_subjects)
            writer.writerow([
                u.full_name, u.email,
                tp.staff_id or "" if tp else "",
                tp.phone or "" if tp else "",
                tp.address or "" if tp else "",
                tp.bio or "" if tp else "",
                subject_names,
                "active" if u.is_active else "suspended",
            ])

    else:  # parent
        writer.writerow(["full_name", "email", "phone", "address", "linked_students", "status"])
        for u in users:
            links = db.query(ParentStudent).filter(ParentStudent.parent_id == u.id).all()
            student_names = []
            for lnk in links:
                s = db.query(User).filter(User.id == lnk.student_id).first()
                if s:
                    student_names.append(s.full_name)
            writer.writerow([
                u.full_name, u.email,
                "", "",   # no dedicated phone/address profile for parents yet
                ", ".join(student_names),
                "active" if u.is_active else "suspended",
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={role}s_export.csv"},
    )


# Role-specific CSV Import

@router.post("/import/{role}")
async def role_import(
    role: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=_admin,
):
    """
    Role-specific CSV import with auto-email generation if email is blank.
    Student columns: full_name, email (optional), class (optional)
    Teacher columns: full_name, email (optional), bio (optional), subjects (optional, comma-separated)
    Parent  columns: full_name, email (optional)
    Default password: 12345
    """
    if role not in ("student", "teacher", "parent"):
        raise HTTPException(status_code=400, detail="Invalid role.")

    role_obj = db.query(Role).filter(Role.name == role).first()
    if not role_obj:
        raise HTTPException(status_code=400, detail="Role not found in database.")

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    created, skipped = 0, 0
    details: list = []

    for i, row in enumerate(reader, start=2):
        full_name = row.get("full_name", "").strip()
        if not full_name:
            skipped += 1
            details.append({"line": i, "status": "skipped", "reason": "Missing full_name"})
            continue

        email = row.get("email", "").strip().lower()
        if not email:
            parts = full_name.split()
            fname, lname = parts[0], parts[-1] if len(parts) > 1 else parts[0]
            email = _unique_email(_generate_email(fname, lname, role), db)
        elif db.query(User).filter(User.email == email).first():
            skipped += 1
            details.append({"line": i, "status": "skipped", "email": email, "reason": "Email already exists"})
            continue

        u = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password("12345"),
            role_id=role_obj.id,
            is_active=True,
        )
        db.add(u)
        db.flush()

        if role == "student":
            profile = StudentProfile(user_id=u.id, student_code=_next_student_code(db))
            db.add(profile)
            cls_name = row.get("class", "").strip()
            if cls_name:
                cls = db.query(Class).filter(Class.name == cls_name).first()
                if cls:
                    profile.class_id = cls.id

        elif role == "teacher":
            tp = TeacherProfile(
                user_id=u.id,
                staff_id=_next_staff_id(db),
                bio=row.get("bio", "").strip() or None,
            )
            db.add(tp)
            db.flush()
            subj_str = row.get("subjects", "").strip()
            if subj_str:
                for sname in [s.strip() for s in subj_str.split(",") if s.strip()]:
                    s_obj = db.query(Subject).filter(Subject.name.ilike(sname)).first()
                    if s_obj:
                        db.add(TeacherSubject(teacher_id=u.id, subject_id=s_obj.id))

        created += 1
        details.append({"line": i, "status": "created", "email": email})

    db.commit()
    return {"created": created, "skipped": skipped, "details": details}


@router.patch("/users/{user_id}/status", response_model=AdminUserRead)
def toggle_status(
    user_id: int,
    payload: StatusToggle,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Activate or suspend a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return AdminUserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        is_active=user.is_active,
    )


@router.put("/users/{user_id}/class", response_model=AdminUserRead)
def assign_class(
    user_id: int,
    payload: AssignClass,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Assign a student to a class (creates StudentProfile if missing)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role.name != "student":
        raise HTTPException(status_code=400, detail="Only students can be assigned to classes")

    cls = db.query(Class).filter(Class.id == payload.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if not profile:
        count = db.query(StudentProfile).count() + 1
        profile = StudentProfile(
            user_id=user_id,
            student_code=_next_student_code(db),
        )
        db.add(profile)
    profile.class_id = payload.class_id
    db.commit()

    return AdminUserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        class_name=cls.name,
        is_active=user.is_active,
    )


# Subjects

@router.get("/subjects", response_model=List[SubjectRead])
def list_subjects(db: Session = Depends(get_db), _=_admin):
    return db.query(Subject).order_by(Subject.name).all()


# Classes

@router.get("/classes", response_model=List[ClassRead])
def list_classes(db: Session = Depends(get_db), _=_admin):
    classes = db.query(Class).all()
    result = []
    for cls in classes:
        student_count = (
            db.query(StudentProfile).filter(StudentProfile.class_id == cls.id).count()
        )
        subject_count = (
            db.query(ClassSubject).filter(ClassSubject.class_id == cls.id).count()
        )
        result.append(
            ClassRead(
                id=cls.id,
                name=cls.name,
                head_teacher_id=cls.head_teacher_id,
                head_teacher_name=cls.head_teacher.full_name if cls.head_teacher else None,
                student_count=student_count,
                subject_count=subject_count,
            )
        )
    return result


@router.post("/classes", response_model=ClassRead, status_code=201)
def create_class(payload: ClassCreate, db: Session = Depends(get_db), _=_admin):
    if db.query(Class).filter(Class.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Class name already exists")
    cls = Class(name=payload.name)
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return ClassRead(id=cls.id, name=cls.name, student_count=0, subject_count=0)


@router.put("/classes/{class_id}/manage", response_model=ClassRead)
def manage_class(
    class_id: int,
    payload: ManageClass,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Set head teacher and replace subject list + teacher mappings for a class."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # 1. Update Head Teacher
    if payload.teacher_id is not None:
        teacher = db.query(User).filter(User.id == payload.teacher_id).first()
        if not teacher or teacher.role.name != "teacher":
            raise HTTPException(status_code=400, detail="Invalid teacher id")
        cls.head_teacher_id = payload.teacher_id

    # 2. Synchronize Mappings (ClassSubjectTeacher)
    # Find subjects being removed so we can cascade-delete timetable entries
    existing_subject_ids = {
        row.subject_id
        for row in db.query(ClassSubject).filter(ClassSubject.class_id == class_id).all()
    }
    effective_subject_ids = set(payload.subject_ids)
    for m in payload.mappings:
        effective_subject_ids.add(m.subject_id)
    removed_subject_ids = existing_subject_ids - effective_subject_ids
    if removed_subject_ids:
        db.query(TimetableEntry).filter(
            TimetableEntry.class_id == class_id,
            TimetableEntry.subject_id.in_(removed_subject_ids),
        ).delete(synchronize_session=False)

    # Clear existing assignments
    db.query(ClassSubjectTeacher).filter(ClassSubjectTeacher.class_id == class_id).delete()
    db.query(ClassSubject).filter(ClassSubject.class_id == class_id).delete()

    # Calculate effective subject list (base payload subjects + subjects from mappings)
    effective_subject_ids = set(payload.subject_ids)
    
    # Add explicit mappings
    for m in payload.mappings:
        db.add(ClassSubjectTeacher(class_id=class_id, subject_id=m.subject_id, teacher_id=m.teacher_id))
        effective_subject_ids.add(m.subject_id)
        
    # Persist the subject list for the class
    for sid in effective_subject_ids:
        db.add(ClassSubject(class_id=class_id, subject_id=sid))

    db.commit()
    db.refresh(cls)

    student_count = db.query(StudentProfile).filter(StudentProfile.class_id == class_id).count()
    return ClassRead(
        id=cls.id,
        name=cls.name,
        head_teacher_id=cls.head_teacher_id,
        head_teacher_name=cls.head_teacher.full_name if cls.head_teacher else None,
        student_count=student_count,
        subject_count=len(effective_subject_ids),
    )


# Timetable

@router.get("/timetable", response_model=List[TimetableSlot])
def get_timetable_query(
    class_id: int = Query(...),
    db: Session = Depends(get_db),
    _=_admin,
):
    """GET /timetable?class_id={id} — returns [] with 200 OK if no entries exist."""
    try:
        entries = (
            db.query(TimetableEntry)
            .filter(TimetableEntry.class_id == class_id)
            .all()
        )
        return [
            TimetableSlot(
                day=e.day,
                time_slot=e.time_slot,
                subject_id=e.subject_id,
                subject_name=e.subject.name if e.subject else None,
                teacher_id=e.teacher_id,
                teacher_name=e.teacher.full_name if e.teacher else None,
                delivery_mode=e.delivery_mode,
                location_id=e.location_id,
                location_name=e.location.name if e.location else None,
                online_join_url=e.online_join_url,
            )
            for e in entries
            if e.subject is not None
        ]
    except Exception:
        return []


@router.put("/timetable", response_model=List[TimetableSlot])
def save_timetable_query(
    class_id: int = Query(...),
    payload: TimetableBulk = ...,
    db: Session = Depends(get_db),
    _=_admin,
):
    """PUT /timetable?class_id={id} — overwrite the full timetable for a class."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    for slot in payload.slots:
        if slot.time_slot == LUNCH_SLOT:
            raise HTTPException(
                status_code=400,
                detail=f"The {LUNCH_SLOT} slot is reserved for lunch and cannot be edited.",
            )

    allowed_ids = {
        row.subject_id
        for row in db.query(ClassSubject).filter(ClassSubject.class_id == class_id).all()
    }
    for slot in payload.slots:
        if slot.subject_id not in allowed_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Subject id {slot.subject_id} is not assigned to this class.",
            )

    for slot in payload.slots:
        if slot.teacher_id is not None:
            assignment = db.query(ClassSubjectTeacher).filter(
                ClassSubjectTeacher.class_id == class_id,
                ClassSubjectTeacher.subject_id == slot.subject_id,
                ClassSubjectTeacher.teacher_id == slot.teacher_id,
            ).first()
            if not assignment:
                teacher = db.query(User).filter(User.id == slot.teacher_id).first()
                t_name = teacher.full_name if teacher else f"id {slot.teacher_id}"
                subj = db.query(Subject).filter(Subject.id == slot.subject_id).first()
                s_name = subj.name if subj else f"id {slot.subject_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Teacher {t_name} is not assigned to teach {s_name} in this class.",
                )

    db.query(TimetableEntry).filter(TimetableEntry.class_id == class_id).delete()
    for slot in payload.slots:
        mode = (slot.delivery_mode or "ONSITE").upper()
        db.add(TimetableEntry(
            class_id=class_id,
            subject_id=slot.subject_id,
            teacher_id=slot.teacher_id,
            day=slot.day,
            time_slot=slot.time_slot,
            delivery_mode=mode,
            location_id=slot.location_id if mode == "ONSITE" else None,
            online_join_url=slot.online_join_url if mode == "ONLINE" else None,
        ))
    db.commit()
    return get_timetable_query(class_id, db, _)


@router.get("/timetable/{class_id}", response_model=List[TimetableSlot])
def get_timetable(class_id: int, db: Session = Depends(get_db), _=_admin):
    try:
        entries = (
            db.query(TimetableEntry)
            .filter(TimetableEntry.class_id == class_id)
            .all()
        )
        return [
            TimetableSlot(
                day=e.day,
                time_slot=e.time_slot,
                subject_id=e.subject_id,
                subject_name=e.subject.name if e.subject else None,
                teacher_id=e.teacher_id,
                teacher_name=e.teacher.full_name if e.teacher else None,
                delivery_mode=e.delivery_mode,
                location_id=e.location_id,
                location_name=e.location.name if e.location else None,
                online_join_url=e.online_join_url,
            )
            for e in entries
            if e.subject is not None  # skip orphaned entries with deleted subjects
        ]
    except Exception:
        return []


@router.post("/timetable/{class_id}/bulk", response_model=List[TimetableSlot])
def save_timetable(
    class_id: int,
    payload: TimetableBulk,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Overwrite the timetable for a class. Rejects the 12:00 lunch slot."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    for slot in payload.slots:
        if slot.time_slot == LUNCH_SLOT:
            raise HTTPException(
                status_code=400,
                detail=f"The {LUNCH_SLOT} slot is reserved for lunch and cannot be edited.",
            )

    # Validate subjects belong to this class
    allowed_ids = {
        row.subject_id
        for row in db.query(ClassSubject).filter(ClassSubject.class_id == class_id).all()
    }
    for slot in payload.slots:
        if slot.subject_id not in allowed_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Subject id {slot.subject_id} is not assigned to this class.",
            )

    # Validate teacher assignments (if teacher_id provided)
    for slot in payload.slots:
        if slot.teacher_id is not None:
            assignment = db.query(ClassSubjectTeacher).filter(
                ClassSubjectTeacher.class_id == class_id,
                ClassSubjectTeacher.subject_id == slot.subject_id,
                ClassSubjectTeacher.teacher_id == slot.teacher_id,
            ).first()
            if not assignment:
                teacher = db.query(User).filter(User.id == slot.teacher_id).first()
                t_name = teacher.full_name if teacher else f"id {slot.teacher_id}"
                subj = db.query(Subject).filter(Subject.id == slot.subject_id).first()
                s_name = subj.name if subj else f"id {slot.subject_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Teacher {t_name} is not assigned to teach {s_name} in this class.",
                )

    # Delete existing entries and replace
    db.query(TimetableEntry).filter(TimetableEntry.class_id == class_id).delete()
    for slot in payload.slots:
        mode = (slot.delivery_mode or "ONSITE").upper()
        db.add(
            TimetableEntry(
                class_id=class_id,
                subject_id=slot.subject_id,
                teacher_id=slot.teacher_id,
                day=slot.day,
                time_slot=slot.time_slot,
                delivery_mode=mode,
                location_id=slot.location_id if mode == "ONSITE" else None,
                online_join_url=slot.online_join_url if mode == "ONLINE" else None,
            )
        )
    db.commit()

    return get_timetable(class_id, db, _)


# Class-specific subjects & teachers (for Timetable Builder)

@router.get("/classes/{class_id}/subjects", response_model=List[SubjectRead])
def get_class_subjects(class_id: int, db: Session = Depends(get_db), _=_admin):
    """Return subjects assigned to a specific class."""
    rows = (
        db.query(Subject)
        .join(ClassSubject, ClassSubject.subject_id == Subject.id)
        .filter(ClassSubject.class_id == class_id)
        .order_by(Subject.name)
        .all()
    )
    return rows


@router.get("/classes/{class_id}/subjects/{subject_id}/teachers", response_model=List[TeacherRead])
def get_class_subject_teachers(
    class_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Return teachers assigned to teach a specific subject in a specific class."""
    rows = (
        db.query(User)
        .join(ClassSubjectTeacher, ClassSubjectTeacher.teacher_id == User.id)
        .filter(
            ClassSubjectTeacher.class_id == class_id,
            ClassSubjectTeacher.subject_id == subject_id,
        )
        .order_by(User.full_name)
        .all()
    )
    return [TeacherRead(id=u.id, full_name=u.full_name) for u in rows]


@router.get("/classes/{class_id}/mappings")
def get_class_mappings(class_id: int, db: Session = Depends(get_db), _=_admin):
    """Return all current subject-teacher mappings for a class (for pre-loading the manage modal)."""
    rows = db.query(ClassSubjectTeacher).filter(ClassSubjectTeacher.class_id == class_id).all()
    return [{"subject_id": r.subject_id, "teacher_id": r.teacher_id} for r in rows]


@router.get("/classes/{class_id}/config", response_model=ClassConfigRead)
def get_class_config(class_id: int, db: Session = Depends(get_db), _=_admin):
    """
    Aggregate all config data for a class in one call:
      - head_teacher_id
      - subjects currently assigned to this class
      - teacher_assignment  { subject_id: teacher_id }
      - eligible_teachers_by_subject  { subject_id: [TeacherRead] }
        (based on teacher_subjects capability, not just class assignments)
    """
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    subjects = (
        db.query(Subject)
        .join(ClassSubject, ClassSubject.subject_id == Subject.id)
        .filter(ClassSubject.class_id == class_id)
        .order_by(Subject.name)
        .all()
    )

    assignments = (
        db.query(ClassSubjectTeacher)
        .filter(ClassSubjectTeacher.class_id == class_id)
        .all()
    )
    teacher_assignment = {a.subject_id: a.teacher_id for a in assignments}

    eligible: dict = {}
    for s in subjects:
        teachers = (
            db.query(User)
            .join(TeacherSubject, TeacherSubject.teacher_id == User.id)
            .join(Role, User.role_id == Role.id)
            .filter(
                TeacherSubject.subject_id == s.id,
                Role.name == "teacher",
                User.deleted_at == None,  # noqa: E711
            )
            .order_by(User.full_name)
            .all()
        )
        eligible[s.id] = [TeacherRead(id=u.id, full_name=u.full_name) for u in teachers]

    return ClassConfigRead(
        head_teacher_id=cls.head_teacher_id,
        subjects=[SubjectRead(id=s.id, name=s.name) for s in subjects],
        teacher_assignment=teacher_assignment,
        eligible_teachers_by_subject=eligible,
    )


@router.put("/classes/{class_id}/config", response_model=ClassRead)
def update_class_config(
    class_id: int,
    payload: ClassConfigUpdate,
    db: Session = Depends(get_db),
    _=_admin,
):
    """
    Update class config atomically:
      - Set head_teacher_id
      - Sync class_subjects  (add new, remove old + cascade-delete timetable rows)
      - Sync class_subject_teachers
    Validates that each teacher in subject_teacher_map has the capability
    (exists in teacher_subjects) for that subject.
    """
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # Update head teacher
    if payload.head_teacher_id is not None:
        ht = (
            db.query(User)
            .join(Role, User.role_id == Role.id)
            .filter(User.id == payload.head_teacher_id, Role.name == "teacher")
            .first()
        )
        if not ht:
            raise HTTPException(status_code=400, detail="head_teacher_id must be a valid teacher")
        cls.head_teacher_id = payload.head_teacher_id

    # Validate teacher capabilities before touching DB
    for subject_id, teacher_id in payload.subject_teacher_map.items():
        cap = db.query(TeacherSubject).filter(
            TeacherSubject.teacher_id == teacher_id,
            TeacherSubject.subject_id == subject_id,
        ).first()
        if not cap:
            subj = db.query(Subject).filter(Subject.id == subject_id).first()
            tch = db.query(User).filter(User.id == teacher_id).first()
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Teacher '{tch.full_name if tch else teacher_id}' is not capable of "
                    f"teaching '{subj.name if subj else subject_id}'"
                ),
            )

    # Find removed subjects → cascade-delete their timetable entries
    new_subject_ids = set(payload.subjects)
    existing_subject_ids = {
        row.subject_id
        for row in db.query(ClassSubject).filter(ClassSubject.class_id == class_id).all()
    }
    removed = existing_subject_ids - new_subject_ids
    if removed:
        db.query(TimetableEntry).filter(
            TimetableEntry.class_id == class_id,
            TimetableEntry.subject_id.in_(removed),
        ).delete(synchronize_session=False)

    # Sync class_subjects
    db.query(ClassSubjectTeacher).filter(ClassSubjectTeacher.class_id == class_id).delete()
    db.query(ClassSubject).filter(ClassSubject.class_id == class_id).delete()
    for sid in payload.subjects:
        db.add(ClassSubject(class_id=class_id, subject_id=sid))

    # Sync class_subject_teachers
    for subject_id, teacher_id in payload.subject_teacher_map.items():
        if subject_id in new_subject_ids:
            db.add(ClassSubjectTeacher(
                class_id=class_id, subject_id=subject_id, teacher_id=teacher_id
            ))

    db.commit()
    db.refresh(cls)

    student_count = db.query(StudentProfile).filter(StudentProfile.class_id == class_id).count()
    return ClassRead(
        id=cls.id,
        name=cls.name,
        head_teacher_id=cls.head_teacher_id,
        head_teacher_name=cls.head_teacher.full_name if cls.head_teacher else None,
        student_count=student_count,
        subject_count=len(payload.subjects),
    )


@router.get("/subjects/{subject_id}/teachers", response_model=List[TeacherRead])
def get_subject_eligible_teachers(subject_id: int, db: Session = Depends(get_db), _=_admin):
    """Return all active teachers capable of teaching a given subject (via teacher_subjects)."""
    rows = (
        db.query(User)
        .join(TeacherSubject, TeacherSubject.teacher_id == User.id)
        .join(Role, User.role_id == Role.id)
        .filter(
            TeacherSubject.subject_id == subject_id,
            Role.name == "teacher",
            User.deleted_at == None,  # noqa: E711
        )
        .order_by(User.full_name)
        .all()
    )
    return [TeacherRead(id=u.id, full_name=u.full_name) for u in rows]


# Timetable entry CRUD + Publish (new)

from app.schemas.admin import TimetableEntryCreate, TimetableEntryUpdate, TimetablePublish, TimetableEntryOut
from app.services.timetable_service import (
    create_entry_admin as _svc_create,
    update_entry_admin as _svc_update,
    delete_entry_admin as _svc_delete,
    publish_timetable_for_class as _svc_publish,
)


@router.post("/timetable/entries", response_model=TimetableEntryOut, status_code=status.HTTP_201_CREATED)
def create_timetable_entry(
    payload: TimetableEntryCreate,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Create a single timetable entry as DRAFT (is_published=false)."""
    return TimetableEntryOut(**_svc_create(payload, db))


@router.put("/timetable/entries/{entry_id}", response_model=TimetableEntryOut)
def update_timetable_entry(
    entry_id: int,
    payload: TimetableEntryUpdate,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Update a timetable entry."""
    return TimetableEntryOut(**_svc_update(entry_id, payload, db))


@router.delete("/timetable/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Delete a timetable entry."""
    _svc_delete(entry_id, db)
    return Response(status_code=204)


@router.post("/timetable/publish")
def publish_timetable(
    payload: TimetablePublish,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Publish all draft entries for a class group. Validates conflicts."""
    count = _svc_publish(payload.class_id, db)
    return {"detail": f"Published {count} session(s) to Student & Teacher portals.", "count": count}

