"""
Extension SQLAlchemy models — Attendance, Fees, Calendar, Homework, Assignments.

Tables (in migration order):
  05_attendance_module.sql:
    attendance_records       — daily per-student attendance

  06_fees_module.sql:
    fee_plans                — per-student fee plan
    fee_payments             — individual payment transactions

  07_calendar_module.sql:
    events                   — school events / exams / holidays
    event_target_classes     — M:M events ↔ classes

  08_fees_evolution.sql:
    academic_periods         — academic year/term
    fee_installments         — installment schedule for a fee plan
    fee_notification_events  — audit log / alert queue

  10_attendance_sessions.sql:
    locations                — physical rooms managed by admin
    attendance_sessions      — one row per class occurrence (snapshot pattern)
    session_attendance_records — per-student status within a session

  11_homework.sql:
    homework                 — teacher-created homework items
    homework_attachments     — file attachments per homework
    homework_completions     — per-student 'Done' toggle

  12_assignments_grading.sql:
    assignments              — typed (ONLINE/ON_SITE) assignments with rubric
    assignment_attachments   — teacher-uploaded reference files
    submissions              — per-student submission + grade
    submission_attachments   — student-uploaded files
    ai_reviews               — AI-suggested grade/feedback audit trail
"""

import enum

from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Time, Text,
    Enum, ForeignKey, DECIMAL, UniqueConstraint, func, Boolean, JSON, Float
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceStatusEnum(str, enum.Enum):
    Present = "Present"
    Absent  = "Absent"
    Late    = "Late"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id           = Column(Integer, primary_key=True, index=True)
    student_id   = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    date         = Column(Date, nullable=False)
    status       = Column(Enum(AttendanceStatusEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=AttendanceStatusEnum.Present)
    marked_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    remarks      = Column(Text, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_att_student_date"),
    )

    student   = relationship("StudentProfile", foreign_keys=[student_id])
    marked_by = relationship("User", foreign_keys=[marked_by_id])


# ── Fees ──────────────────────────────────────────────────────────────────────

class PaymentMethodEnum(str, enum.Enum):
    Cash          = "Cash"
    Bank_Transfer = "Bank Transfer"
    Card          = "Card"


class NotificationTypeEnum(str, enum.Enum):
    Upcoming_Due    = "Upcoming Due"
    Due_Today       = "Due Today"
    Overdue         = "Overdue"
    Payment_Receipt = "Payment Receipt"


class AcademicPeriod(Base):
    __tablename__ = "academic_periods"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date   = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    fee_plans = relationship("FeePlan", back_populates="academic_period")


class FeePlan(Base):
    __tablename__ = "fee_plans"

    id                 = Column(Integer, primary_key=True, index=True)
    student_id         = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    academic_period_id = Column(Integer, ForeignKey("academic_periods.id"), nullable=True)
    total_amount       = Column(DECIMAL(10, 2), nullable=False)
    base_amount        = Column(DECIMAL(10, 2), nullable=False)
    discount_amount    = Column(DECIMAL(10, 2), nullable=False, default=0)
    due_date           = Column(Date, nullable=False)
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())

    student         = relationship("StudentProfile", foreign_keys=[student_id])
    academic_period = relationship("AcademicPeriod", back_populates="fee_plans")
    payments        = relationship("FeePayment", back_populates="fee_plan", cascade="all, delete-orphan")
    installments    = relationship("FeeInstallment", back_populates="fee_plan", cascade="all, delete-orphan", order_by="FeeInstallment.due_date")


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id             = Column(Integer, primary_key=True, index=True)
    fee_plan_id    = Column(Integer, ForeignKey("fee_plans.id"), nullable=False)
    amount_paid    = Column(DECIMAL(10, 2), nullable=False)
    payment_date   = Column(DateTime, server_default=func.now())
    payment_method = Column(Enum(PaymentMethodEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=PaymentMethodEnum.Cash)
    transaction_id = Column(String(100), unique=True, nullable=True)

    fee_plan = relationship("FeePlan", back_populates="payments")


class FeeInstallment(Base):
    __tablename__ = "fee_installments"

    id          = Column(Integer, primary_key=True, index=True)
    fee_plan_id = Column(Integer, ForeignKey("fee_plans.id"), nullable=False)
    amount      = Column(DECIMAL(10, 2), nullable=False)
    due_date    = Column(Date, nullable=False)
    created_at  = Column(DateTime, server_default=func.now())

    fee_plan = relationship("FeePlan", back_populates="installments")


class FeeNotificationEvent(Base):
    __tablename__ = "fee_notification_events"

    id           = Column(Integer, primary_key=True, index=True)
    type         = Column(Enum(NotificationTypeEnum, values_callable=lambda x: [e.value for e in x]), nullable=False)
    student_id   = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    fee_plan_id  = Column(Integer, ForeignKey("fee_plans.id"), nullable=True)
    trigger_date = Column(Date, nullable=False)
    created_at   = Column(DateTime, server_default=func.now())

    student  = relationship("StudentProfile", foreign_keys=[student_id])
    fee_plan = relationship("FeePlan", foreign_keys=[fee_plan_id])


# ── Calendar / Events ─────────────────────────────────────────────────────────

class EventTypeEnum(str, enum.Enum):
    Academic = "Academic"
    Exam     = "Exam"
    Holiday  = "Holiday"
    Meeting  = "Meeting"
    Other    = "Other"


class AudienceTypeEnum(str, enum.Enum):
    All              = "All"
    Students         = "Students"
    Teachers         = "Teachers"
    Parents          = "Parents"
    Specific_Classes = "Specific Classes"


class Event(Base):
    __tablename__ = "events"

    id                   = Column(Integer, primary_key=True, index=True)
    title                = Column(String(255), nullable=False)
    type                 = Column(Enum(EventTypeEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=EventTypeEnum.Academic)
    start_date           = Column(Date, nullable=False)
    end_date             = Column(Date, nullable=False)
    start_time           = Column(Time, nullable=True)
    end_time             = Column(Time, nullable=True)
    target_audience_type = Column(Enum(AudienceTypeEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=AudienceTypeEnum.All)
    description          = Column(Text, nullable=True)
    published            = Column(Boolean, nullable=False, default=False)
    created_by_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at           = Column(DateTime, server_default=func.now())
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())

    created_by     = relationship("User", foreign_keys=[created_by_id])
    target_classes = relationship("EventTargetClass", back_populates="event", cascade="all, delete-orphan")


class EventTargetClass(Base):
    __tablename__ = "event_target_classes"

    event_id = Column(Integer, ForeignKey("events.id"), primary_key=True)
    class_id = Column(Integer, ForeignKey("classes.id"), primary_key=True)

    event = relationship("Event", back_populates="target_classes")
    class_ = relationship("Class", foreign_keys=[class_id])


# ── Locations ─────────────────────────────────────────────────────────────────

class Location(Base):
    __tablename__ = "locations"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    type       = Column(String(50), nullable=False, default="Classroom")
    capacity   = Column(Integer, nullable=True)
    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ── Session-based Attendance (Migration 10) ───────────────────────────────────

class SessionStatusEnum(str, enum.Enum):
    OPEN      = "OPEN"
    CLOSED    = "CLOSED"
    CANCELLED = "CANCELLED"


class SessionAttendanceStatusEnum(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT  = "ABSENT"
    LATE    = "LATE"
    EXCUSED = "EXCUSED"


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id                       = Column(Integer, primary_key=True, index=True)
    timetable_entry_id       = Column(Integer, ForeignKey("timetable_entries.id", ondelete="CASCADE"), nullable=False)
    session_date             = Column(Date, nullable=False)
    delivery_mode_snapshot   = Column(String(20), nullable=False, default="ONSITE")
    location_id_snapshot     = Column(Integer, nullable=True)
    online_join_url_snapshot = Column(String(500), nullable=True)
    status                   = Column(
        Enum(SessionStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SessionStatusEnum.OPEN,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # String-ref avoids circular import with admin.py
    timetable_entry = relationship("TimetableEntry", foreign_keys=[timetable_entry_id])
    creator         = relationship("User", foreign_keys=[created_by])
    records         = relationship(
        "SessionAttendanceRecord",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class SessionAttendanceRecord(Base):
    __tablename__ = "session_attendance_records"

    id                    = Column(Integer, primary_key=True, index=True)
    attendance_session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id            = Column(Integer, ForeignKey("users.id"), nullable=False)
    status                = Column(
        Enum(SessionAttendanceStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    marked_at  = Column(DateTime, nullable=True)
    marked_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    note       = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("attendance_session_id", "student_id", name="uq_session_student"),
    )

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("User", foreign_keys=[student_id])
    marker  = relationship("User", foreign_keys=[marked_by])


# ── Homework ─────────────────────────────────────────────────────────────────

class HomeworkStatusEnum(str, enum.Enum):
    DRAFT     = "DRAFT"
    PUBLISHED = "PUBLISHED"


class Homework(Base):
    __tablename__ = "homework"

    id           = Column(Integer, primary_key=True, index=True)
    class_id     = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id   = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    teacher_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title        = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    due_at       = Column(DateTime, nullable=True)
    status       = Column(
        Enum(HomeworkStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=HomeworkStatusEnum.DRAFT,
    )
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    class_   = relationship("Class",   foreign_keys=[class_id])
    subject  = relationship("Subject", foreign_keys=[subject_id])
    teacher  = relationship("User",    foreign_keys=[teacher_id])
    attachments  = relationship("HomeworkAttachment",  back_populates="homework", cascade="all, delete-orphan")
    completions  = relationship("HomeworkCompletion",   back_populates="homework", cascade="all, delete-orphan")


class HomeworkAttachment(Base):
    __tablename__ = "homework_attachments"

    id          = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homework.id", ondelete="CASCADE"), nullable=False)
    file_name   = Column(String(255), nullable=False)
    file_type   = Column(String(50), nullable=False)
    file_size   = Column(Integer, nullable=False, default=0)
    file_path   = Column(String(500), nullable=False)
    created_at  = Column(DateTime, server_default=func.now())

    homework = relationship("Homework", back_populates="attachments")


class HomeworkCompletion(Base):
    __tablename__ = "homework_completions"

    id          = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homework.id", ondelete="CASCADE"), nullable=False)
    student_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_done     = Column(Boolean, nullable=False, default=False)
    done_at     = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("homework_id", "student_id", name="uq_hwc_student"),
    )

    homework = relationship("Homework", back_populates="completions")
    student  = relationship("User", foreign_keys=[student_id])


# ── Assignments + Grading (Migration 12) ─────────────────────────────────────

class AssignmentTypeEnum(str, enum.Enum):
    ONLINE  = "ONLINE"
    ON_SITE = "ON_SITE"


class AssignmentStatusEnum(str, enum.Enum):
    DRAFT    = "DRAFT"
    ACTIVE   = "ACTIVE"
    CLOSED   = "CLOSED"
    RELEASED = "RELEASED"


class SubmissionStatusEnum(str, enum.Enum):
    PENDING   = "PENDING"
    SUBMITTED = "SUBMITTED"
    GRADED    = "GRADED"
    PUBLISHED = "PUBLISHED"


class AIConfidenceEnum(str, enum.Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class Assignment(Base):
    __tablename__ = "assignments"

    id          = Column(Integer, primary_key=True, index=True)
    class_id    = Column(Integer, ForeignKey("classes.id",   ondelete="CASCADE"), nullable=False)
    subject_id  = Column(Integer, ForeignKey("subjects.id",  ondelete="CASCADE"), nullable=False)
    teacher_id  = Column(Integer, ForeignKey("users.id",     ondelete="CASCADE"), nullable=False)
    type        = Column(Enum(AssignmentTypeEnum,   values_callable=lambda x: [e.value for e in x]), nullable=False, default=AssignmentTypeEnum.ONLINE)
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_at      = Column(DateTime, nullable=True)
    max_score   = Column(DECIMAL(6, 2), nullable=False, default=100)
    rubric             = Column(JSON, nullable=True)
    location           = Column(String(255), nullable=True)
    duration           = Column(String(100), nullable=True)
    answer_sheet_path  = Column(String(500), nullable=True)
    status      = Column(Enum(AssignmentStatusEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=AssignmentStatusEnum.DRAFT)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    class_   = relationship("Class",   foreign_keys=[class_id])
    subject  = relationship("Subject", foreign_keys=[subject_id])
    teacher  = relationship("User",    foreign_keys=[teacher_id])
    attachments = relationship("AssignmentAttachment", back_populates="assignment", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentAttachment(Base):
    __tablename__ = "assignment_attachments"

    id            = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    file_name     = Column(String(255), nullable=False)
    file_type     = Column(String(50),  nullable=False)
    file_size     = Column(Integer, nullable=False, default=0)
    file_path     = Column(String(500), nullable=False)
    created_at    = Column(DateTime, server_default=func.now())

    assignment = relationship("Assignment", back_populates="attachments")


class Submission(Base):
    __tablename__ = "submissions"

    id            = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_id    = Column(Integer, ForeignKey("users.id",       ondelete="CASCADE"), nullable=False)
    submitted_at  = Column(DateTime, nullable=True)
    files         = Column(JSON, nullable=True)
    grade         = Column(DECIMAL(6, 2), nullable=True)
    feedback      = Column(Text, nullable=True)
    status        = Column(Enum(SubmissionStatusEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=SubmissionStatusEnum.PENDING)
    ai_reviewed   = Column(Boolean, nullable=False, default=False)
    is_onsite     = Column(Boolean, nullable=False, default=False)
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_sub_asgn_student"),
    )

    assignment  = relationship("Assignment",  back_populates="submissions")
    student     = relationship("User",        foreign_keys=[student_id])
    ai_reviews  = relationship("AIReview",    back_populates="submission", cascade="all, delete-orphan")
    sub_attachments = relationship("SubmissionAttachment", back_populates="submission", cascade="all, delete-orphan")


class SubmissionAttachment(Base):
    __tablename__ = "submission_attachments"

    id            = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    file_name     = Column(String(255), nullable=False)
    file_type     = Column(String(50),  nullable=False)
    file_size     = Column(Integer, nullable=False, default=0)
    file_path     = Column(String(500), nullable=False)
    created_at    = Column(DateTime, server_default=func.now())

    submission = relationship("Submission", back_populates="sub_attachments")


class AIReview(Base):
    __tablename__ = "ai_reviews"

    id                 = Column(Integer, primary_key=True, index=True)
    submission_id      = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    suggested_grade    = Column(DECIMAL(6, 2), nullable=True)
    suggested_feedback = Column(Text, nullable=True)
    rubric_alignment   = Column(JSON, nullable=True)
    annotations        = Column(JSON, nullable=True)
    confidence_score   = Column(Enum(AIConfidenceEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=AIConfidenceEnum.medium)
    model_info         = Column(JSON, nullable=True)
    triggered_by       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at         = Column(DateTime, server_default=func.now())

    submission   = relationship("Submission", back_populates="ai_reviews")
    triggered_by_user = relationship("User", foreign_keys=[triggered_by])


# ── Messaging ─────────────────────────────────────────────────────────────────

class ConversationTypeEnum(str, enum.Enum):
    individual = "individual"
    group      = "group"


class MessageContentTypeEnum(str, enum.Enum):
    text   = "text"
    system = "system"


class Conversation(Base):
    __tablename__ = "conversations"

    id                   = Column(Integer, primary_key=True, index=True)
    type                 = Column(
        Enum(ConversationTypeEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ConversationTypeEnum.individual,
    )
    created_at           = Column(DateTime, server_default=func.now())
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_message_preview = Column(String(500), nullable=True)

    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages     = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    conversation_id = Column(Integer, ForeignKey("conversations.id"), primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), primary_key=True)
    last_read_at    = Column(DateTime, nullable=True)
    joined_at       = Column(DateTime, server_default=func.now())
    is_active       = Column(Boolean, default=True)

    conversation = relationship("Conversation", back_populates="participants")
    user         = relationship("User", foreign_keys=[user_id])


class Message(Base):
    __tablename__ = "messages"

    id              = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    content         = Column(Text, nullable=False)
    content_type    = Column(
        Enum(MessageContentTypeEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=MessageContentTypeEnum.text,
    )
    is_deleted  = Column(Boolean, default=False)
    created_at  = Column(DateTime, server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender       = relationship("User", foreign_keys=[sender_id])


# ── WhatsApp Notification Settings (Migrations 15, 16, 18) ───────────────────

class WhatsAppNotificationSetting(Base):
    __tablename__ = "whatsapp_notification_settings"

    id              = Column(Integer, primary_key=True, index=True)
    parent_user_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    student_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    phone_number    = Column(String(30), nullable=True)
    is_connected    = Column(Boolean, nullable=False, default=False)
    notify_exams         = Column(Boolean, nullable=False, default=True)
    notify_events        = Column(Boolean, nullable=False, default=True)
    notify_attendance    = Column(Boolean, nullable=False, default=True)
    notify_messages      = Column(Boolean, nullable=False, default=True)
    notify_grades        = Column(Boolean, nullable=False, default=True)
    notify_assignments   = Column(Boolean, nullable=False, default=True)
    notify_due_reminders = Column(Boolean, nullable=False, default=True)
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("parent_user_id",  name="uq_whatsapp_parent"),
        UniqueConstraint("student_user_id", name="uq_whatsapp_student"),
    )

    parent  = relationship("User", foreign_keys=[parent_user_id])
    student = relationship("User", foreign_keys=[student_user_id])


class WhatsAppSentLog(Base):
    __tablename__ = "whatsapp_sent_log"

    id              = Column(Integer, primary_key=True, index=True)
    parent_user_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    student_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    event_key       = Column(String(255), nullable=False)
    sent_at         = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("parent_user_id",  "event_key", name="uq_sent_event"),
        UniqueConstraint("student_user_id", "event_key", name="uq_sent_event_student"),
    )


# ── AI Study Materials (Migration 17) ─────────────────────────────────────────

class AIStudyMaterialStatusEnum(str, enum.Enum):
    processing = "processing"
    completed  = "completed"
    failed     = "failed"


class AIStudyMaterial(Base):
    __tablename__ = "ai_study_materials"

    id               = Column(Integer, primary_key=True, index=True)
    student_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_type      = Column(String(20),  nullable=False, default="upload")
    source_reference = Column(String(500), nullable=True)
    language         = Column(String(20),  nullable=False, default="en")
    status           = Column(
        Enum(AIStudyMaterialStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=AIStudyMaterialStatusEnum.processing,
    )
    current_stage    = Column(String(50), nullable=True)
    transcript       = Column(Text, nullable=True)
    notes_markdown   = Column(Text, nullable=True)
    illustration_url = Column(Text, nullable=True)
    error_message    = Column(Text, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())

    student = relationship("User", foreign_keys=[student_id])


# ── Video Conferencing (Migration 21) ─────────────────────────────────────────

class MeetingStatusEnum(str, enum.Enum):
    active    = "active"
    completed = "completed"
    cancelled = "cancelled"


class Meeting(Base):
    __tablename__ = "meetings"

    id         = Column(Integer, primary_key=True, index=True)
    room_name  = Column(String(255), nullable=False, unique=True)
    teacher_id = Column(Integer, ForeignKey("users.id",    ondelete="CASCADE"), nullable=False)
    class_id   = Column(Integer, ForeignKey("classes.id",  ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String(255), nullable=False)
    status     = Column(
        Enum(MeetingStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=MeetingStatusEnum.active,
    )
    started_at = Column(DateTime, nullable=True)
    ended_at   = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    teacher      = relationship("User",    foreign_keys=[teacher_id])
    class_       = relationship("Class",   foreign_keys=[class_id])
    subject      = relationship("Subject", foreign_keys=[subject_id])
    recordings   = relationship("MeetingRecording", back_populates="meeting", cascade="all, delete-orphan")
    emotion_logs = relationship("MeetingEmotionLog", back_populates="meeting", cascade="all, delete-orphan")
    analytics    = relationship("MeetingAnalytics",  back_populates="meeting", uselist=False, cascade="all, delete-orphan")


class MeetingRecording(Base):
    __tablename__ = "meeting_recordings"

    id             = Column(Integer, primary_key=True, index=True)
    meeting_id     = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    storage_path   = Column(String(500), nullable=False)
    duration_s     = Column(Integer, nullable=False, default=0)
    has_transcript = Column(Boolean, nullable=False, default=False)
    has_analytics  = Column(Boolean, nullable=False, default=False)
    created_at     = Column(DateTime, server_default=func.now())

    meeting = relationship("Meeting", back_populates="recordings")


class MeetingEmotionLog(Base):
    __tablename__ = "meeting_emotion_logs"

    id          = Column(Integer, primary_key=True, index=True)
    meeting_id  = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    student_id  = Column(Integer, nullable=False, default=0)
    timestamp_s = Column(Float, nullable=False)
    emotion     = Column(String(50), nullable=False)
    confidence  = Column(Float, nullable=False, default=0.0)
    created_at  = Column(DateTime, server_default=func.now())

    meeting = relationship("Meeting", back_populates="emotion_logs")


class MeetingAnalytics(Base):
    __tablename__ = "meeting_analytics"

    id          = Column(Integer, primary_key=True, index=True)
    meeting_id  = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, unique=True)
    report_json = Column(JSON, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    meeting = relationship("Meeting", back_populates="analytics")
