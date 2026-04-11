"""
Admin Extensions API — Attendance, Fees, and Calendar endpoints.
Prefix (set in main.py): /api/v1/admin
All routes require the 'admin' role.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, and_, case
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.admin import StudentProfile, Class
from app.models.user import User
from app.models.extensions import (
    AttendanceRecord, AttendanceStatusEnum,
    AcademicPeriod, FeePlan, FeePayment, FeeInstallment,
    FeeNotificationEvent, NotificationTypeEnum,
    Event, EventTargetClass,
    Location, AttendanceSession, SessionAttendanceRecord,
    SessionStatusEnum, SessionAttendanceStatusEnum,
)
from app.models.admin import TimetableEntry
from app.schemas.extensions import (
    AttendanceUpsert, AttendanceRecordRead, AttendanceStats,
    AttendanceTrendPoint, AttendanceDistribution, ClasswiseAttendance,
    ChronicAbsentee,
    AcademicPeriodCreate, AcademicPeriodRead,
    FeePlanCreate, BulkFeePlanCreate, FeePlanUpdate, FeePaymentCreate,
    FeeStudentRead, FeeStats, FeeTrendPoint, BulkPlanResult,
    EventCreate, EventUpdate, EventRead,
    LocationRead, LocationCreate, LocationUpdate,
    AdminSessionRead, AttendanceOverviewItem,
)

router = APIRouter()
_admin = Depends(require_role("admin"))

CHRONIC_THRESHOLD = 80.0   # below this % = chronic absentee

# Attendance

def _attendance_rate(student_id: int, db: Session) -> float:
    """Overall attendance rate (%) for a student across all records."""
    total = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.student_id == student_id
    ).scalar() or 0
    if total == 0:
        return 100.0
    present = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.status.in_([AttendanceStatusEnum.Present, AttendanceStatusEnum.Late]),
    ).scalar() or 0
    return round((present / total) * 100, 1)

def _build_record_read(rec: AttendanceRecord, rate: float, history: list, db: Session) -> dict:
    sp: StudentProfile = rec.student
    user: User = sp.user
    class_name = sp.class_.name if sp.class_ else "—"
    marker: User = rec.marked_by
    return {
        "id": rec.id,
        "student_id": sp.id,
        "student_name": user.full_name,
        "student_code": sp.student_code or "",
        "class_name": class_name,
        "date": rec.date.isoformat(),
        "status": rec.status.value,
        "marked_by": marker.full_name if marker else "—",
        "attendance_rate": rate,
        "history": history,
    }

def _session_attendance_rate(user_id: int, db: Session) -> float:
    """Attendance rate (%) for a student (by users.id) from new session records."""
    total = (
        db.query(func.count(SessionAttendanceRecord.id))
        .filter(
            SessionAttendanceRecord.student_id == user_id,
            SessionAttendanceRecord.status.isnot(None),
        )
        .scalar() or 0
    )
    if total == 0:
        return 100.0
    present = (
        db.query(func.count(SessionAttendanceRecord.id))
        .filter(
            SessionAttendanceRecord.student_id == user_id,
            SessionAttendanceRecord.status.in_([
                SessionAttendanceStatusEnum.PRESENT,
                SessionAttendanceStatusEnum.LATE,
            ]),
        )
        .scalar() or 0
    )
    return round((present / total) * 100, 1)

@router.get("/attendance/stats", response_model=AttendanceStats)
def get_attendance_stats(
    date_range: str = Query("This Week", alias="range"),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    today = date.today()
    if date_range == "Today":
        start = today
    elif date_range == "This Month":
        start = today.replace(day=1)
    elif date_range == "This Term":
        start = today.replace(month=1, day=1)
    else:  # This Week (default)
        start = today - timedelta(days=today.weekday())

    days_in_range = (today - start).days + 1
    total_students = db.query(func.count(StudentProfile.id)).scalar() or 0

    # Today's counts from session records
    today_sids = [r[0] for r in db.query(AttendanceSession.id).filter(AttendanceSession.session_date == today).all()]
    if today_sids:
        today_recs = db.query(SessionAttendanceRecord).filter(
            SessionAttendanceRecord.attendance_session_id.in_(today_sids)
        ).all()
    else:
        today_recs = []
    present_today = sum(1 for r in today_recs if r.status == SessionAttendanceStatusEnum.PRESENT)
    absent_today  = sum(1 for r in today_recs if r.status == SessionAttendanceStatusEnum.ABSENT)
    late_today    = sum(1 for r in today_recs if r.status == SessionAttendanceStatusEnum.LATE)

    # Overall rate for the date range
    range_sids = [r[0] for r in db.query(AttendanceSession.id).filter(
        AttendanceSession.session_date.between(start, today)
    ).all()]
    if range_sids:
        range_total = db.query(func.count(SessionAttendanceRecord.id)).filter(
            SessionAttendanceRecord.attendance_session_id.in_(range_sids),
            SessionAttendanceRecord.status.isnot(None),
        ).scalar() or 0
        range_present = db.query(func.count(SessionAttendanceRecord.id)).filter(
            SessionAttendanceRecord.attendance_session_id.in_(range_sids),
            SessionAttendanceRecord.status.in_([
                SessionAttendanceStatusEnum.PRESENT,
                SessionAttendanceStatusEnum.LATE,
            ]),
        ).scalar() or 0
    else:
        range_total = range_present = 0
    overall_rate = round((range_present / range_total * 100), 1) if range_total else 0.0

    # Trend vs previous equal period
    prev_end   = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days_in_range - 1)
    prev_sids = [r[0] for r in db.query(AttendanceSession.id).filter(
        AttendanceSession.session_date.between(prev_start, prev_end)
    ).all()]
    if prev_sids:
        prev_total = db.query(func.count(SessionAttendanceRecord.id)).filter(
            SessionAttendanceRecord.attendance_session_id.in_(prev_sids),
            SessionAttendanceRecord.status.isnot(None),
        ).scalar() or 0
        prev_present = db.query(func.count(SessionAttendanceRecord.id)).filter(
            SessionAttendanceRecord.attendance_session_id.in_(prev_sids),
            SessionAttendanceRecord.status.in_([
                SessionAttendanceStatusEnum.PRESENT,
                SessionAttendanceStatusEnum.LATE,
            ]),
        ).scalar() or 0
    else:
        prev_total = prev_present = 0
    prev_rate = (prev_present / prev_total * 100) if prev_total else 0.0
    trend_pct = round(overall_rate - prev_rate, 1)

    return AttendanceStats(
        total_students=total_students,
        present_today=present_today,
        absent_today=absent_today,
        late_today=late_today,
        overall_rate=overall_rate,
        trend_pct=trend_pct,
    )

@router.get("/attendance/trend", response_model=List[AttendanceTrendPoint])
def get_attendance_trend(
    date_range: str = Query("This Week", alias="range"),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    today = date.today()
    if date_range == "Today":
        start = today
    elif date_range == "This Month":
        start = today.replace(day=1)
    elif date_range == "This Term":
        start = today.replace(month=1, day=1)
    else:
        start = today - timedelta(days=today.weekday())

    rows = (
        db.query(
            AttendanceSession.session_date,
            func.count(SessionAttendanceRecord.id).label("total"),
            func.sum(
                case(
                    (SessionAttendanceRecord.status.in_([
                        SessionAttendanceStatusEnum.PRESENT,
                        SessionAttendanceStatusEnum.LATE,
                    ]), 1),
                    else_=0,
                )
            ).label("present"),
        )
        .join(SessionAttendanceRecord, SessionAttendanceRecord.attendance_session_id == AttendanceSession.id)
        .filter(
            AttendanceSession.session_date.between(start, today),
            SessionAttendanceRecord.status.isnot(None),
        )
        .group_by(AttendanceSession.session_date)
        .order_by(AttendanceSession.session_date)
        .all()
    )

    return [
        AttendanceTrendPoint(
            date=r.session_date.strftime("%b %d"),
            rate=round((r.present / r.total * 100), 1) if r.total else 0.0,
        )
        for r in rows
    ]

@router.get("/attendance/distribution", response_model=AttendanceDistribution)
def get_attendance_distribution(
    date_range: str = Query("This Week", alias="range"),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    today = date.today()
    if date_range == "Today":
        start = today
    elif date_range == "This Month":
        start = today.replace(day=1)
    elif date_range == "This Term":
        start = today.replace(month=1, day=1)
    else:
        start = today - timedelta(days=today.weekday())

    range_sids = [r[0] for r in db.query(AttendanceSession.id).filter(
        AttendanceSession.session_date.between(start, today)
    ).all()]
    if not range_sids:
        return AttendanceDistribution(present=0, absent=0, late=0)

    present = db.query(func.count(SessionAttendanceRecord.id)).filter(
        SessionAttendanceRecord.attendance_session_id.in_(range_sids),
        SessionAttendanceRecord.status == SessionAttendanceStatusEnum.PRESENT,
    ).scalar() or 0
    absent = db.query(func.count(SessionAttendanceRecord.id)).filter(
        SessionAttendanceRecord.attendance_session_id.in_(range_sids),
        SessionAttendanceRecord.status == SessionAttendanceStatusEnum.ABSENT,
    ).scalar() or 0
    late = db.query(func.count(SessionAttendanceRecord.id)).filter(
        SessionAttendanceRecord.attendance_session_id.in_(range_sids),
        SessionAttendanceRecord.status == SessionAttendanceStatusEnum.LATE,
    ).scalar() or 0

    return AttendanceDistribution(present=present, absent=absent, late=late)

@router.get("/attendance/classwise", response_model=List[ClasswiseAttendance])
def get_classwise_attendance(
    date_range: str = Query("This Week", alias="range"),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    today = date.today()
    if date_range == "Today":
        start = today
    elif date_range == "This Month":
        start = today.replace(day=1)
    elif date_range == "This Term":
        start = today.replace(month=1, day=1)
    else:
        start = today - timedelta(days=today.weekday())

    rows = (
        db.query(
            Class.name.label("class_name"),
            func.count(SessionAttendanceRecord.id).label("total"),
            func.sum(
                case(
                    (SessionAttendanceRecord.status.in_([
                        SessionAttendanceStatusEnum.PRESENT,
                        SessionAttendanceStatusEnum.LATE,
                    ]), 1),
                    else_=0,
                )
            ).label("present"),
        )
        .join(TimetableEntry, TimetableEntry.class_id == Class.id)
        .join(AttendanceSession, AttendanceSession.timetable_entry_id == TimetableEntry.id)
        .join(SessionAttendanceRecord, SessionAttendanceRecord.attendance_session_id == AttendanceSession.id)
        .filter(
            AttendanceSession.session_date.between(start, today),
            SessionAttendanceRecord.status.isnot(None),
        )
        .group_by(Class.id, Class.name)
        .order_by(Class.name)
        .all()
    )

    return [
        ClasswiseAttendance(
            class_name=r.class_name,
            rate=round((r.present / r.total * 100), 1) if r.total else 0.0,
        )
        for r in rows
    ]

@router.get("/attendance/chronic", response_model=List[ChronicAbsentee])
def get_chronic_absentees(
    threshold: float = Query(CHRONIC_THRESHOLD),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    profiles = db.query(StudentProfile).all()
    result = []
    for sp in profiles:
        rate = _session_attendance_rate(sp.user_id, db)
        if rate < threshold:
            class_name = sp.class_.name if sp.class_ else "—"
            result.append(ChronicAbsentee(
                student_id=sp.id,
                student_name=sp.user.full_name,
                class_name=class_name,
                attendance_rate=rate,
            ))
    return sorted(result, key=lambda x: x.attendance_rate)

@router.get("/attendance/records", response_model=List[AttendanceRecordRead])
def get_attendance_records(
    search:     Optional[str]  = Query(None),
    class_id:   Optional[int]  = Query(None),
    att_status: Optional[str]  = Query(None, alias="status"),
    date_from:  Optional[date] = Query(None),
    date_to:    Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    """Returns session-based attendance records shaped as AttendanceRecordRead."""
    from sqlalchemy.orm import aliased

    StudentUser = aliased(User)
    MarkerUser  = aliased(User)

    q = (
        db.query(SessionAttendanceRecord, AttendanceSession, StudentProfile, StudentUser, Class, MarkerUser)
        .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
        .join(TimetableEntry, TimetableEntry.id == AttendanceSession.timetable_entry_id)
        .join(Class, Class.id == TimetableEntry.class_id)
        .join(StudentUser, StudentUser.id == SessionAttendanceRecord.student_id)
        .outerjoin(StudentProfile, StudentProfile.user_id == SessionAttendanceRecord.student_id)
        .outerjoin(MarkerUser, MarkerUser.id == SessionAttendanceRecord.marked_by_id)
        .filter(SessionAttendanceRecord.status.isnot(None))
    )

    if date_from:
        q = q.filter(AttendanceSession.session_date >= date_from)
    if date_to:
        q = q.filter(AttendanceSession.session_date <= date_to)
    if att_status:
        try:
            q = q.filter(SessionAttendanceRecord.status == SessionAttendanceStatusEnum(att_status.upper()))
        except ValueError:
            pass
    if class_id:
        q = q.filter(TimetableEntry.class_id == class_id)
    if search:
        q = q.filter(
            StudentUser.full_name.ilike(f"%{search}%") |
            StudentProfile.student_code.ilike(f"%{search}%")
        )

    rows = q.order_by(AttendanceSession.session_date.desc()).limit(200).all()

    result = []
    for sar, sess, sp, su, cls, marker in rows:
        rate = _session_attendance_rate(sar.student_id, db)
        history_recs = (
            db.query(SessionAttendanceRecord, AttendanceSession)
            .join(AttendanceSession, AttendanceSession.id == SessionAttendanceRecord.attendance_session_id)
            .filter(
                SessionAttendanceRecord.student_id == sar.student_id,
                SessionAttendanceRecord.status.isnot(None),
            )
            .order_by(AttendanceSession.session_date.desc())
            .limit(10)
            .all()
        )
        history = [{"date": h[1].session_date.isoformat(), "status": h[0].status.value} for h in history_recs]
        result.append(AttendanceRecordRead(
            id=sar.id,
            student_id=sp.id if sp else 0,
            student_name=su.full_name,
            student_code=sp.student_code if sp else "—",
            class_name=cls.name,
            date=sess.session_date.isoformat(),
            status=sar.status.value,
            marked_by=marker.full_name if marker else "—",
            attendance_rate=rate,
            history=history,
        ))

    return result

@router.post("/attendance", status_code=status.HTTP_201_CREATED)
def upsert_attendance(
    payload: AttendanceUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == payload.student_id,
        AttendanceRecord.date == payload.date,
    ).first()

    try:
        status_val = AttendanceStatusEnum(payload.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {payload.status}")

    if existing:
        existing.status       = status_val
        existing.remarks      = payload.remarks
        existing.marked_by_id = current_user.id
        db.commit()
        return {"detail": "updated"}

    rec = AttendanceRecord(
        student_id=payload.student_id,
        date=payload.date,
        status=status_val,
        marked_by_id=current_user.id,
        remarks=payload.remarks,
    )
    db.add(rec)
    db.commit()
    return {"detail": "created"}

# Fees

def _compute_fee_student(fp: FeePlan) -> dict:
    """Compute all derived fee metrics for a single FeePlan."""
    sp: StudentProfile = fp.student
    user: User = sp.user
    class_name = sp.class_.name if sp.class_ else "—"
    today = date.today()

    total_paid   = float(sum(p.amount_paid for p in fp.payments))
    total_amount = float(fp.total_amount)
    balance      = round(total_amount - total_paid, 2)

    # Status — plan says: Paid / Partially Paid / Unpaid / Overdue
    if balance <= 0:
        pay_status = "paid"
    elif total_paid > 0:
        pay_status = "partial"
    else:
        pay_status = "unpaid"

    # Overdue: installment-aware if installments exist, else fall back to plan due_date
    if fp.installments:
        is_overdue = any(
            inst.due_date < today and (balance > 0)
            for inst in fp.installments
        )
    else:
        is_overdue = (balance > 0) and (fp.due_date < today)

    installments_out = [
        {
            "id":        inst.id,
            "amount":    float(inst.amount),
            "due_date":  inst.due_date.isoformat(),
            "is_overdue": inst.due_date < today and balance > 0,
        }
        for inst in fp.installments
    ]

    history = [
        {
            "id":             p.id,
            "date":           p.payment_date.strftime("%Y-%m-%d") if p.payment_date else "",
            "amount":         float(p.amount_paid),
            "payment_method": p.payment_method.value,
            "transaction_id": p.transaction_id,
        }
        for p in sorted(fp.payments, key=lambda x: x.payment_date or datetime.min, reverse=True)
    ]

    return {
        "fee_plan_id":        fp.id,
        "student_id":         sp.id,
        "student_code":       sp.student_code or "",
        "name":               user.full_name,
        "class_name":         class_name,
        "base_amount":        float(fp.base_amount),
        "discount_amount":    float(fp.discount_amount),
        "total_fee":          total_amount,
        "amount_paid":        total_paid,
        "outstanding_balance": balance,
        "status":             pay_status,
        "due_date":           fp.due_date.isoformat(),
        "is_overdue":         is_overdue,
        "academic_period":    fp.academic_period.name if fp.academic_period else None,
        "installments":       installments_out,
        "payment_history":    history,
    }

def _build_fee_plan(payload: FeePlanCreate, db: Session) -> FeePlan:
    """Create a FeePlan (+ installments) from a FeePlanCreate payload. Does NOT commit."""
    total = float(payload.base_amount) - float(payload.discount_amount)
    fp = FeePlan(
        student_id=payload.student_id,
        academic_period_id=payload.academic_period_id,
        base_amount=payload.base_amount,
        discount_amount=payload.discount_amount,
        total_amount=total,
        due_date=payload.due_date,
    )
    db.add(fp)
    db.flush()  # get fp.id without committing

    for inst in payload.installments:
        db.add(FeeInstallment(
            fee_plan_id=fp.id,
            amount=inst.amount,
            due_date=inst.due_date,
        ))
    return fp

# Academic Periods

@router.get("/fees/academic-periods", response_model=List[AcademicPeriodRead])
def list_academic_periods(
    db: Session = Depends(get_db),
    _: None = _admin,
):
    periods = db.query(AcademicPeriod).order_by(AcademicPeriod.start_date.desc()).all()
    return [
        AcademicPeriodRead(
            id=p.id,
            name=p.name,
            start_date=p.start_date.isoformat(),
            end_date=p.end_date.isoformat(),
        )
        for p in periods
    ]

@router.post("/fees/academic-periods", status_code=status.HTTP_201_CREATED, response_model=AcademicPeriodRead)
def create_academic_period(
    payload: AcademicPeriodCreate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    period = AcademicPeriod(
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return AcademicPeriodRead(
        id=period.id,
        name=period.name,
        start_date=period.start_date.isoformat(),
        end_date=period.end_date.isoformat(),
    )

# Fee Stats & Trend

@router.get("/fees/stats", response_model=FeeStats)
def get_fee_stats(
    db: Session = Depends(get_db),
    _: None = _admin,
):
    plans = db.query(FeePlan).all()
    total_collected   = 0.0
    total_outstanding = 0.0
    fully_paid        = 0
    overdue           = 0
    today             = date.today()

    for fp in plans:
        paid    = float(sum(p.amount_paid for p in fp.payments))
        balance = float(fp.total_amount) - paid
        total_collected   += paid
        total_outstanding += max(balance, 0)
        if balance <= 0:
            fully_paid += 1
        else:
            # Overdue: installment-aware
            if fp.installments:
                if any(inst.due_date < today for inst in fp.installments):
                    overdue += 1
            elif fp.due_date < today:
                overdue += 1

    return FeeStats(
        total_collected=round(total_collected, 2),
        total_outstanding=round(total_outstanding, 2),
        fully_paid_count=fully_paid,
        overdue_count=overdue,
        total_students=len(plans),
    )

@router.get("/fees/trend", response_model=List[FeeTrendPoint])
def get_fee_trend(
    db: Session = Depends(get_db),
    _: None = _admin,
):
    rows = (
        db.query(
            func.year(FeePayment.payment_date).label("yr"),
            func.month(FeePayment.payment_date).label("mo"),
            func.sum(FeePayment.amount_paid).label("total"),
        )
        .group_by("yr", "mo")
        .order_by("yr", "mo")
        .limit(12)
        .all()
    )

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        FeeTrendPoint(label=f"{month_names[r.mo]} {r.yr}", amount=float(r.total))
        for r in rows
    ]

# Student Fee Records

@router.get("/fees/students", response_model=List[FeeStudentRead])
def get_fee_students(
    search:        Optional[str] = Query(None),
    class_id:      Optional[int] = Query(None),
    fee_status:    Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    q = db.query(FeePlan)
    if class_id:
        q = q.join(StudentProfile, FeePlan.student_id == StudentProfile.id).filter(
            StudentProfile.class_id == class_id
        )
    if search:
        q = (
            q.join(StudentProfile, FeePlan.student_id == StudentProfile.id, isouter=True)
             .join(User, StudentProfile.user_id == User.id, isouter=True)
             .filter(
                 User.full_name.ilike(f"%{search}%") | StudentProfile.student_code.ilike(f"%{search}%")
             )
        )

    plans = q.all()
    result = [_compute_fee_student(fp) for fp in plans]

    if fee_status:
        if fee_status == "overdue":
            result = [r for r in result if r["is_overdue"]]
        else:
            result = [r for r in result if r["status"] == fee_status]

    return [FeeStudentRead(**r) for r in result]

# Create / Update Plans

@router.post("/fees/plans", status_code=status.HTTP_201_CREATED, response_model=FeeStudentRead)
def create_fee_plan(
    payload: FeePlanCreate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    sp = db.query(StudentProfile).filter(StudentProfile.id == payload.student_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Student not found")

    # Duplicate check: same student + same academic period
    if payload.academic_period_id:
        existing = db.query(FeePlan).filter(
            FeePlan.student_id == payload.student_id,
            FeePlan.academic_period_id == payload.academic_period_id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A fee plan already exists for this student in this academic period",
            )

    fp = _build_fee_plan(payload, db)
    db.commit()
    db.refresh(fp)
    return FeeStudentRead(**_compute_fee_student(fp))

@router.post("/fees/plans/bulk", status_code=status.HTTP_201_CREATED, response_model=BulkPlanResult)
def create_fee_plans_bulk(
    payload: BulkFeePlanCreate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    """
    Create fee plans for all students in a class (or entire school if class_id is None).
    Skips students who already have a plan for the given academic period.
    """
    q = db.query(StudentProfile)
    if payload.class_id:
        q = q.filter(StudentProfile.class_id == payload.class_id)
    students = q.all()

    created = 0
    skipped = 0

    for sp in students:
        # Skip if duplicate plan for this period
        if payload.academic_period_id:
            exists = db.query(FeePlan).filter(
                FeePlan.student_id == sp.id,
                FeePlan.academic_period_id == payload.academic_period_id,
            ).first()
            if exists:
                skipped += 1
                continue

        single = FeePlanCreate(
            student_id=sp.id,
            base_amount=payload.base_amount,
            discount_amount=payload.discount_amount,
            due_date=payload.due_date,
            academic_period_id=payload.academic_period_id,
            installments=payload.installments,
        )
        _build_fee_plan(single, db)
        created += 1

    db.commit()
    return BulkPlanResult(created=created, skipped=skipped)

@router.patch("/fees/plans/{plan_id}", response_model=FeeStudentRead)
def update_fee_plan(
    plan_id: int,
    payload: FeePlanUpdate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    fp = db.query(FeePlan).filter(FeePlan.id == plan_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Fee plan not found")

    if payload.base_amount is not None:
        fp.base_amount = payload.base_amount
    if payload.discount_amount is not None:
        fp.discount_amount = payload.discount_amount
    # Recompute total_amount whenever base or discount changes
    fp.total_amount = float(fp.base_amount) - float(fp.discount_amount)
    if payload.due_date is not None:
        fp.due_date = payload.due_date

    db.commit()
    db.refresh(fp)
    return FeeStudentRead(**_compute_fee_student(fp))

# Record Payment

@router.post("/fees/payments", status_code=status.HTTP_201_CREATED, response_model=FeeStudentRead)
def record_payment(
    payload: FeePaymentCreate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    fp = db.query(FeePlan).filter(FeePlan.id == payload.fee_plan_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Fee plan not found")

    from app.models.extensions import PaymentMethodEnum
    try:
        method = PaymentMethodEnum(payload.payment_method)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid payment_method: {payload.payment_method}")

    payment = FeePayment(
        fee_plan_id=payload.fee_plan_id,
        amount_paid=payload.amount_paid,
        payment_method=method,
        transaction_id=payload.transaction_id,
    )
    db.add(payment)
    db.flush()

    # Log notification event immediately after payment
    notif = FeeNotificationEvent(
        type=NotificationTypeEnum.Payment_Receipt,
        student_id=fp.student_id,
        fee_plan_id=fp.id,
        trigger_date=date.today(),
    )
    db.add(notif)

    db.commit()
    db.refresh(fp)
    return FeeStudentRead(**_compute_fee_student(fp))

# Notification Trigger (daily cron)

@router.post("/fees/notifications/trigger", status_code=status.HTTP_200_OK)
def trigger_notifications(
    db: Session = Depends(get_db),
    _: None = _admin,
):
    """
    Run manually or via a daily scheduler.
    Scans installments and inserts notification events for:
      - Upcoming Due  (due in 7 days)
      - Due Today
      - Overdue       (past due, still unpaid)
    """
    today     = date.today()
    in_7_days = today + timedelta(days=7)
    counts    = {"upcoming": 0, "due_today": 0, "overdue": 0}

    plans = db.query(FeePlan).all()

    for fp in plans:
        paid    = float(sum(p.amount_paid for p in fp.payments))
        balance = float(fp.total_amount) - paid
        if balance <= 0:
            continue  # fully paid — no alerts needed

        installments = fp.installments if fp.installments else []

        if installments:
            for inst in installments:
                if inst.due_date == today:
                    db.add(FeeNotificationEvent(
                        type=NotificationTypeEnum.Due_Today,
                        student_id=fp.student_id,
                        fee_plan_id=fp.id,
                        trigger_date=today,
                    ))
                    counts["due_today"] += 1
                elif today < inst.due_date <= in_7_days:
                    db.add(FeeNotificationEvent(
                        type=NotificationTypeEnum.Upcoming_Due,
                        student_id=fp.student_id,
                        fee_plan_id=fp.id,
                        trigger_date=today,
                    ))
                    counts["upcoming"] += 1
                elif inst.due_date < today:
                    db.add(FeeNotificationEvent(
                        type=NotificationTypeEnum.Overdue,
                        student_id=fp.student_id,
                        fee_plan_id=fp.id,
                        trigger_date=today,
                    ))
                    counts["overdue"] += 1
        else:
            # No installments — use the plan-level due_date
            if fp.due_date == today:
                db.add(FeeNotificationEvent(
                    type=NotificationTypeEnum.Due_Today,
                    student_id=fp.student_id,
                    fee_plan_id=fp.id,
                    trigger_date=today,
                ))
                counts["due_today"] += 1
            elif today < fp.due_date <= in_7_days:
                db.add(FeeNotificationEvent(
                    type=NotificationTypeEnum.Upcoming_Due,
                    student_id=fp.student_id,
                    fee_plan_id=fp.id,
                    trigger_date=today,
                ))
                counts["upcoming"] += 1
            elif fp.due_date < today:
                db.add(FeeNotificationEvent(
                    type=NotificationTypeEnum.Overdue,
                    student_id=fp.student_id,
                    fee_plan_id=fp.id,
                    trigger_date=today,
                ))
                counts["overdue"] += 1

    db.commit()
    return {"detail": "Notification trigger complete", **counts}

# Fees CSV Export

@router.get("/fees/export/csv")
def export_fees_csv(
    search:     Optional[str] = Query(None),
    class_id:   Optional[int] = Query(None),
    fee_status: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    """Export fee records for students as a downloadable CSV."""
    import csv as csv_mod
    import io as io_mod

    q = db.query(FeePlan).join(
        StudentProfile, FeePlan.student_id == StudentProfile.id
    ).outerjoin(Class, StudentProfile.class_id == Class.id)

    if class_id:
        q = q.filter(StudentProfile.class_id == class_id)
    if search:
        term = f"%{search}%"
        from app.models.user import User as _U
        ids = [u.id for u in db.query(StudentProfile.id).join(_U, StudentProfile.user_id == _U.id).filter(_U.full_name.ilike(term)).all()]
        q = q.filter(FeePlan.student_id.in_(ids))

    plans = q.all()

    output = io_mod.StringIO()
    writer = csv_mod.writer(output)
    writer.writerow(["Student", "Student Code", "Class", "Base Amount", "Discount",
                     "Total Fee", "Amount Paid", "Outstanding", "Status", "Due Date"])

    for fp in plans:
        rec = _compute_fee_student(fp)
        if fee_status and rec["status"] != fee_status:
            continue
        writer.writerow([
            rec["name"], rec["student_code"], rec["class_name"],
            rec["base_amount"], rec["discount_amount"], rec["total_fee"],
            rec["amount_paid"], rec["outstanding_balance"], rec["status"],
            rec["due_date"],
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fees_report.csv"},
    )

# Calendar / Events

def _build_event_read(ev: Event) -> dict:
    def _fmt_time(t) -> Optional[str]:
        return t.strftime("%H:%M") if t else None

    return {
        "id": ev.id,
        "title": ev.title,
        "type": ev.type.value,
        "start_date": ev.start_date.isoformat(),
        "end_date": ev.end_date.isoformat(),
        "start_time": _fmt_time(ev.start_time),
        "end_time": _fmt_time(ev.end_time),
        "target_audience_type": ev.target_audience_type.value,
        "description": ev.description,
        "published": ev.published,
        "created_by": ev.created_by.full_name if ev.created_by else "—",
        "created_at": ev.created_at.isoformat() if ev.created_at else "",
        "class_ids": [etc.class_id for etc in ev.target_classes],
    }

@router.get("/events", response_model=List[EventRead])
def list_events(
    month: Optional[int] = Query(None),
    year:  Optional[int] = Query(None),
    event_type: Optional[str] = Query(None, alias="type"),
    published_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    q = db.query(Event)
    if published_only:
        q = q.filter(Event.published == True)  # noqa: E712
    if event_type:
        from app.models.extensions import EventTypeEnum
        try:
            q = q.filter(Event.type == EventTypeEnum(event_type))
        except ValueError:
            pass
    if month and year:
        from calendar import monthrange
        last_day = monthrange(year, month)[1]
        period_start = date(year, month, 1)
        period_end   = date(year, month, last_day)
        q = q.filter(Event.start_date <= period_end, Event.end_date >= period_start)

    events = q.order_by(Event.start_date).all()
    return [EventRead(**_build_event_read(ev)) for ev in events]

@router.post("/events", status_code=status.HTTP_201_CREATED, response_model=EventRead)
def create_event(
    payload: EventCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from app.models.extensions import EventTypeEnum, AudienceTypeEnum
    import datetime as _dt

    try:
        ev_type = EventTypeEnum(payload.type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid event type: {payload.type}")
    try:
        aud_type = AudienceTypeEnum(payload.target_audience_type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid audience type: {payload.target_audience_type}")

    def _parse_time(s: Optional[str]):
        if not s:
            return None
        h, m = s.split(":")
        return _dt.time(int(h), int(m))

    ev = Event(
        title=payload.title,
        type=ev_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        start_time=_parse_time(payload.start_time),
        end_time=_parse_time(payload.end_time),
        target_audience_type=aud_type,
        description=payload.description,
        published=payload.published,
        created_by_id=current_user.id,
    )
    db.add(ev)
    db.flush()

    for cid in payload.class_ids:
        db.add(EventTargetClass(event_id=ev.id, class_id=cid))

    db.commit()
    db.refresh(ev)

    # Fire WhatsApp if created as published and audience includes parents
    audience = ev.target_audience_type.value if hasattr(ev.target_audience_type, "value") else str(ev.target_audience_type)
    if ev.published and audience in ("All", "Parents"):
        from app.api.whatsapp import notify_event_published
        class_ids = [tc.class_id for tc in ev.target_classes] if ev.target_classes else []
        start_date_str = ev.start_date.strftime("%b %d, %Y") if ev.start_date else ""
        notify_event_published(
            event_id=ev.id,
            event_title=ev.title,
            event_type=ev.type.value if hasattr(ev.type, "value") else str(ev.type),
            start_date=start_date_str,
            class_ids=class_ids,
            db=db,
            background_tasks=background_tasks,
        )

    return EventRead(**_build_event_read(ev))

@router.put("/events/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    payload: EventUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    was_published = ev.published

    import datetime as _dt
    from app.models.extensions import EventTypeEnum, AudienceTypeEnum

    def _parse_time(s: Optional[str]):
        if not s:
            return None
        h, m = s.split(":")
        return _dt.time(int(h), int(m))

    if payload.title is not None:
        ev.title = payload.title
    if payload.type is not None:
        ev.type = EventTypeEnum(payload.type)
    if payload.start_date is not None:
        ev.start_date = payload.start_date
    if payload.end_date is not None:
        ev.end_date = payload.end_date
    if payload.start_time is not None:
        ev.start_time = _parse_time(payload.start_time)
    if payload.end_time is not None:
        ev.end_time = _parse_time(payload.end_time)
    if payload.target_audience_type is not None:
        ev.target_audience_type = AudienceTypeEnum(payload.target_audience_type)
    if payload.description is not None:
        ev.description = payload.description
    if payload.published is not None:
        ev.published = payload.published
    if payload.class_ids is not None:
        db.query(EventTargetClass).filter(EventTargetClass.event_id == ev.id).delete()
        for cid in payload.class_ids:
            db.add(EventTargetClass(event_id=ev.id, class_id=cid))

    db.commit()
    db.refresh(ev)

    # Fire WhatsApp if event just became published and audience includes parents
    audience = ev.target_audience_type.value if hasattr(ev.target_audience_type, "value") else str(ev.target_audience_type)
    if ev.published and not was_published and audience in ("All", "Parents"):
        from app.api.whatsapp import notify_event_published
        class_ids = [tc.class_id for tc in ev.target_classes] if ev.target_classes else []
        start_date_str = ev.start_date.strftime("%b %d, %Y") if ev.start_date else ""
        notify_event_published(
            event_id=ev.id,
            event_title=ev.title,
            event_type=ev.type.value if hasattr(ev.type, "value") else str(ev.type),
            start_date=start_date_str,
            class_ids=class_ids,
            db=db,
            background_tasks=background_tasks,
        )

    return EventRead(**_build_event_read(ev))

@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    from fastapi import Response
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(ev)
    db.commit()
    return Response(status_code=204)

@router.patch("/events/{event_id}/publish", response_model=EventRead)
def toggle_event_publish(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    was_published = ev.published
    ev.published = not ev.published
    db.commit()
    db.refresh(ev)

    # WhatsApp: fire only when transitioning to published, for All/Parents audience
    audience = ev.target_audience_type.value if hasattr(ev.target_audience_type, "value") else str(ev.target_audience_type)
    if ev.published and not was_published and audience in ("All", "Parents"):
        from app.api.whatsapp import notify_event_published
        class_ids = [tc.class_id for tc in ev.target_classes] if ev.target_classes else []
        start_date_str = ev.start_date.strftime("%b %d, %Y") if ev.start_date else ""
        notify_event_published(
            event_id=ev.id,
            event_title=ev.title,
            event_type=ev.type.value if hasattr(ev.type, "value") else str(ev.type),
            start_date=start_date_str,
            class_ids=class_ids,
            db=db,
            background_tasks=background_tasks,
        )

    return EventRead(**_build_event_read(ev))

# Locations

@router.get("/locations", response_model=List[LocationRead])
def list_locations(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    q = db.query(Location)
    if active_only:
        q = q.filter(Location.is_active == True)  # noqa: E712
    return q.order_by(Location.name).all()

@router.post("/locations", status_code=201, response_model=LocationRead)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    loc = Location(name=payload.name, type=payload.type, capacity=payload.capacity)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@router.put("/locations/{location_id}", response_model=LocationRead)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    if payload.name is not None:
        loc.name = payload.name
    if payload.type is not None:
        loc.type = payload.type
    if payload.capacity is not None:
        loc.capacity = payload.capacity
    if payload.is_active is not None:
        loc.is_active = payload.is_active
    db.commit()
    db.refresh(loc)
    return loc

@router.delete("/locations/{location_id}", status_code=204)
def deactivate_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: None = _admin,
):
    from fastapi import Response as FastAPIResponse
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    loc.is_active = False
    db.commit()
    return FastAPIResponse(status_code=204)

# Attendance Sessions Overview (Session-Based)

def _session_counts(session: AttendanceSession) -> dict:
    counts = {"total": 0, "present": 0, "absent": 0, "late": 0, "excused": 0, "unmarked": 0}
    for r in session.records:
        counts["total"] += 1
        if r.status == SessionAttendanceStatusEnum.PRESENT:
            counts["present"] += 1
        elif r.status == SessionAttendanceStatusEnum.ABSENT:
            counts["absent"] += 1
        elif r.status == SessionAttendanceStatusEnum.LATE:
            counts["late"] += 1
        elif r.status == SessionAttendanceStatusEnum.EXCUSED:
            counts["excused"] += 1
        else:
            counts["unmarked"] += 1
    return counts

@router.get("/attendance/sessions", response_model=List[AdminSessionRead])
def admin_list_sessions(
    class_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: None = _admin,
):
    q = db.query(AttendanceSession)
    if class_id:
        q = q.join(TimetableEntry, TimetableEntry.id == AttendanceSession.timetable_entry_id) \
             .filter(TimetableEntry.class_id == class_id)
    if date_from:
        try:
            q = q.filter(AttendanceSession.session_date >= date.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(AttendanceSession.session_date <= date.fromisoformat(date_to))
        except ValueError:
            pass
    if status:
        try:
            q = q.filter(AttendanceSession.status == SessionStatusEnum(status.upper()))
        except ValueError:
            pass

    sessions = q.order_by(AttendanceSession.session_date.desc()).all()
    result = []
    for s in sessions:
        entry = db.query(TimetableEntry).filter(TimetableEntry.id == s.timetable_entry_id).first()
        counts = _session_counts(s)
        result.append(AdminSessionRead(
            session_id=s.id,
            class_name=entry.class_.name    if entry and entry.class_   else "—",
            subject_name=entry.subject.name if entry and entry.subject  else "—",
            teacher_name=entry.teacher.full_name if entry and entry.teacher else "—",
            session_date=s.session_date.isoformat(),
            status=s.status.value,
            total_students=counts["total"],
            present_count=counts["present"],
            absent_count=counts["absent"],
            late_count=counts["late"],
            excused_count=counts["excused"],
            unmarked_count=counts["unmarked"],
        ))
    return result

@router.get("/attendance/overview", response_model=List[AttendanceOverviewItem])
def admin_attendance_overview(
    db: Session = Depends(get_db),
    _: None = _admin,
):
    """Aggregated attendance rate by class+subject from session records."""
    sessions = db.query(AttendanceSession).all()

    # Aggregate by (class_id, subject_id)
    from collections import defaultdict
    bucket: dict = defaultdict(lambda: {"sessions": 0, "present": 0, "total_marked": 0,
                                         "class_name": "—", "subject_name": "—"})
    for s in sessions:
        entry = db.query(TimetableEntry).filter(TimetableEntry.id == s.timetable_entry_id).first()
        if not entry:
            continue
        key = (entry.class_id, entry.subject_id)
        bucket[key]["class_name"]   = entry.class_.name   if entry.class_   else "—"
        bucket[key]["subject_name"] = entry.subject.name  if entry.subject  else "—"
        bucket[key]["sessions"] += 1
        for r in s.records:
            if r.status in (SessionAttendanceStatusEnum.PRESENT, SessionAttendanceStatusEnum.LATE,
                            SessionAttendanceStatusEnum.ABSENT):
                bucket[key]["total_marked"] += 1
                if r.status in (SessionAttendanceStatusEnum.PRESENT, SessionAttendanceStatusEnum.LATE):
                    bucket[key]["present"] += 1

    items = []
    for data in bucket.values():
        denom = data["total_marked"]
        rate  = round(data["present"] / denom * 100, 1) if denom > 0 else 100.0
        items.append(AttendanceOverviewItem(
            class_name=data["class_name"],
            subject_name=data["subject_name"],
            total_sessions=data["sessions"],
            avg_attendance_rate=rate,
        ))
    items.sort(key=lambda x: (x.class_name, x.subject_name))
    return items
