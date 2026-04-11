"""
Pydantic v2 schemas for Attendance, Fees, and Calendar modules.
"""

from __future__ import annotations

import json
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator, model_validator


# Attendance

class AttendanceUpsert(BaseModel):
    student_id: int
    date: date
    status: str          # "Present" | "Absent" | "Late"
    remarks: Optional[str] = None


class AttendanceDayRecord(BaseModel):
    date: str
    status: str


class AttendanceRecordRead(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_code: str
    class_name: str
    date: str
    status: str
    marked_by: str
    attendance_rate: float
    history: List[AttendanceDayRecord] = []

    model_config = {"from_attributes": True}


class AttendanceStats(BaseModel):
    total_students: int
    present_today: int
    absent_today: int
    late_today: int
    overall_rate: float
    trend_pct: float          # % change vs previous equal period


class AttendanceTrendPoint(BaseModel):
    date: str
    rate: float


class AttendanceDistribution(BaseModel):
    present: int
    absent: int
    late: int


class ClasswiseAttendance(BaseModel):
    class_name: str
    rate: float


class ChronicAbsentee(BaseModel):
    student_id: int
    student_name: str
    class_name: str
    attendance_rate: float


# Session-based Attendance (Migration 10)

class LocationRead(BaseModel):
    id: int
    name: str
    type: str
    capacity: Optional[int]
    is_active: bool

    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    name: str
    type: str = "Classroom"
    capacity: Optional[int] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class OpenSessionRequest(BaseModel):
    class_id: int
    session_date: str   # YYYY-MM-DD


class SessionRecordIn(BaseModel):
    student_id: int
    status: str         # "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
    note: Optional[str] = None


class BulkMarkRequest(BaseModel):
    records: List[SessionRecordIn]


class StudentAttendanceRow(BaseModel):
    student_id: int
    student_name: str
    student_code: str
    status: Optional[str] = None
    note: Optional[str] = None
    marked_at: Optional[str] = None


class AttendanceSessionDetail(BaseModel):
    session_id: int
    class_name: str
    subject_name: str
    teacher_name: str
    session_date: str
    delivery_mode: str
    location_name: Optional[str] = None
    online_join_url: Optional[str] = None
    status: str
    roster: List[StudentAttendanceRow] = []


class StudentSessionRecord(BaseModel):
    session_date: str
    class_name: str
    subject_name: str
    time_slot: str
    delivery_mode: str
    status: Optional[str] = None
    note: Optional[str] = None


class StudentAttendanceSummary(BaseModel):
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    unmarked_count: int
    attendance_rate: float
    recent: List[StudentSessionRecord] = []


class AdminSessionRead(BaseModel):
    session_id: int
    class_name: str
    subject_name: str
    teacher_name: str
    session_date: str
    status: str
    total_students: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    unmarked_count: int


class AttendanceOverviewItem(BaseModel):
    class_name: str
    subject_name: str
    total_sessions: int
    avg_attendance_rate: float


# Fees

class AcademicPeriodCreate(BaseModel):
    name: str
    start_date: date
    end_date: date


class AcademicPeriodRead(BaseModel):
    id: int
    name: str
    start_date: str
    end_date: str

    model_config = {"from_attributes": True}


class FeeInstallmentCreate(BaseModel):
    amount: Decimal
    due_date: date


class FeeInstallmentRead(BaseModel):
    id: int
    amount: float
    due_date: str
    is_overdue: bool

    model_config = {"from_attributes": True}


class FeePlanCreate(BaseModel):
    student_id: int
    base_amount: Decimal
    discount_amount: Decimal = Decimal("0.00")
    due_date: date
    academic_period_id: Optional[int] = None
    installments: List[FeeInstallmentCreate] = []


class BulkFeePlanCreate(BaseModel):
    """Create fee plans for all students in a class (or whole school)."""
    class_id: Optional[int] = None    # None = all students in school
    base_amount: Decimal
    discount_amount: Decimal = Decimal("0.00")
    due_date: date
    academic_period_id: Optional[int] = None
    installments: List[FeeInstallmentCreate] = []


class FeePlanUpdate(BaseModel):
    base_amount: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    due_date: Optional[date] = None


class FeePaymentCreate(BaseModel):
    fee_plan_id: int
    amount_paid: Decimal
    payment_method: str = "Cash"   # "Cash" | "Bank Transfer" | "Card"
    transaction_id: Optional[str] = None


class PaymentRecordRead(BaseModel):
    id: int
    date: str
    amount: float
    payment_method: str
    transaction_id: Optional[str]

    model_config = {"from_attributes": True}


class FeeStudentRead(BaseModel):
    fee_plan_id: int
    student_id: int
    student_code: str
    name: str
    class_name: str
    base_amount: float
    discount_amount: float
    total_fee: float
    amount_paid: float
    outstanding_balance: float
    status: str          # "paid" | "partial" | "unpaid" | "overdue"
    due_date: str
    is_overdue: bool
    academic_period: Optional[str] = None
    installments: List[FeeInstallmentRead] = []
    payment_history: List[PaymentRecordRead] = []

    model_config = {"from_attributes": True}


class FeeStats(BaseModel):
    total_collected: float
    total_outstanding: float
    fully_paid_count: int
    overdue_count: int
    total_students: int


class FeeTrendPoint(BaseModel):
    label: str        # e.g. "Jan 2026"
    amount: float


class BulkPlanResult(BaseModel):
    created: int
    skipped: int   # already had a plan for this period


# Calendar / Events

class EventCreate(BaseModel):
    title: str
    type: str                       # "Academic" | "Exam" | "Holiday" | "Meeting" | "Other"
    start_date: date
    end_date: date
    start_time: Optional[str] = None   # "HH:MM"
    end_time: Optional[str] = None
    target_audience_type: str = "All"
    description: Optional[str] = None
    published: bool = False
    class_ids: List[int] = []

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be >= start_date")
        return v


class EventUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    target_audience_type: Optional[str] = None
    description: Optional[str] = None
    published: Optional[bool] = None
    class_ids: Optional[List[int]] = None


class EventRead(BaseModel):
    id: int
    title: str
    type: str
    start_date: str
    end_date: str
    start_time: Optional[str]
    end_time: Optional[str]
    target_audience_type: str
    description: Optional[str]
    published: bool
    created_by: str
    created_at: str
    class_ids: List[int] = []

    model_config = {"from_attributes": True}


# Assignments + Grading

from typing import Any, Dict  # noqa: E402 (already imported above via typing)


class AssignmentAttachmentRead(BaseModel):
    id: int
    file_name: str
    file_type: str
    file_size: int
    file_url: str

    model_config = {"from_attributes": True}


class RubricCriterion(BaseModel):
    criterion: str
    description: Optional[str] = None
    max_points: float


class AssignmentCreate(BaseModel):
    class_id: int
    subject_id: int
    type: str = "ONLINE"          # "ONLINE" | "ON_SITE"
    title: str
    description: Optional[str] = None
    due_at: Optional[str] = None  # ISO datetime string
    max_score: float = 100
    rubric: Optional[List[RubricCriterion]] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    publish: bool = False


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[str] = None
    max_score: Optional[float] = None
    rubric: Optional[List[RubricCriterion]] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    status: Optional[str] = None


class AssignmentRead(BaseModel):
    id: int
    class_id: int
    class_name: Optional[str]
    subject_id: int
    subject_name: Optional[str]
    teacher_id: int
    teacher_name: Optional[str]
    type: str
    title: str
    description: Optional[str]
    due_at: Optional[str]
    max_score: float
    rubric: Optional[Any]
    location: Optional[str]
    duration: Optional[str]
    status: str
    created_at: Optional[str]
    updated_at: Optional[str]
    attachments: List[AssignmentAttachmentRead] = []
    submission_count: int = 0
    graded_count: int = 0

    model_config = {"from_attributes": True}


class SubmissionAttachmentRead(BaseModel):
    id: int
    file_name: str
    file_type: str
    file_size: int
    file_url: str

    model_config = {"from_attributes": True}


class KeyCorrection(BaseModel):
    misconception: str
    correction: str


class StructuredFeedback(BaseModel):
    grade_summary: Optional[str] = None
    strengths: List[str] = []
    areas_to_improve: List[str] = []
    key_corrections: List[KeyCorrection] = []
    next_steps: List[str] = []
    breakdown: Optional[str] = None
    summary_paragraph: Optional[str] = None


class AIReviewRead(BaseModel):
    id: int
    suggested_grade: Optional[float]
    suggested_feedback: Optional[str]
    structured_feedback: Optional[StructuredFeedback] = None
    rubric_alignment: Optional[Any]
    confidence_score: str
    model_info: Optional[Any]
    created_at: str

    @model_validator(mode="after")
    def parse_structured_feedback(self) -> "AIReviewRead":
        if self.suggested_feedback:
            try:
                raw = json.loads(self.suggested_feedback)
                if isinstance(raw, dict):
                    self.structured_feedback = StructuredFeedback(**raw)
            except Exception:
                pass
        return self

    model_config = {"from_attributes": True}


class SubmissionRead(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    student_name: Optional[str]
    student_code: Optional[str]
    submitted_at: Optional[str]
    files: Optional[Any]
    grade: Optional[float]
    feedback: Optional[str]
    status: str
    ai_reviewed: bool
    created_at: Optional[str]
    updated_at: Optional[str]
    sub_attachments: List[SubmissionAttachmentRead] = []
    ai_reviews: List[AIReviewRead] = []

    model_config = {"from_attributes": True}


class ManualGradeRequest(BaseModel):
    submission_id: int
    grade: float
    feedback: Optional[str] = None


class StudentAssignmentRead(BaseModel):
    """Assignment as seen by a student — includes their own submission."""
    id: int
    class_id: int
    class_name: Optional[str]
    subject_id: int
    subject_name: Optional[str]
    teacher_name: Optional[str]
    type: str
    title: str
    description: Optional[str]
    due_at: Optional[str]
    max_score: float
    rubric: Optional[Any]
    location: Optional[str]
    duration: Optional[str]
    status: str
    attachments: List[AssignmentAttachmentRead] = []
    submission: Optional[SubmissionRead] = None

    model_config = {"from_attributes": True}


# Messaging

class ContactRead(BaseModel):
    id: int
    full_name: str
    role: str

    model_config = {"from_attributes": True}


class MessageRead(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    content_type: str
    is_deleted: bool
    created_at: str
    is_mine: bool

    model_config = {"from_attributes": True}


class ConversationRead(BaseModel):
    id: int
    type: str
    other_user_id: int
    other_user_name: str
    other_user_role: str
    last_message_preview: Optional[str]
    unread_count: int
    updated_at: str

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: int
    type: str
    other_user_id: int
    other_user_name: str
    other_user_role: str
    messages: List[MessageRead]

    model_config = {"from_attributes": True}


class StartConversationRequest(BaseModel):
    other_user_id: int
    initial_message: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str


# WhatsApp Notification Settings

class WhatsAppSettings(BaseModel):
    is_connected:         bool
    phone_number:         Optional[str] = None
    notify_exams:         bool = True
    notify_events:        bool = True
    notify_attendance:    bool = True
    notify_messages:      bool = True
    notify_grades:        bool = True
    notify_assignments:   bool = True
    notify_due_reminders: bool = True

    model_config = {"from_attributes": True}


class WhatsAppSettingsUpdate(BaseModel):
    phone_number:         Optional[str] = None
    notify_exams:         Optional[bool] = None
    notify_events:        Optional[bool] = None
    notify_attendance:    Optional[bool] = None
    notify_messages:      Optional[bool] = None
    notify_grades:        Optional[bool] = None
    notify_assignments:   Optional[bool] = None
    notify_due_reminders: Optional[bool] = None


class WhatsAppDeliveryLogRead(BaseModel):
    model_config = {"from_attributes": True}
    id:              int
    wa_message_id:   str
    recipient_phone: str
    status:          str
    error_code:      Optional[int]   = None
    error_message:   Optional[str]   = None
    event_key:       Optional[str]   = None
    updated_at:      Optional[datetime] = None


# Video Conferencing

class MeetingCreate(BaseModel):
    class_id:   int
    subject_id: int
    title:      str


class MeetingRecordingRead(BaseModel):
    id:             int
    meeting_id:     int
    storage_path:   str
    duration_s:     int
    has_transcript: bool
    has_analytics:  bool
    created_at:     Optional[datetime] = None

    model_config = {"from_attributes": True}


class MeetingRead(BaseModel):
    id:               int
    room_name:        str
    teacher_id:       int
    teacher_name:     Optional[str] = None
    class_id:         int
    class_name:       Optional[str] = None
    subject_id:       int
    subject_name:     Optional[str] = None
    title:            str
    status:           str
    started_at:       Optional[datetime] = None
    ended_at:         Optional[datetime] = None
    created_at:       Optional[datetime] = None
    livekit_url:      Optional[str] = None
    participant_token: Optional[str] = None
    recording_count:  int = 0
    recordings:       List[MeetingRecordingRead] = []

    model_config = {"from_attributes": True}


class MeetingAnalyticsRead(BaseModel):
    id:          int
    meeting_id:  int
    report_json: Optional[Any] = None

    model_config = {"from_attributes": True}


class EmotionLogRead(BaseModel):
    id:          int
    meeting_id:  int
    student_id:  int
    timestamp_s: float
    emotion:     str
    confidence:  float

    model_config = {"from_attributes": True}


# Consent Management

class ConsentRecordRead(BaseModel):
    id:              int
    student_id:      int
    consent_type:    str
    status:          str
    granted_by:      Optional[int]
    granted_by_name: Optional[str]
    consent_version: str
    expiry_date:     Optional[str]
    ip_address:      Optional[str]
    created_at:      Optional[str]
    updated_at:      Optional[str]

    model_config = {"from_attributes": True}


class ConsentChoiceItem(BaseModel):
    consent_type: str   # emotion_detection | session_recording | transcript_generation
    status: str         # granted | refused


class ConsentSaveRequest(BaseModel):
    student_id: Optional[int] = None   # Required for parents; students may omit (own id used)
    consents:   List[ConsentChoiceItem]


class ConsentWithdrawRequest(BaseModel):
    consent_type: str
    student_id:   Optional[int] = None   # Required for parents


class ConsentAuditLogRead(BaseModel):
    log_id:          int
    consent_id:      int
    action:          str
    performed_by:    Optional[int]
    previous_status: Optional[str]
    new_status:      Optional[str]
    timestamp:       Optional[str]
    ip_address:      Optional[str]
    notes:           Optional[str]

    model_config = {"from_attributes": True}


class ConsentTypeStats(BaseModel):
    type:      str
    granted:   int
    refused:   int
    pending:   int
    withdrawn: int
    rate:      Optional[float] = None   # consent rate % (admin overview only)


class ClassConsentSummary(BaseModel):
    total_students: int
    consent_types:  List[ConsentTypeStats]


class ComplianceOverview(BaseModel):
    total_students: int
    consent_types:  List[ConsentTypeStats]
