"""
Transcript-to-Notes API
POST /upload        — accepts audio/video, kicks off background pipeline, returns job_id
GET  /jobs/{job_id} — poll for status + results
GET  /history       — list the student's past jobs
"""
import os
import shutil
import tempfile

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.dependencies import get_current_user
from app.models.extensions import AIStudyMaterial, AIStudyMaterialStatusEnum
from app.models.user import User
from app.services.ai.illustration_service import generate_multi_illustrations
from app.services.ai.notes_generator_service import generate_study_notes
from app.services.ai.transcription_service import transcribe_audio

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".mp4", ".m4a", ".mov", ".webm", ".ogg", ".flac"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


# Background pipeline

def _set_stage(job_id: int, stage: str, db: Session) -> None:
    job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
    if job:
        job.current_stage = stage
        db.commit()


async def _run_pipeline(job_id: int, audio_path: str, language: str) -> None:
    """Full AI pipeline: Transcribe → Notes → Illustration. Updates DB at each stage."""
    db = SessionLocal()
    try:
        # Stage 1 – Transcription
        _set_stage(job_id, "transcribing", db)

        # Partial-transcript callback: streams MMS chunk results to the DB
        # so the student sees text appearing while Creole is still processing.
        def _on_partial(partial_text: str) -> None:
            try:
                j = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
                if j:
                    j.transcript = f"[Transcribing…]\n\n{partial_text}"
                    db.commit()
            except Exception:
                pass  # Non-fatal — full transcript saved at end regardless

        transcript, _ = await transcribe_audio(audio_path, language, on_partial=_on_partial)

        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.transcript = transcript
            db.commit()

        # Stage 2 – Notes
        _set_stage(job_id, "generating_notes", db)
        notes = await generate_study_notes(transcript, language)

        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.notes_markdown = notes
            db.commit()

        # Stage 3 – Illustrations (non-fatal if it fails)
        _set_stage(job_id, "creating_illustration", db)
        illustration_url: str | None = None
        try:
            visuals = await generate_multi_illustrations(notes)
            if visuals:
                import json as _json
                illustration_url = _json.dumps(visuals)
        except Exception as illus_err:
            print(f"[T2N] Illustration failed (non-fatal): {illus_err}")

        # Mark complete
        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.illustration_url = illustration_url
            job.status = AIStudyMaterialStatusEnum.completed
            job.current_stage = "completed"
            db.commit()

    except Exception as exc:
        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.status = AIStudyMaterialStatusEnum.failed
            job.error_message = str(exc)
            db.commit()
        print(f"[T2N] Pipeline error for job {job_id}: {exc}")

    finally:
        db.close()
        if os.path.exists(audio_path):
            os.remove(audio_path)


# Endpoints

@router.post("/upload", status_code=202)
async def upload_and_process(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form(default="en"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept an audio/video file and start the AI pipeline.
    Returns a job_id to poll for results.
    language: "en" | "mfe" | "mfe_fusion"
    """
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{suffix}'.")

    # Save to a temp file that persists beyond the request
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    if os.path.getsize(tmp_path) > MAX_FILE_SIZE:
        os.remove(tmp_path)
        raise HTTPException(status_code=400, detail="File exceeds 100 MB limit.")

    # Create a DB record
    job = AIStudyMaterial(
        student_id=current_user.id,
        source_type="upload",
        source_reference=file.filename,
        language=language,
        status=AIStudyMaterialStatusEnum.processing,
        current_stage="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Kick off async pipeline as a background task
    background_tasks.add_task(_run_pipeline, job.id, tmp_path, language)

    return {"job_id": job.id, "status": "processing"}


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll for the current status and results of a processing job."""
    job = (
        db.query(AIStudyMaterial)
        .filter(
            AIStudyMaterial.id == job_id,
            AIStudyMaterial.student_id == current_user.id,
        )
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "job_id":           job.id,
        "status":           job.status.value,
        "current_stage":    job.current_stage,
        "language":         job.language,
        "source_reference": job.source_reference,
        "transcript":       job.transcript,
        "notes_markdown":   job.notes_markdown,
        "illustration_url": job.illustration_url,
        "error_message":    job.error_message,
        "created_at":       job.created_at.isoformat() if job.created_at else None,
    }


@router.post("/from-recording/{meeting_id}", status_code=202)
async def notes_from_recording(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    language: str = "en",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate study notes from an already-transcribed class recording.
    Skips transcription — uses transcript stored in meeting_analytics.report_json.
    Returns a job_id to poll for results.
    """
    from app.models.extensions import Meeting, MeetingAnalytics

    analytics = (
        db.query(MeetingAnalytics)
        .filter(MeetingAnalytics.meeting_id == meeting_id)
        .first()
    )
    transcript_text = None
    if analytics and analytics.report_json:
        transcript_text = analytics.report_json.get("transcript")
        if not transcript_text:
            transcript_text = analytics.report_json.get("transcript_snippet")

    if not transcript_text:
        raise HTTPException(
            status_code=404,
            detail="No transcript available for this recording. Run the recording pipeline first.",
        )

    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    meeting_title = (meeting.title if meeting and meeting.title else f"Meeting #{meeting_id}")

    job = AIStudyMaterial(
        student_id=current_user.id,
        source_type="class_recording",
        source_reference=meeting_title,
        language=language,
        status=AIStudyMaterialStatusEnum.processing,
        current_stage="generating_notes",
        transcript=transcript_text,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_pipeline_from_transcript, job.id, transcript_text, language)
    return {"job_id": job.id, "status": "processing"}


async def _run_pipeline_from_transcript(job_id: int, transcript_text: str, language: str) -> None:
    """Notes + illustration pipeline — transcript already available, skip transcription."""
    db = SessionLocal()
    try:
        _set_stage(job_id, "generating_notes", db)
        notes = await generate_study_notes(transcript_text, language)

        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.notes_markdown = notes
            db.commit()

        _set_stage(job_id, "creating_illustration", db)
        illustration_url: str | None = None
        try:
            visuals = await generate_multi_illustrations(notes)
            if visuals:
                import json as _json
                illustration_url = _json.dumps(visuals)
        except Exception as illus_err:
            print(f"[T2N] Illustration failed (non-fatal): {illus_err}")

        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.illustration_url = illustration_url
            job.status = AIStudyMaterialStatusEnum.completed
            job.current_stage = "completed"
            db.commit()

    except Exception as exc:
        job = db.query(AIStudyMaterial).filter(AIStudyMaterial.id == job_id).first()
        if job:
            job.status = AIStudyMaterialStatusEnum.failed
            job.error_message = str(exc)
            db.commit()
        print(f"[T2N] from-recording pipeline error for job {job_id}: {exc}")
    finally:
        db.close()


@router.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the 20 most recent jobs for the current student."""
    jobs = (
        db.query(AIStudyMaterial)
        .filter(AIStudyMaterial.student_id == current_user.id)
        .order_by(AIStudyMaterial.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "job_id":           j.id,
            "status":           j.status.value,
            "current_stage":    j.current_stage,
            "language":         j.language,
            "source_reference": j.source_reference,
            "created_at":       j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]
