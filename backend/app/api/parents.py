"""
Parent API — attendance, fees, events, grades endpoints.
Prefix (set in main.py): /api/v1/parents
"""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from app.core.security import hash_password, verify_password
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.admin import ParentStudent, StudentProfile
from app.models.extensions import (
    Assignment,
    FeePlan,
    Event,
    Submission,
    SubmissionStatusEnum,
)
from app.models.user import User
from app.schemas.extensions import StudentAttendanceSummary
from app.schemas.parents import (
    ParentFeeStatus, ParentPaymentRecord,
    ParentEventItem,
    ParentGradeItem,
    ParentGradesSummary,
)
from app.api.students import _build_student_summary

router = APIRouter()


class ParentChild(BaseModel):
    id: int
    name: str


def _check_link(parent_id: int, student_id: int, db: Session) -> None:
    """Raises 403 if student_id is not linked to parent_id."""
    link = (
        db.query(ParentStudent)
        .filter(
            ParentStudent.parent_id == parent_id,
            ParentStudent.student_id == student_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=403, detail="This student is not linked to your account.")


@router.get("/children", response_model=List[ParentChild])
def get_parent_children(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """GET /parents/children — list of students linked to this parent."""
    links = (
        db.query(ParentStudent, User)
        .join(User, User.id == ParentStudent.student_id)
        .filter(ParentStudent.parent_id == current_user.id)
        .all()
    )
    return [ParentChild(id=user.id, name=user.full_name) for _, user in links]


@router.get("/attendance/{student_id}", response_model=StudentAttendanceSummary)
def parent_child_attendance(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """
    GET /parents/attendance/{student_id}
    Returns attendance summary for a linked child.
    The student_id is the User.id of the child (not student_profile.id).
    """
    _check_link(current_user.id, student_id, db)
    return _build_student_summary(student_id, db)


@router.get("/{student_id}/fees", response_model=ParentFeeStatus)
def parent_child_fees(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """GET /parents/{student_id}/fees — fee status for a linked child."""
    _check_link(current_user.id, student_id, db)

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
    if not profile:
        return ParentFeeStatus(
            has_plan=False, status="no_plan",
            total_fee=0, amount_paid=0, outstanding_balance=0,
            due_date=None, is_overdue=False, academic_period=None, payment_history=[],
        )

    fee_plan = (
        db.query(FeePlan)
        .filter(FeePlan.student_id == profile.id)
        .order_by(FeePlan.created_at.desc())
        .first()
    )
    if not fee_plan:
        return ParentFeeStatus(
            has_plan=False, status="no_plan",
            total_fee=0, amount_paid=0, outstanding_balance=0,
            due_date=None, is_overdue=False, academic_period=None, payment_history=[],
        )

    amount_paid = sum(float(p.amount_paid) for p in fee_plan.payments)
    total_fee = float(fee_plan.total_amount)
    outstanding = total_fee - amount_paid
    is_overdue = fee_plan.due_date < date.today() and outstanding > 0

    if outstanding <= 0:
        status = "paid"
    elif is_overdue:
        status = "overdue"
    elif amount_paid > 0:
        status = "partial"
    else:
        status = "unpaid"

    payment_history = [
        ParentPaymentRecord(
            id=p.id,
            date=p.payment_date.strftime("%b %d, %Y") if p.payment_date else "",
            amount=float(p.amount_paid),
            payment_method=p.payment_method,
            transaction_id=p.transaction_id,
        )
        for p in sorted(fee_plan.payments, key=lambda p: p.payment_date or date.min, reverse=True)
    ]

    academic_period = fee_plan.academic_period.name if fee_plan.academic_period else None

    return ParentFeeStatus(
        has_plan=True,
        status=status,
        total_fee=total_fee,
        amount_paid=amount_paid,
        outstanding_balance=max(0.0, outstanding),
        due_date=fee_plan.due_date.strftime("%b %d, %Y") if fee_plan.due_date else None,
        is_overdue=is_overdue,
        academic_period=academic_period,
        payment_history=payment_history,
    )


@router.get("/{student_id}/events", response_model=List[ParentEventItem])
def parent_child_events(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """GET /parents/{student_id}/events — all published events for a linked child."""
    _check_link(current_user.id, student_id, db)

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
    class_id = profile.class_id if profile else None

    events = (
        db.query(Event)
        .filter(Event.published == True)  # noqa: E712
        .order_by(Event.start_date.asc())
        .all()
    )

    result = []
    for event in events:
        audience = event.target_audience_type
        if audience in ("All", "Students", "Parents"):
            include = True
        elif audience == "Specific Classes" and class_id:
            include = any(tc.class_id == class_id for tc in event.target_classes)
        else:
            include = False

        if include:
            result.append(ParentEventItem(
                id=event.id,
                title=event.title,
                type=event.type,
                start_date=event.start_date.strftime("%b %d, %Y"),
                end_date=event.end_date.strftime("%b %d, %Y"),
                start_time=event.start_time.strftime("%I:%M %p") if event.start_time else None,
                end_time=event.end_time.strftime("%I:%M %p") if event.end_time else None,
                description=event.description,
            ))

    return result


@router.get("/{student_id}/grades", response_model=ParentGradesSummary)
def parent_child_grades(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """GET /parents/{student_id}/grades — published grade summary for a linked child."""
    _check_link(current_user.id, student_id, db)

    submissions = (
        db.query(Submission)
        .options(
            joinedload(Submission.assignment).joinedload(Assignment.subject)
        )
        .filter(
            Submission.student_id == student_id,
            Submission.status == SubmissionStatusEnum.PUBLISHED,
            Submission.grade.isnot(None),
        )
        .order_by(Submission.updated_at.desc())
        .all()
    )

    if not submissions:
        return ParentGradesSummary(overall_grade=None, items=[])

    items = []
    scores = []
    for sub in submissions:
        asgn = sub.assignment
        if not asgn:
            continue
        max_score = float(asgn.max_score) if asgn.max_score else 100.0
        score = float(sub.grade)
        pct = round((score / max_score * 100), 1) if max_score > 0 else 0.0
        scores.append(pct)

        subject_name = asgn.subject.name if asgn.subject else "Unknown"
        date_val = sub.updated_at or asgn.due_at or asgn.created_at
        date_str = date_val.strftime("%b %d, %Y") if date_val else ""

        items.append(ParentGradeItem(
            subject=subject_name,
            assessment=asgn.title,
            date=date_str,
            grade=f"{score:.0f} / {max_score:.0f}",
            percentage=pct,
        ))

    overall_grade = f"{round(sum(scores) / len(scores)):.0f}%" if scores else None
    return ParentGradesSummary(overall_grade=overall_grade, items=items)


@router.get("/profile")
def parent_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """GET /parents/profile — profile info for the logged-in parent."""
    links = (
        db.query(ParentStudent, User)
        .join(User, User.id == ParentStudent.student_id)
        .filter(ParentStudent.parent_id == current_user.id)
        .all()
    )
    children = [{"id": u.id, "name": u.full_name} for _, u in links]
    return {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "children": children,
    }


@router.patch("/profile/password")
def parent_change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """PATCH /parents/profile/password — change own password."""
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
def list_parents():
    return {"message": "Parents endpoint — coming soon"}
