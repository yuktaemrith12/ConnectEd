"""
Messaging API — conversations and messages.
Prefix (set in main.py): /api/v1/messages

Communication rules (RBAC):
  Teacher  → can message students in their classes + parents of those students
  Student  → can message teachers of their class
  Parent   → can message teachers who teach their children's classes
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import func, update as sql_update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.admin import ClassSubjectTeacher, ParentStudent, StudentProfile
from app.models.extensions import (
    Conversation,
    ConversationParticipant,
    Message,
)
from app.models.user import User
from app.schemas.extensions import (
    ContactRead,
    ConversationDetail,
    ConversationRead,
    MessageRead,
    SendMessageRequest,
    StartConversationRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_any_messaging_role = Depends(require_role("teacher", "student", "parent"))


# Helpers

def _get_valid_contact_ids(me: User, db: Session) -> set:
    """Return the set of user IDs that `me` is allowed to message."""
    role = me.role.name

    if role == "teacher":
        # Students in classes this teacher teaches
        student_rows = (
            db.query(StudentProfile.user_id)
            .join(ClassSubjectTeacher, ClassSubjectTeacher.class_id == StudentProfile.class_id)
            .filter(ClassSubjectTeacher.teacher_id == me.id)
            .all()
        )
        student_ids = {r.user_id for r in student_rows}
        # Parents of those students
        parent_ids: set = set()
        if student_ids:
            parent_rows = (
                db.query(ParentStudent.parent_id)
                .filter(ParentStudent.student_id.in_(student_ids))
                .all()
            )
            parent_ids = {r.parent_id for r in parent_rows}
        return student_ids | parent_ids

    elif role == "student":
        sp = db.query(StudentProfile).filter(StudentProfile.user_id == me.id).first()
        if not sp or not sp.class_id:
            return set()
        rows = (
            db.query(ClassSubjectTeacher.teacher_id)
            .filter(ClassSubjectTeacher.class_id == sp.class_id)
            .all()
        )
        return {r.teacher_id for r in rows}

    elif role == "parent":
        student_rows = (
            db.query(ParentStudent.student_id)
            .filter(ParentStudent.parent_id == me.id)
            .all()
        )
        student_ids = {r.student_id for r in student_rows}
        if not student_ids:
            return set()
        class_rows = (
            db.query(StudentProfile.class_id)
            .filter(
                StudentProfile.user_id.in_(student_ids),
                StudentProfile.class_id.isnot(None),
            )
            .all()
        )
        class_ids = {r.class_id for r in class_rows}
        if not class_ids:
            return set()
        teacher_rows = (
            db.query(ClassSubjectTeacher.teacher_id)
            .filter(ClassSubjectTeacher.class_id.in_(class_ids))
            .all()
        )
        return {r.teacher_id for r in teacher_rows}

    return set()


def _find_existing_convo(me_id: int, other_id: int, db: Session) -> Optional[Conversation]:
    """Return an existing individual conversation between exactly these two users."""
    my_convos = (
        db.query(ConversationParticipant.conversation_id)
        .filter(
            ConversationParticipant.user_id == me_id,
            ConversationParticipant.is_active == True,  # noqa: E712
        )
        .subquery()
    )
    their_convos = (
        db.query(ConversationParticipant.conversation_id)
        .filter(
            ConversationParticipant.user_id == other_id,
            ConversationParticipant.is_active == True,  # noqa: E712
        )
        .subquery()
    )
    return (
        db.query(Conversation)
        .filter(
            Conversation.id.in_(my_convos),
            Conversation.id.in_(their_convos),
            Conversation.type == "individual",
        )
        .first()
    )


def _build_conversation_read(conv: Conversation, me_id: int, db: Session) -> ConversationRead:
    other_part = next((p for p in conv.participants if p.user_id != me_id), None)
    my_part = next((p for p in conv.participants if p.user_id == me_id), None)

    other_user: Optional[User] = None
    if other_part:
        other_user = db.query(User).filter(User.id == other_part.user_id).first()

    # Unread: messages from others that arrived after our last_read_at
    unread_q = (
        db.query(func.count(Message.id))
        .filter(
            Message.conversation_id == conv.id,
            Message.is_deleted == False,  # noqa: E712
            Message.sender_id != me_id,
        )
    )
    if my_part and my_part.last_read_at:
        unread_q = unread_q.filter(Message.created_at > my_part.last_read_at)
    unread_count = unread_q.scalar() or 0

    conv_type = conv.type if isinstance(conv.type, str) else conv.type.value
    updated_at = conv.updated_at.isoformat() if conv.updated_at else ""

    return ConversationRead(
        id=conv.id,
        type=conv_type,
        other_user_id=other_user.id if other_user else 0,
        other_user_name=other_user.full_name if other_user else "Unknown",
        other_user_role=other_user.role.name if other_user else "—",
        last_message_preview=conv.last_message_preview,
        unread_count=unread_count,
        updated_at=updated_at,
    )


def _build_message_read(msg: Message, me_id: int) -> MessageRead:
    content_type = msg.content_type if isinstance(msg.content_type, str) else msg.content_type.value
    return MessageRead(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_name=msg.sender.full_name if msg.sender else "Unknown",
        content=msg.content if not msg.is_deleted else "[Message deleted]",
        content_type=content_type,
        is_deleted=msg.is_deleted,
        created_at=msg.created_at.isoformat() if msg.created_at else "",
        is_mine=msg.sender_id == me_id,
    )


def _get_conv_and_my_part(
    conv_id: int, me_id: int, db: Session
) -> tuple:
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    my_part = next(
        (p for p in conv.participants if p.user_id == me_id and p.is_active),
        None,
    )
    if not my_part:
        raise HTTPException(status_code=403, detail="Access denied.")
    return conv, my_part


def _send_msg(conv: Conversation, sender: User, content: str, db: Session) -> Message:
    msg = Message(
        conversation_id=conv.id,
        sender_id=sender.id,
        content=content,
        content_type="text",
        is_deleted=False,
    )
    db.add(msg)
    conv.last_message_preview = content[:200]
    # conv.updated_at is handled by MySQL's ON UPDATE CURRENT_TIMESTAMP
    db.flush()
    # Mark the sender as having read their own message (they clearly just read it)
    db.execute(
        sql_update(ConversationParticipant)
        .where(
            ConversationParticipant.conversation_id == conv.id,
            ConversationParticipant.user_id == sender.id,
        )
        .values(last_read_at=func.now())
    )
    return msg


# Notification helper

def _maybe_notify_parent(
    conv_id: int,
    sender: User,
    recipient: Optional[User],
    db: Session,
    background_tasks: BackgroundTasks,
) -> None:
    """If a teacher just messaged a parent or student, fire a WhatsApp notification (once per conversation)."""
    if not recipient or sender.role.name != "teacher":
        return
    if recipient.role.name == "parent":
        from app.api.whatsapp import notify_unread_message
        notify_unread_message(
            parent_user_id=recipient.id,
            sender_name=sender.full_name,
            conversation_id=conv_id,
            db=db,
            background_tasks=background_tasks,
        )
    elif recipient.role.name == "student":
        from app.api.whatsapp import notify_student_unread_message
        notify_student_unread_message(
            student_user_id=recipient.id,
            sender_name=sender.full_name,
            conversation_id=conv_id,
            db=db,
            background_tasks=background_tasks,
        )


# Endpoints

@router.get("/contacts", response_model=List[ContactRead])
def get_contacts(
    me: User = _any_messaging_role,
    db: Session = Depends(get_db),
):
    """Return valid contacts the current user is allowed to message."""
    valid_ids = _get_valid_contact_ids(me, db)
    if not valid_ids:
        return []
    users = (
        db.query(User)
        .filter(User.id.in_(valid_ids), User.deleted_at == None)  # noqa: E711
        .order_by(User.full_name)
        .all()
    )
    return [ContactRead(id=u.id, full_name=u.full_name, role=u.role.name) for u in users]


@router.get("/conversations", response_model=List[ConversationRead])
def list_conversations(
    me: User = _any_messaging_role,
    db: Session = Depends(get_db),
):
    """Return all active conversations for the current user, newest first."""
    parts = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.user_id == me.id,
            ConversationParticipant.is_active == True,  # noqa: E712
        )
        .all()
    )
    conv_ids = [p.conversation_id for p in parts]
    if not conv_ids:
        return []
    convos = (
        db.query(Conversation)
        .filter(Conversation.id.in_(conv_ids))
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [_build_conversation_read(c, me.id, db) for c in convos]


@router.post("/conversations", response_model=ConversationRead)
def start_or_get_conversation(
    body: StartConversationRequest,
    background_tasks: BackgroundTasks,
    me: User = _any_messaging_role,
    db: Session = Depends(get_db),
):
    """Start a new conversation or return the existing one with the other user."""
    valid_ids = _get_valid_contact_ids(me, db)
    if body.other_user_id not in valid_ids:
        raise HTTPException(status_code=403, detail="You are not allowed to message this user.")

    other_user = (
        db.query(User)
        .filter(User.id == body.other_user_id, User.deleted_at == None)  # noqa: E711
        .first()
    )
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found.")

    existing = _find_existing_convo(me.id, body.other_user_id, db)
    if existing:
        if body.initial_message and body.initial_message.strip():
            _send_msg(existing, me, body.initial_message.strip(), db)
            db.commit()
            db.refresh(existing)
            _maybe_notify_parent(existing.id, me, other_user, db, background_tasks)
        return _build_conversation_read(existing, me.id, db)

    # Create new conversation
    conv = Conversation(type="individual")
    db.add(conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=me.id))
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=body.other_user_id))

    if body.initial_message and body.initial_message.strip():
        _send_msg(conv, me, body.initial_message.strip(), db)

    db.commit()
    db.refresh(conv)
    _maybe_notify_parent(conv.id, me, other_user, db, background_tasks)
    return _build_conversation_read(conv, me.id, db)


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: int,
    before_id: Optional[int] = Query(None, description="Cursor: load messages before this ID"),
    limit: int = Query(50, le=100),
    me: User = _any_messaging_role,
    db: Session = Depends(get_db),
):
    """Return conversation detail with paginated message history."""
    conv, _ = _get_conv_and_my_part(conv_id, me.id, db)

    other_part = next((p for p in conv.participants if p.user_id != me.id), None)
    other_user: Optional[User] = None
    if other_part:
        other_user = db.query(User).filter(User.id == other_part.user_id).first()

    q = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.id.desc())
        .limit(limit)
    )
    if before_id is not None:
        q = q.filter(Message.id < before_id)
    msgs = list(reversed(q.all()))

    conv_type = conv.type if isinstance(conv.type, str) else conv.type.value
    return ConversationDetail(
        id=conv.id,
        type=conv_type,
        other_user_id=other_user.id if other_user else 0,
        other_user_name=other_user.full_name if other_user else "Unknown",
        other_user_role=other_user.role.name if other_user else "—",
        messages=[_build_message_read(m, me.id) for m in msgs],
    )


@router.post("/conversations/{conv_id}/send", response_model=MessageRead)
def send_message(
    conv_id: int,
    body: SendMessageRequest,
    background_tasks: BackgroundTasks,
    me: User = _any_messaging_role,
    db: Session = Depends(get_db),
):
    """Send a message in a conversation."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")
    conv, _ = _get_conv_and_my_part(conv_id, me.id, db)
    msg = _send_msg(conv, me, body.content.strip(), db)
    db.commit()
    db.refresh(msg)

    # Notify parent recipient if sender is a teacher
    other_part = next((p for p in conv.participants if p.user_id != me.id), None)
    if other_part:
        other_user = db.query(User).filter(User.id == other_part.user_id).first()
        _maybe_notify_parent(conv_id, me, other_user, db, background_tasks)

    return _build_message_read(msg, me.id)


@router.patch("/conversations/{conv_id}/read", status_code=204)
def mark_read(
    conv_id: int,
    me: User = _any_messaging_role,
    db: Session = Depends(get_db),
):
    """Update last_read_at for the current user in the given conversation."""
    _get_conv_and_my_part(conv_id, me.id, db)  # verifies access
    db.execute(
        sql_update(ConversationParticipant)
        .where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.user_id == me.id,
        )
        .values(last_read_at=func.now())
    )
    # Clear the WhatsApp dedup entry so the parent can be notified again
    # when the teacher sends the next message after this read.
    from app.models.extensions import WhatsAppSentLog
    db.query(WhatsAppSentLog).filter(
        WhatsAppSentLog.parent_user_id == me.id,
        WhatsAppSentLog.event_key == f"msg:unread:convo:{conv_id}:parent:{me.id}",
    ).delete()
    db.commit()
    return Response(status_code=204)
