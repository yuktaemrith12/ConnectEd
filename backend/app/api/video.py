"""
Video Conferencing API
Prefix (set in main.py): /api/v1/video

Endpoints:
  POST   /meetings              — teacher creates / starts a meeting
  GET    /meetings              — teacher lists their meetings
  GET    /meetings/{id}         — get meeting details + fresh participant token
  POST   /meetings/{id}/end    — teacher ends the meeting
  GET    /meetings/{id}/join    — any authenticated user gets a join token
  POST   /webhook               — LiveKit webhook handler (EGRESS_ENDED etc.)
  GET    /meetings/{id}/analytics  — get the AI analytics report
  GET    /meetings/{id}/emotion-timeline — per-second emotion data for charts
  POST   /recordings/notify     — called by recording pipeline when file is ready
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.admin import Class, ClassSubjectTeacher, Subject
from app.models.extensions import (
    Meeting,
    MeetingAnalytics,
    MeetingEmotionLog,
    MeetingRecording,
    MeetingStatusEnum,
)
from app.models.user import User
from app.schemas.extensions import (
    MeetingCreate,
    MeetingRead,
    MeetingRecordingRead,
    MeetingAnalyticsRead,
    EmotionLogRead,
)
from app.services.video.livekit_service import (
    LIVEKIT_URL,
    delete_room,
    generate_participant_token,
    generate_room_name,
    is_livekit_configured,
    start_egress_recording,
    start_egress_recording_async,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_teacher = Depends(require_role("teacher"))
_any_user = Depends(get_current_user)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _meeting_to_read(meeting: Meeting, token: Optional[str] = None) -> MeetingRead:
    return MeetingRead(
        id=meeting.id,
        room_name=meeting.room_name,
        teacher_id=meeting.teacher_id,
        teacher_name=meeting.teacher.full_name if meeting.teacher else None,
        class_id=meeting.class_id,
        class_name=meeting.class_.name if meeting.class_ else None,
        subject_id=meeting.subject_id,
        subject_name=meeting.subject.name if meeting.subject else None,
        title=meeting.title,
        status=meeting.status.value if hasattr(meeting.status, "value") else str(meeting.status),
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        created_at=meeting.created_at,
        livekit_url=LIVEKIT_URL.replace("ws://", "http://").replace("wss://", "https://"),
        participant_token=token,
        recording_count=len(meeting.recordings),
        recordings=[
            MeetingRecordingRead(
                id=r.id,
                meeting_id=r.meeting_id,
                storage_path=r.storage_path,
                duration_s=r.duration_s,
                has_transcript=r.has_transcript,
                has_analytics=r.has_analytics,
                created_at=r.created_at,
            )
            for r in meeting.recordings
        ],
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/meetings", response_model=MeetingRead)
def start_meeting(
    payload: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """Teacher creates a new live meeting room."""
    # Validate class + subject exist
    cls = db.query(Class).filter(Class.id == payload.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    subj = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")

    room_name = generate_room_name(payload.class_id, payload.subject_id)
    meeting = Meeting(
        room_name=room_name,
        teacher_id=current_user.id,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        title=payload.title,
        status=MeetingStatusEnum.active,
        started_at=datetime.now(timezone.utc),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    token = generate_participant_token(
        room_name=room_name,
        participant_identity=f"teacher-{current_user.id}",
        participant_name=current_user.full_name,
        is_teacher=True,
    )

    logger.info(
        "Meeting %d started by teacher %d  room=%s  livekit_ready=%s",
        meeting.id,
        current_user.id,
        room_name,
        is_livekit_configured(),
    )
    return _meeting_to_read(meeting, token)


@router.get("/meetings", response_model=List[MeetingRead])
def list_meetings(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """Return all meetings created by the current teacher."""
    q = db.query(Meeting).filter(Meeting.teacher_id == current_user.id)
    if status:
        q = q.filter(Meeting.status == status)
    meetings = q.order_by(Meeting.created_at.desc()).all()
    return [_meeting_to_read(m) for m in meetings]


@router.get("/active-meetings", response_model=List[MeetingRead])
def get_active_meetings(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """Return currently active meetings, optionally filtered by class."""
    q = db.query(Meeting).filter(Meeting.status == MeetingStatusEnum.active)
    if class_id:
        q = q.filter(Meeting.class_id == class_id)
    return [_meeting_to_read(m) for m in q.all()]


@router.get("/completed-meetings", response_model=List[MeetingRead])
def get_completed_meetings(
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """
    Return completed meetings with at least one recording.
    For students: auto-filtered to their enrolled class.
    For teachers: returns their own completed meetings.
    """
    from app.models.admin import StudentProfile

    q = db.query(Meeting).filter(Meeting.status == MeetingStatusEnum.completed)

    if current_user.role and hasattr(current_user.role, "name"):
        role_name = current_user.role.name
    else:
        role_name = str(current_user.role or "")

    if role_name == "student":
        sp = (
            db.query(StudentProfile)
            .filter(StudentProfile.user_id == current_user.id)
            .first()
        )
        if sp and sp.class_id:
            q = q.filter(Meeting.class_id == sp.class_id)
        else:
            return []
    elif role_name == "teacher":
        q = q.filter(Meeting.teacher_id == current_user.id)
    # admin/parent: return all completed meetings (no filter)

    meetings = q.order_by(Meeting.created_at.desc()).all()
    return [_meeting_to_read(m) for m in meetings]


@router.get("/meetings/{meeting_id}", response_model=MeetingRead)
def get_meeting(
    meeting_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """
    Get meeting details + a fresh participant token for any authenticated user.
    Teachers get an admin token; others get a subscriber token.
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.status == MeetingStatusEnum.cancelled:
        raise HTTPException(status_code=410, detail="Meeting was cancelled")

    # Prevent browsers from caching this response (avoids stale 410 being replayed)
    response.headers["Cache-Control"] = "no-store"

    # Only generate a join token for active meetings (room still exists)
    token = None
    if meeting.status == MeetingStatusEnum.active:
        is_teacher = current_user.id == meeting.teacher_id
        token = generate_participant_token(
            room_name=meeting.room_name,
            participant_identity=f"user-{current_user.id}",
            participant_name=current_user.full_name,
            is_teacher=is_teacher,
        )
    return _meeting_to_read(meeting, token)


