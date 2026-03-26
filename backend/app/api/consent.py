"""
Consent Management API — GDPR-compliant granular consent for AI biometric features.

Endpoints:
  GET  /consent/my                    — Student: get/initialize own consent records
  POST /consent/save                  — Student or Parent: batch-save consent choices
  POST /consent/withdraw              — Withdraw a single consent type
  GET  /consent/compliance/overview   — Admin: institution-wide compliance stats
  POST /consent/bulk-request          — Admin: ensure pending records exist for all students
  GET  /consent/class/{class_id}      — Teacher/Admin: class consent summary
  GET  /consent/audit/{student_id}    — Admin/Teacher: full audit history
  GET  /consent/{student_id}          — Admin/Teacher: view a student's consents
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.extensions import ConsentAuditLog, ConsentRecord
from app.models.user import User
from app.schemas.extensions import (
    ClassConsentSummary,
    ComplianceOverview,
    ConsentAuditLogRead,
    ConsentRecordRead,
    ConsentSaveRequest,
    ConsentTypeStats,
    ConsentWithdrawRequest,
)

router = APIRouter()

CONSENT_TYPES = ["emotion_detection", "session_recording", "transcript_generation"]
CONSENT_VERSION = "v1.0"
EXPIRY_DAYS = 365


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_consent_records(db: Session, student_id: int) -> List[ConsentRecord]:
    """Idempotently create 'pending' records for any missing consent types."""
    existing = {
        r.consent_type: r
        for r in db.query(ConsentRecord).filter(
            ConsentRecord.student_id == student_id
        ).all()
    }
    for ct in CONSENT_TYPES:
        if ct not in existing:
            record = ConsentRecord(
                student_id=student_id,
                consent_type=ct,
                status="pending",
                consent_version=CONSENT_VERSION,
            )
            db.add(record)
    db.commit()
    return db.query(ConsentRecord).filter(
        ConsentRecord.student_id == student_id
    ).all()


def _log_action(
    db: Session,
    consent: ConsentRecord,
    action: str,
    performed_by: int,
    ip: Optional[str] = None,
    previous_status: Optional[str] = None,
    notes: Optional[str] = None,
):
    log = ConsentAuditLog(
        consent_id=consent.id,
        action=action,
        performed_by=performed_by,
        previous_status=previous_status,
        new_status=consent.status,
        ip_address=ip,
        notes=notes,
    )
    db.add(log)


def _record_to_dict(record: ConsentRecord, db: Session) -> dict:
    grantor_name = None
    if record.granted_by:
        u = db.query(User).filter(User.id == record.granted_by).first()
        if u:
            grantor_name = u.full_name
    return {
        "id": record.id,
        "student_id": record.student_id,
        "consent_type": record.consent_type,
        "status": record.status,
        "granted_by": record.granted_by,
        "granted_by_name": grantor_name,
        "consent_version": record.consent_version,
        "expiry_date": str(record.expiry_date) if record.expiry_date else None,
        "ip_address": record.ip_address,
        "created_at": str(record.created_at) if record.created_at else None,
        "updated_at": str(record.updated_at) if record.updated_at else None,
    }


def _audit_to_dict(log: ConsentAuditLog) -> dict:
    return {
        "log_id": log.log_id,
        "consent_id": log.consent_id,
        "action": log.action,
        "performed_by": log.performed_by,
        "previous_status": log.previous_status,
        "new_status": log.new_status,
        "timestamp": str(log.timestamp) if log.timestamp else None,
        "ip_address": log.ip_address,
        "notes": log.notes,
    }


def _get_client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


# ── Student endpoints ─────────────────────────────────────────────────────────

@router.get("/my")
def get_my_consents(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    """Student: get own consent records (auto-creates 'pending' rows on first visit)."""
    records = _ensure_consent_records(db, current_user.id)
    return [_record_to_dict(r, db) for r in records]


# ── Shared: save / withdraw ───────────────────────────────────────────────────

@router.post("/save")
def save_consents(
    request: Request,
    payload: ConsentSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student or Parent: batch-save consent choices (grant / refuse)."""
    ip = _get_client_ip(request)
    role = current_user.role.name

    # Determine which student's consents we're updating
    if role == "student":
        student_id = current_user.id
    elif role == "parent":
        if not payload.student_id:
            raise HTTPException(status_code=400, detail="Parents must provide student_id.")
        student_id = payload.student_id
        # Verify parent–student relationship
        from app.models.admin import ParentStudent  # avoid circular import
        link = db.query(ParentStudent).filter(
            ParentStudent.parent_id == current_user.id,
            ParentStudent.student_id == student_id,
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="You are not linked to this student.")
    else:
        raise HTTPException(status_code=403, detail="Only students or parents can save consent.")

    _ensure_consent_records(db, student_id)

    for item in payload.consents:
        if item.consent_type not in CONSENT_TYPES:
            continue
        if item.status not in ("granted", "refused"):
            continue

        record = db.query(ConsentRecord).filter(
            ConsentRecord.student_id == student_id,
            ConsentRecord.consent_type == item.consent_type,
        ).first()
        if not record:
            continue

        prev = record.status
        record.status = item.status
        record.granted_by = current_user.id
        record.ip_address = ip
        record.consent_version = CONSENT_VERSION
        if item.status == "granted":
            record.expiry_date = date.today() + timedelta(days=EXPIRY_DAYS)

        action = "granted" if item.status == "granted" else "refused"
        _log_action(db, record, action, current_user.id, ip, prev)

    db.commit()
    return {"detail": "Consent preferences saved."}


