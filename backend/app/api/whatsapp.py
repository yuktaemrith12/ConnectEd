"""
WhatsApp Notifications API — parent + student settings + outbound notification helpers.

Prefixes (set in main.py):
  /api/v1/parents/whatsapp   (backward-compat, parent-only)
  /api/v1/whatsapp           (generalised, parent or student)
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.extensions import (
    WhatsAppNotificationSetting,
    WhatsAppSentLog,
    WhatsAppDeliveryLog,
    WhatsAppOptout,
)
from app.models.admin import ParentStudent
from app.models.user import User
from app.schemas.extensions import WhatsAppSettings, WhatsAppSettingsUpdate
from app.services import whatsapp_service

logger = logging.getLogger("connected.whatsapp_api")

router = APIRouter()


# Helpers

def _get_or_create_settings(user: User, db: Session) -> WhatsAppNotificationSetting:
    """Return existing row or create defaults for a parent or student user."""
    if user.role.name == "student":
        row = (
            db.query(WhatsAppNotificationSetting)
            .filter(WhatsAppNotificationSetting.student_user_id == user.id)
            .first()
        )
        if not row:
            row = WhatsAppNotificationSetting(student_user_id=user.id)
            db.add(row)
            db.commit()
            db.refresh(row)
    else:  # parent
        row = (
            db.query(WhatsAppNotificationSetting)
            .filter(WhatsAppNotificationSetting.parent_user_id == user.id)
            .first()
        )
        if not row:
            row = WhatsAppNotificationSetting(parent_user_id=user.id)
            db.add(row)
            db.commit()
            db.refresh(row)
    return row


def _already_sent_parent(parent_user_id: int, event_key: str, db: Session) -> bool:
    return (
        db.query(WhatsAppSentLog)
        .filter(
            WhatsAppSentLog.parent_user_id == parent_user_id,
            WhatsAppSentLog.event_key == event_key,
        )
        .first()
    ) is not None


def _already_sent_student(student_user_id: int, event_key: str, db: Session) -> bool:
    return (
        db.query(WhatsAppSentLog)
        .filter(
            WhatsAppSentLog.student_user_id == student_user_id,
            WhatsAppSentLog.event_key == event_key,
        )
        .first()
    ) is not None


def _mark_sent_parent(parent_user_id: int, event_key: str, db: Session) -> None:
    try:
        db.add(WhatsAppSentLog(parent_user_id=parent_user_id, event_key=event_key))
        db.commit()
    except IntegrityError:
        db.rollback()


def _mark_sent_student(student_user_id: int, event_key: str, db: Session) -> None:
    try:
        db.add(WhatsAppSentLog(student_user_id=student_user_id, event_key=event_key))
        db.commit()
    except IntegrityError:
        db.rollback()


def _parents_of_student(student_user_id: int, db: Session):
    """Return all parent User rows linked to a student."""
    return (
        db.query(User)
        .join(ParentStudent, ParentStudent.parent_id == User.id)
        .filter(ParentStudent.student_id == student_user_id)
        .all()
    )


def _student_settings(student_user_id: int, db: Session) -> Optional[WhatsAppNotificationSetting]:
    return (
        db.query(WhatsAppNotificationSetting)
        .filter(WhatsAppNotificationSetting.student_user_id == student_user_id)
        .first()
    )


# Settings Endpoints

@router.get("/settings", response_model=WhatsAppSettings)
def get_whatsapp_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent", "student")),
):
    """GET /whatsapp/settings — return current settings (creates defaults if absent)."""
    return _get_or_create_settings(current_user, db)


@router.patch("/settings", response_model=WhatsAppSettings)
def update_whatsapp_settings(
    payload: WhatsAppSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent", "student")),
):
    """
    PATCH /whatsapp/settings
    Supply phone_number to connect (sets is_connected=True).
    Omit or null phone_number to only toggle notification types.
    """
    row = _get_or_create_settings(current_user, db)

    if payload.phone_number is not None:
        phone = payload.phone_number.strip()
        if not phone.startswith("+"):
            raise HTTPException(
                status_code=422,
                detail="Phone number must be in E.164 format (e.g. +60123456789).",
            )
        row.phone_number = phone
        row.is_connected = True

    if payload.notify_exams is not None:
        row.notify_exams = payload.notify_exams
    if payload.notify_events is not None:
        row.notify_events = payload.notify_events
    if payload.notify_attendance is not None:
        row.notify_attendance = payload.notify_attendance
    if payload.notify_messages is not None:
        row.notify_messages = payload.notify_messages
    if payload.notify_grades is not None:
        row.notify_grades = payload.notify_grades
    if payload.notify_assignments is not None:
        row.notify_assignments = payload.notify_assignments
    if payload.notify_due_reminders is not None:
        row.notify_due_reminders = payload.notify_due_reminders

    db.commit()
    db.refresh(row)
    return row


@router.post("/disconnect", status_code=204)
def disconnect_whatsapp(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("parent", "student")),
):
    """POST /whatsapp/disconnect — removes phone number and marks disconnected."""
    row = _get_or_create_settings(current_user, db)
    row.phone_number = None
    row.is_connected = False
    db.commit()
    return Response(status_code=204)


@router.post("/trigger-due-reminders", status_code=204)
def trigger_due_reminders(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """
    POST /whatsapp/trigger-due-reminders (admin only)
    Fires assignment due-in-24h WhatsApp reminders for all eligible students.
    Call this from a cron job (e.g. once per hour or once per day).
    """
    notify_assignment_due_reminder(db=db, background_tasks=background_tasks)
    return Response(status_code=204)


# Webhook Endpoints (public — no auth)

@router.get("/webhook")
def verify_webhook(
    hub_mode:          str = Query(None, alias="hub.mode"),
    hub_challenge:     str = Query(None, alias="hub.challenge"),
    hub_verify_token:  str = Query(None, alias="hub.verify_token"),
):
    """
    GET /whatsapp/webhook — Meta hub.challenge verification.
    Meta calls this URL once to verify ownership before saving the callback URL
    in the Developer Console. Responds with the raw challenge string on success.
    """
    from app.core.config import settings as _cfg
    if hub_mode == "subscribe" and hub_verify_token == _cfg.META_WEBHOOK_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification failed.")


@router.post("/webhook", status_code=200)
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """
    POST /whatsapp/webhook — incoming event handler.

    Handles three event types from Meta:
      1. statuses  — delivery receipts (sent / delivered / read / failed)
      2. messages  — inbound text: STOP opt-out processing + reply logging
      3. errors    — message-level send failures (captured in delivery log)
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "ignored"}

    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})

            # Delivery receipts
            for status_obj in value.get("statuses", []):
                wa_msg_id = status_obj.get("id")
                phone     = status_obj.get("recipient_id", "")
                status    = status_obj.get("status")
                errors    = status_obj.get("errors", [])
                err_code  = errors[0].get("code")  if errors else None
                err_msg   = errors[0].get("title") if errors else None

                if wa_msg_id and status:
                    try:
                        existing = (
                            db.query(WhatsAppDeliveryLog)
                            .filter(
                                WhatsAppDeliveryLog.wa_message_id == wa_msg_id,
                                WhatsAppDeliveryLog.status == status,
                            )
                            .first()
                        )
                        if not existing:
                            db.add(WhatsAppDeliveryLog(
                                wa_message_id=wa_msg_id,
                                recipient_phone=phone,
                                status=status,
                                error_code=err_code,
                                error_message=err_msg,
                            ))
                            db.commit()
                    except Exception as exc:
                        db.rollback()
                        logger.error("Failed to save delivery log: %s", exc)

            # Inbound messages (opt-out + reply logging)
            for msg in value.get("messages", []):
                from_phone = msg.get("from", "")
                text       = msg.get("text", {}).get("body", "").strip().upper()

                if text in ("STOP", "UNSUBSCRIBE", "OPTOUT", "CANCEL"):
                    phone_e164 = f"+{from_phone}" if not from_phone.startswith("+") else from_phone
                    try:
                        if not db.query(WhatsAppOptout).filter(WhatsAppOptout.phone_number == phone_e164).first():
                            db.add(WhatsAppOptout(phone_number=phone_e164))
                            db.commit()
                        # Also flip is_connected=False on any matching settings row
                        row = (
                            db.query(WhatsAppNotificationSetting)
                            .filter(WhatsAppNotificationSetting.phone_number == phone_e164)
                            .first()
                        )
                        if row:
                            row.is_connected = False
                            db.commit()
                        logger.info("WhatsApp opt-out processed for %s", phone_e164)
                    except Exception as exc:
                        db.rollback()
                        logger.error("Opt-out processing failed for %s: %s", from_phone, exc)

    return {"status": "ok"}