@router.post("/meetings/{meeting_id}/end", response_model=MeetingRead)
def end_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """Teacher ends the meeting. Closes the LiveKit room."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can end this meeting")

    meeting.status   = MeetingStatusEnum.completed
    meeting.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(meeting)

    # Close the LiveKit room (non-blocking best-effort)
    delete_room(meeting.room_name)

    logger.info("Meeting %d ended by teacher %d", meeting_id, current_user.id)
    return _meeting_to_read(meeting)


@router.get("/meetings/{meeting_id}/join", response_model=MeetingRead)
def join_meeting(
    meeting_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """Alias for GET /meetings/{id} — returns a fresh join token."""
    return get_meeting(meeting_id, response, db, current_user)


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/meetings/{meeting_id}/transcript")
def get_meeting_transcript(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """
    Return the full session transcript for a meeting.
    Priority:
      1. report_json["transcript"] — stored by new pipeline runs
      2. AiTutorTranscript row linked to the meeting's class+subject — stored by RAG ingestion
      3. report_json["transcript_snippet"] — 400-char partial (last resort)
    """
    from app.models.ai_tutor import AiTutor, AiTutorTranscript

    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # 1. Check analytics report_json first
    analytics = (
        db.query(MeetingAnalytics)
        .filter(MeetingAnalytics.meeting_id == meeting_id)
        .first()
    )
    if analytics and analytics.report_json:
        full = analytics.report_json.get("transcript")
        if full:
            return {"meeting_id": meeting_id, "transcript": full}

    # 2. Fall back to ai_tutor_transcripts (full text ingested during RAG step)
    tutor = (
        db.query(AiTutor)
        .filter(
            AiTutor.class_id == meeting.class_id,
            AiTutor.subject_id == meeting.subject_id,
        )
        .first()
    )
    if tutor:
        transcript_row = (
            db.query(AiTutorTranscript)
            .filter(AiTutorTranscript.tutor_id == tutor.id)
            .order_by(AiTutorTranscript.created_at.desc())
            .first()
        )
        if transcript_row:
            text = transcript_row.approved_transcript or transcript_row.raw_transcript
            if text:
                return {"meeting_id": meeting_id, "transcript": text}

    # 3. Fall back to snippet
    if analytics and analytics.report_json:
        snippet = analytics.report_json.get("transcript_snippet")
        if snippet:
            return {"meeting_id": meeting_id, "transcript": snippet, "partial": True}

    raise HTTPException(status_code=404, detail="Transcript not available for this meeting")


@router.get("/meetings/{meeting_id}/analytics", response_model=MeetingAnalyticsRead)
def get_analytics(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """Return the AI analytics report for a completed meeting."""
    analytics = (
        db.query(MeetingAnalytics)
        .filter(MeetingAnalytics.meeting_id == meeting_id)
        .first()
    )
    if not analytics:
        raise HTTPException(status_code=404, detail="Analytics not yet available")
    return MeetingAnalyticsRead(
        id=analytics.id,
        meeting_id=analytics.meeting_id,
        report_json=analytics.report_json,
    )


@router.get("/meetings/{meeting_id}/emotion-timeline")
def get_emotion_timeline(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = _any_user,
):
    """Return 10-second bucketed emotion data for the analytics chart."""
    from app.services.ai.emotion_service import get_emotion_timeline as _svc_timeline
    timeline = _svc_timeline(meeting_id, db)
    return {"meeting_id": meeting_id, "timeline": timeline}


@router.post("/meetings/{meeting_id}/trigger-processing")
def trigger_processing(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = _teacher,
):
    """
    Manually trigger the post-recording pipeline for the most recent recording
    of a meeting.  Useful for testing analytics without a live egress setup.
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the meeting host can trigger processing")

    recording = (
        db.query(MeetingRecording)
        .filter(MeetingRecording.meeting_id == meeting_id)
        .order_by(MeetingRecording.created_at.desc())
        .first()
    )
    if not recording:
        raise HTTPException(status_code=404, detail="No recordings found for this meeting")

    from app.core.database import SessionLocal
    from app.services.video.recording_processor import process_recording

    background_tasks.add_task(
        process_recording,
        recording.id,
        meeting_id,
        recording.storage_path,
        SessionLocal,
    )
    logger.info(
        "[video] Manual processing triggered — meeting=%d  recording=%d",
        meeting_id, recording.id,
    )
    return {"status": "processing_queued", "recording_id": recording.id}