@router.get("/child/{student_id}")
def get_child_consents(
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent")),
):
    """Parent: get consent records for their child (verifies parent–student link)."""
    from app.models.admin import ParentStudent
    link = db.query(ParentStudent).filter(
        ParentStudent.parent_id == current_user.id,
        ParentStudent.student_id == student_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="You are not linked to this student.")
    records = _ensure_consent_records(db, student_id)
    return [_record_to_dict(r, db) for r in records]


@router.post("/withdraw")
def withdraw_consent(
    request: Request,
    payload: ConsentWithdrawRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student or Parent: withdraw a single consent type."""
    ip = _get_client_ip(request)
    role = current_user.role.name

    if role == "student":
        student_id = current_user.id
    elif role == "parent":
        if not payload.student_id:
            raise HTTPException(status_code=400, detail="Parents must provide student_id.")
        student_id = payload.student_id
        from app.models.admin import ParentStudent
        link = db.query(ParentStudent).filter(
            ParentStudent.parent_id == current_user.id,
            ParentStudent.student_id == student_id,
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="You are not linked to this student.")
    else:
        raise HTTPException(status_code=403, detail="Access denied.")

    if payload.consent_type not in CONSENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid consent_type.")

    record = db.query(ConsentRecord).filter(
        ConsentRecord.student_id == student_id,
        ConsentRecord.consent_type == payload.consent_type,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Consent record not found.")

    prev = record.status
    record.status = "withdrawn"
    record.ip_address = ip
    _log_action(db, record, "withdrawn", current_user.id, ip, prev)
    db.commit()
    return {"detail": "Consent withdrawn."}


# ── Admin / Teacher endpoints ─────────────────────────────────────────────────

@router.get("/compliance/overview")
def get_compliance_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Admin: institution-wide consent compliance statistics."""
    from app.models.admin import StudentProfile

    total_students = db.query(StudentProfile).count()
    consent_types = []

    for ct in CONSENT_TYPES:
        granted = db.query(ConsentRecord).filter(
            ConsentRecord.consent_type == ct,
            ConsentRecord.status == "granted",
        ).count()
        refused = db.query(ConsentRecord).filter(
            ConsentRecord.consent_type == ct,
            ConsentRecord.status == "refused",
        ).count()
        withdrawn = db.query(ConsentRecord).filter(
            ConsentRecord.consent_type == ct,
            ConsentRecord.status.in_(["withdrawn", "expired"]),
        ).count()
        pending = max(total_students - granted - refused - withdrawn, 0)
        rate = round(granted / total_students * 100, 1) if total_students else 0.0

        consent_types.append({
            "type": ct,
            "granted": granted,
            "refused": refused,
            "pending": pending,
            "withdrawn": withdrawn,
            "rate": rate,
        })

    return {"total_students": total_students, "consent_types": consent_types}


@router.post("/bulk-request")
def bulk_consent_request(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Admin: ensure all students have consent records (initialise pending rows)."""
    from app.models.admin import StudentProfile

    students = db.query(StudentProfile).all()
    count = 0
    for s in students:
        records = _ensure_consent_records(db, s.user_id)
        if any(r.status == "pending" for r in records):
            count += 1

    return {"detail": f"Consent records initialised. {count} student(s) have pending decisions."}


@router.get("/class/{class_id}")
def get_class_consent_summary(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "teacher")),
):
    """Teacher/Admin: consent summary for all students in a class."""
    from app.models.admin import StudentProfile

    students = db.query(StudentProfile).filter(
        StudentProfile.class_id == class_id
    ).all()
    total = len(students)
    consent_types = []

    for ct in CONSENT_TYPES:
        granted = refused = pending = withdrawn = 0
        for s in students:
            rec = db.query(ConsentRecord).filter(
                ConsentRecord.student_id == s.user_id,
                ConsentRecord.consent_type == ct,
            ).first()
            if not rec or rec.status == "pending":
                pending += 1
            elif rec.status == "granted":
                granted += 1
            elif rec.status == "refused":
                refused += 1
            else:
                withdrawn += 1
        consent_types.append({
            "type": ct,
            "granted": granted,
            "refused": refused,
            "pending": pending,
            "withdrawn": withdrawn,
        })

    return {"total_students": total, "consent_types": consent_types}


@router.get("/audit/{student_id}")
def get_audit_log(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "teacher")),
):
    """Admin/Teacher: full audit history for a student's consent changes."""
    consent_ids = [
        r.id for r in
        db.query(ConsentRecord).filter(ConsentRecord.student_id == student_id).all()
    ]
    logs = (
        db.query(ConsentAuditLog)
        .filter(ConsentAuditLog.consent_id.in_(consent_ids))
        .order_by(ConsentAuditLog.timestamp.desc())
        .all()
    )
    return [_audit_to_dict(log) for log in logs]


@router.get("/{student_id}")
def get_student_consents(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "teacher")),
):
    """Admin/Teacher: view a student's consent records."""
    records = _ensure_consent_records(db, student_id)
    return [_record_to_dict(r, db) for r in records]