@router.get("/health")
def whatsapp_health_check(_: User = Depends(require_role("admin"))):
    """
    GET /whatsapp/health (admin only)
    Calls Meta's phone number info endpoint to verify the token and phone
    number ID are still valid — without sending a real message.
    """
    import requests as _req
    from app.core.config import settings as _cfg
    token    = _cfg.META_WHATSAPP_TOKEN
    phone_id = _cfg.META_PHONE_NUMBER_ID
    if not token or not phone_id:
        return {"status": "not_configured"}
    url  = f"https://graph.facebook.com/v22.0/{phone_id}"
    resp = _req.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=8)
    if resp.status_code == 200:
        data = resp.json()
        return {
            "status":               "ok",
            "display_phone_number": data.get("display_phone_number"),
            "verified_name":        data.get("verified_name"),
            "use_templates":        _cfg.WHATSAPP_USE_TEMPLATES,
        }
    return {"status": "error", "code": resp.status_code, "detail": resp.text}


# Notification Dispatch (called from other routers)

def notify_attendance(
    student_user_id: int,
    student_name: str,
    status: str,            # "Absent" | "Late"
    session_date: str,      # human-readable e.g. "Mar 06, 2026"
    subject_name: str,
    event_key: str,         # base key, e.g. "attendance:session_record:42"
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Fire WhatsApp to the student (direct) and their parents for Absent/Late attendance."""
    if status not in ("Absent", "Late", "ABSENT", "LATE"):
        return

    status_label = "Absent" if status.upper() == "ABSENT" else "Late"

    # notify the student directly
    s_settings = _student_settings(student_user_id, db)
    s_key = f"{event_key}:student:{student_user_id}"
    if s_settings and s_settings.is_connected and s_settings.notify_attendance:
        if not _already_sent_student(student_user_id, s_key, db):
            body = (
                f"📋 *Attendance Alert*\n\n"
                f"You were marked *{status_label}* for *{subject_name}* on {session_date}."
            )

            def _send_s(phone=s_settings.phone_number, msg=body, uid=student_user_id, key=s_key,
                        bparams=["You", status_label, subject_name, session_date]):
                if whatsapp_service.dispatch(phone, msg, "View Attendance", "/student/attendance",
                                             template_name="connected_attendance_alert",
                                             body_params=bparams):
                    from app.core.database import SessionLocal
                    _db = SessionLocal()
                    try:
                        _mark_sent_student(uid, key, _db)
                    finally:
                        _db.close()

            if background_tasks:
                background_tasks.add_task(_send_s)
            else:
                _send_s()

    # notify parents
    parents = _parents_of_student(student_user_id, db)
    for parent in parents:
        p_settings = (
            db.query(WhatsAppNotificationSetting)
            .filter(WhatsAppNotificationSetting.parent_user_id == parent.id)
            .first()
        )
        if not p_settings or not p_settings.is_connected or not p_settings.notify_attendance:
            continue

        p_key = f"{event_key}:parent:{parent.id}"
        if _already_sent_parent(parent.id, p_key, db):
            continue

        body = (
            f"📋 *Attendance Alert*\n\n"
            f"*{student_name}* was marked *{status_label}* for *{subject_name}* on {session_date}."
        )

        def _send_p(phone=p_settings.phone_number, msg=body, pid=parent.id, key=p_key,
                    bparams=[student_name, status_label, subject_name, session_date]):
            if whatsapp_service.dispatch(phone, msg, "View Attendance", "/parent/attendance",
                                         template_name="connected_attendance_alert",
                                         body_params=bparams):
                from app.core.database import SessionLocal
                _db = SessionLocal()
                try:
                    _mark_sent_parent(pid, key, _db)
                finally:
                    _db.close()

        if background_tasks:
            background_tasks.add_task(_send_p)
        else:
            _send_p()


def notify_event_published(
    event_id: int,
    event_title: str,
    event_type: str,       # "Exam" | other
    start_date: str,
    class_ids: list,       # list of class IDs targeted; empty = all
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Fire WhatsApp to students in targeted classes and their parents when an event is published."""
    from app.models.admin import StudentProfile

    is_exam = event_type == "Exam"
    event_key_prefix = f"event:{event_id}:published"
    kind_label = "Exam" if is_exam else "Event"
    btn_parent = "View Exam" if is_exam else "View Event"

    query = db.query(StudentProfile)
    if class_ids:
        query = query.filter(StudentProfile.class_id.in_(class_ids))
    profiles = query.all()

    seen_parents: set = set()

    for profile in profiles:
        # notify student
        s_settings = _student_settings(profile.user_id, db)
        s_key = f"{event_key_prefix}:student:{profile.user_id}"
        if s_settings and s_settings.is_connected and s_settings.notify_events:
            if not _already_sent_student(profile.user_id, s_key, db):
                body = (
                    f"📅 *{kind_label} Scheduled*\n\n"
                    f"*{event_title}* — {start_date}"
                )

                def _send_s(phone=s_settings.phone_number, msg=body, uid=profile.user_id, key=s_key,
                            bparams=[kind_label, event_title, start_date]):
                    if whatsapp_service.dispatch(phone, msg, btn_parent, "/student/timetable",
                                                 template_name="connected_event_scheduled",
                                                 body_params=bparams):
                        from app.core.database import SessionLocal
                        _db = SessionLocal()
                        try:
                            _mark_sent_student(uid, key, _db)
                        finally:
                            _db.close()

                if background_tasks:
                    background_tasks.add_task(_send_s)
                else:
                    _send_s()

        # notify parents (once per parent, not per student)
        parents = _parents_of_student(profile.user_id, db)
        for parent in parents:
            if parent.id in seen_parents:
                continue
            seen_parents.add(parent.id)

            p_settings = (
                db.query(WhatsAppNotificationSetting)
                .filter(WhatsAppNotificationSetting.parent_user_id == parent.id)
                .first()
            )
            if not p_settings or not p_settings.is_connected or not p_settings.notify_events:
                continue

            p_key = f"{event_key_prefix}:parent:{parent.id}"
            if _already_sent_parent(parent.id, p_key, db):
                continue

            body = (
                f"📅 *{kind_label} Scheduled*\n\n"
                f"*{event_title}* — {start_date}"
            )

            def _send_p(phone=p_settings.phone_number, msg=body, pid=parent.id, key=p_key, btn=btn_parent,
                        bparams=[kind_label, event_title, start_date]):
                if whatsapp_service.dispatch(phone, msg, btn, "/parent/events",
                                             template_name="connected_event_scheduled",
                                             body_params=bparams):
                    from app.core.database import SessionLocal
                    _db = SessionLocal()
                    try:
                        _mark_sent_parent(pid, key, _db)
                    finally:
                        _db.close()

            if background_tasks:
                background_tasks.add_task(_send_p)
            else:
                _send_p()


def notify_grade_published(
    student_user_id: int,
    student_name: str,
    assignment_title: str,
    subject_name: str,
    grade: str,             # e.g. "85 / 100"
    assignment_id: int,
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Fire WhatsApp to the student and their parents when a grade is released."""
    event_key_prefix = f"grade:assignment:{assignment_id}:student:{student_user_id}"

    # notify student
    s_settings = _student_settings(student_user_id, db)
    s_key = f"{event_key_prefix}:self"
    if s_settings and s_settings.is_connected and s_settings.notify_grades:
        if not _already_sent_student(student_user_id, s_key, db):
            body = (
                f"📊 *Grade Released*\n\n"
                f"*{assignment_title}* ({subject_name})\n"
                f"Your score: *{grade}*"
            )

            def _send_s(phone=s_settings.phone_number, msg=body, uid=student_user_id, key=s_key,
                        bparams=["Your", assignment_title, subject_name, grade]):
                if whatsapp_service.dispatch(phone, msg, "View Grade", "/student/assignments",
                                             template_name="connected_grade_released",
                                             body_params=bparams):
                    from app.core.database import SessionLocal
                    _db = SessionLocal()
                    try:
                        _mark_sent_student(uid, key, _db)
                    finally:
                        _db.close()

            if background_tasks:
                background_tasks.add_task(_send_s)
            else:
                _send_s()

    # notify parents
    parents = _parents_of_student(student_user_id, db)
    for parent in parents:
        p_settings = (
            db.query(WhatsAppNotificationSetting)
            .filter(WhatsAppNotificationSetting.parent_user_id == parent.id)
            .first()
        )
        if not p_settings or not p_settings.is_connected or not p_settings.notify_grades:
            continue

        p_key = f"{event_key_prefix}:parent:{parent.id}"
        if _already_sent_parent(parent.id, p_key, db):
            continue

        body = (
            f"📊 *Grade Released*\n\n"
            f"*{student_name}* — *{assignment_title}* ({subject_name})\n"
            f"Score: *{grade}*"
        )

        def _send_p(phone=p_settings.phone_number, msg=body, pid=parent.id, key=p_key,
                    bparams=[student_name, assignment_title, subject_name, grade]):
            if whatsapp_service.dispatch(phone, msg, "View Grade", "/parent/assignments",
                                         template_name="connected_grade_released",
                                         body_params=bparams):
                from app.core.database import SessionLocal
                _db = SessionLocal()
                try:
                    _mark_sent_parent(pid, key, _db)
                finally:
                    _db.close()

        if background_tasks:
            background_tasks.add_task(_send_p)
        else:
            _send_p()


def notify_assignment_published(
    assignment_id: int,
    class_id: int,
    assignment_title: str,
    subject_name: str,
    teacher_name: str,
    due_at: Optional[str],          # human-readable, e.g. "Mar 10, 2026" or None
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Fire WhatsApp to students in the class and their parents when an assignment is published."""
    from app.models.admin import StudentProfile

    event_key_prefix = f"assignment:{assignment_id}:published"
    profiles = db.query(StudentProfile).filter(StudentProfile.class_id == class_id).all()
    seen_parents: set = set()
    due_line = f" · Due {due_at}" if due_at else ""

    for profile in profiles:
        # notify student
        s_settings = _student_settings(profile.user_id, db)
        s_key = f"{event_key_prefix}:student:{profile.user_id}"
        if s_settings and s_settings.is_connected and s_settings.notify_assignments:
            if not _already_sent_student(profile.user_id, s_key, db):
                body = (
                    f"\U0001f4da *New Assignment*\n\n"
                    f"*{assignment_title}* ({subject_name})\n"
                    f"By {teacher_name}{due_line}"
                )

                def _send_s(phone=s_settings.phone_number, msg=body, uid=profile.user_id, key=s_key,
                            bparams=[assignment_title, subject_name, due_at or "No due date"]):
                    if whatsapp_service.dispatch(phone, msg, "View Assignment", "/student/assignments",
                                                 template_name="connected_assignment_published",
                                                 body_params=bparams):
                        from app.core.database import SessionLocal
                        _db = SessionLocal()
                        try:
                            _mark_sent_student(uid, key, _db)
                        finally:
                            _db.close()

                if background_tasks:
                    background_tasks.add_task(_send_s)
                else:
                    _send_s()

        # notify parents
        parents = _parents_of_student(profile.user_id, db)
        for parent in parents:
            if parent.id in seen_parents:
                continue
            seen_parents.add(parent.id)

            p_settings = (
                db.query(WhatsAppNotificationSetting)
                .filter(WhatsAppNotificationSetting.parent_user_id == parent.id)
                .first()
            )
            if not p_settings or not p_settings.is_connected or not p_settings.notify_assignments:
                continue

            p_key = f"{event_key_prefix}:parent:{parent.id}"
            if _already_sent_parent(parent.id, p_key, db):
                continue

            body = (
                f"\U0001f4da *New Assignment*\n\n"
                f"*{assignment_title}* ({subject_name})\n"
                f"By {teacher_name}{due_line}"
            )

            def _send_p(phone=p_settings.phone_number, msg=body, pid=parent.id, key=p_key,
                        bparams=[assignment_title, subject_name, due_at or "No due date"]):
                if whatsapp_service.dispatch(phone, msg, "View Assignment", "/parent/assignments",
                                             template_name="connected_assignment_published",
                                             body_params=bparams):
                    from app.core.database import SessionLocal
                    _db = SessionLocal()
                    try:
                        _mark_sent_parent(pid, key, _db)
                    finally:
                        _db.close()

            if background_tasks:
                background_tasks.add_task(_send_p)
            else:
                _send_p()


def notify_unread_message(
    parent_user_id: int,
    sender_name: str,
    conversation_id: int,
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Fire WhatsApp to a parent when a teacher sends them a message (once per conversation)."""
    event_key = f"msg:unread:convo:{conversation_id}:parent:{parent_user_id}"

    settings = (
        db.query(WhatsAppNotificationSetting)
        .filter(WhatsAppNotificationSetting.parent_user_id == parent_user_id)
        .first()
    )
    if not settings or not settings.is_connected or not settings.notify_messages or not settings.phone_number:
        return
    if _already_sent_parent(parent_user_id, event_key, db):
        return

    body = (
        f"💬 *New Message*\n\n"
        f"*{sender_name}* sent you a message."
    )

    def _send(phone=settings.phone_number, msg=body, pid=parent_user_id, key=event_key,
              bparams=[sender_name]):
        if whatsapp_service.dispatch(phone, msg, "Open Messages", "/parent/messages",
                                     template_name="connected_message_alert",
                                     body_params=bparams):
            from app.core.database import SessionLocal
            _db = SessionLocal()
            try:
                _mark_sent_parent(pid, key, _db)
            finally:
                _db.close()

    if background_tasks:
        background_tasks.add_task(_send)
    else:
        _send()


def notify_student_unread_message(
    student_user_id: int,
    sender_name: str,
    conversation_id: int,
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Fire WhatsApp to a student when a teacher sends them a message (once per conversation)."""
    event_key = f"msg:unread:convo:{conversation_id}:student:{student_user_id}"

    settings = _student_settings(student_user_id, db)
    if not settings or not settings.is_connected or not settings.notify_messages or not settings.phone_number:
        return
    if _already_sent_student(student_user_id, event_key, db):
        return

    body = (
        f"💬 *New Message*\n\n"
        f"*{sender_name}* sent you a message."
    )

    def _send(phone=settings.phone_number, msg=body, uid=student_user_id, key=event_key,
              bparams=[sender_name]):
        if whatsapp_service.dispatch(phone, msg, "Open Messages", "/student/messages",
                                     template_name="connected_message_alert",
                                     body_params=bparams):
            from app.core.database import SessionLocal
            _db = SessionLocal()
            try:
                _mark_sent_student(uid, key, _db)
            finally:
                _db.close()

    if background_tasks:
        background_tasks.add_task(_send)
    else:
        _send()


def notify_assignment_due_reminder(
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """
    Fire WhatsApp reminders to students whose assignments are due within 24 hours.
    Intended to be called from a scheduled background task / cron endpoint.
    """
    from datetime import datetime, timedelta
    from app.models.extensions import Assignment, Submission, SubmissionStatusEnum
    from app.models.admin import StudentProfile

    now = datetime.utcnow()
    cutoff = now + timedelta(hours=24)

    # Assignments that are ACTIVE and due within the next 24 hours
    upcoming = (
        db.query(Assignment)
        .filter(
            Assignment.status == "ACTIVE",
            Assignment.due_at.isnot(None),
            Assignment.due_at > now,
            Assignment.due_at <= cutoff,
        )
        .all()
    )

    for assignment in upcoming:
        due_str         = assignment.due_at.strftime("%b %d, %Y %H:%M") if assignment.due_at else ""
        hours_remaining = max(1, int((assignment.due_at - now).total_seconds() / 3600))
        subject_name_str = assignment.subject.name if assignment.subject else "N/A"
        profiles = (
            db.query(StudentProfile)
            .filter(StudentProfile.class_id == assignment.class_id)
            .all()
        )

        for profile in profiles:
            # Skip if already submitted
            already_submitted = (
                db.query(Submission)
                .filter(
                    Submission.assignment_id == assignment.id,
                    Submission.student_id == profile.user_id,
                    Submission.status.in_(["SUBMITTED", "GRADED", "PUBLISHED"]),
                )
                .first()
            )
            if already_submitted:
                continue

            event_key = f"due_reminder:assignment:{assignment.id}:student:{profile.user_id}"
            s_settings = _student_settings(profile.user_id, db)
            if not s_settings or not s_settings.is_connected or not s_settings.notify_due_reminders:
                continue
            if _already_sent_student(profile.user_id, event_key, db):
                continue

            body = (
                f"⏰ *Assignment Due Soon*\n\n"
                f"*{assignment.title}* is due on {due_str}.\n"
                f"Make sure to submit before the deadline!"
            )

            def _send(phone=s_settings.phone_number, msg=body, uid=profile.user_id, key=event_key,
                      bparams=[assignment.title, subject_name_str, str(hours_remaining)]):
                if whatsapp_service.dispatch(phone, msg, "View Assignment", "/student/assignments",
                                             template_name="connected_due_reminder",
                                             body_params=bparams):
                    from app.core.database import SessionLocal
                    _db = SessionLocal()
                    try:
                        _mark_sent_student(uid, key, _db)
                    finally:
                        _db.close()

            if background_tasks:
                background_tasks.add_task(_send)
            else:
                _send()