# ─── Webhook ──────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def livekit_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Handle LiveKit server webhooks.

    Relevant events:
      EGRESS_ENDED   — recording file is ready; triggers the processing pipeline.
      ROOM_FINISHED  — auto-close the meeting if teacher forgot to end it.

    Configure your LiveKit server to POST to: POST /api/v1/video/webhook
    with API key verification (or leave open in dev).
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = body.get("event", "")
    logger.info("[VideoWebhook] event=%s", event)

    if event == "room_started":
        await _handle_room_started(body)
    elif event == "egress_ended":
        _handle_egress_ended(body, background_tasks, db)
    elif event == "room_finished":
        _handle_room_finished(body, db)

    return {"status": "ok"}


async def _handle_room_started(body: dict):
    """Room now exists on LiveKit — safe to start egress recording."""
    if os.getenv("LIVEKIT_EGRESS_ENABLED", "0").lower() not in ("1", "true", "yes"):
        return
    room_name = body.get("room", {}).get("name", "")
    if not room_name:
        return
    egress_id = await start_egress_recording_async(room_name)
    if egress_id:
        logger.info("[VideoWebhook] Egress %s started for room %s", egress_id, room_name)
    else:
        logger.warning("[VideoWebhook] Egress start failed for room %s", room_name)


def _handle_egress_ended(body: dict, background_tasks: BackgroundTasks, db: Session):
    """
    LiveKit has finished writing the recording to disk.
    Register the recording and trigger the post-processing pipeline.
    """
    egress = body.get("egressInfo", {})
    room_name = egress.get("roomName", "")
    raw_path  = egress.get("file", {}).get("filename", "")

    # Try multiple locations for duration (SDK source puts it in fileResults)
    duration: int = int(egress.get("duration", 0) or 0) // 1_000_000_000
    if duration == 0:
        file_results = egress.get("fileResults", [])
        if file_results:
            duration = int(file_results[0].get("duration", 0) or 0) // 1_000_000_000
    if duration == 0:
        started = int(egress.get("startedAt", 0) or 0)
        ended   = int(egress.get("endedAt",   0) or 0)
        if started and ended:
            duration = (ended - started) // 1_000_000_000

    if not room_name or not raw_path:
        logger.warning("[VideoWebhook] EGRESS_ENDED missing room/file info")
        return

    # Egress reports the Linux container path (e.g. /tmp/recordings/room.mp4).
    # Re-map to the host-local directory so the backend can open the file.
    recording_dir = os.getenv("LIVEKIT_RECORDING_DIR", "/tmp/recordings")
    filename = os.path.basename(raw_path)
    file_path = os.path.join(recording_dir, filename)

    meeting = db.query(Meeting).filter(Meeting.room_name == room_name).first()
    if not meeting:
        logger.warning("[VideoWebhook] No meeting found for room %s", room_name)
        return

    # Persist the recording row
    rec = MeetingRecording(
        meeting_id=meeting.id,
        storage_path=file_path,
        duration_s=duration,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    # Kick off the async pipeline
    from app.core.database import SessionLocal
    from app.services.video.recording_processor import process_recording

    background_tasks.add_task(
        process_recording,
        rec.id,
        meeting.id,
        file_path,
        SessionLocal,
    )
    logger.info(
        "[VideoWebhook] Recording %d registered  meeting=%d  pipeline queued",
        rec.id,
        meeting.id,
    )


def _handle_room_finished(body: dict, db: Session):
    """Auto-complete a meeting when the LiveKit room closes."""
    room_name = body.get("room", {}).get("name", "")
    if not room_name:
        return
    meeting = db.query(Meeting).filter(
        Meeting.room_name == room_name,
        Meeting.status == MeetingStatusEnum.active,
    ).first()
    if meeting:
        meeting.status   = MeetingStatusEnum.completed
        meeting.ended_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("[VideoWebhook] Meeting %d auto-completed (room finished)", meeting.id)
