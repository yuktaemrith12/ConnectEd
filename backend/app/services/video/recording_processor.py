"""
Post-session recording pipeline orchestrator.

Pipeline steps (run in a background thread via FastAPI BackgroundTasks):
  1. Transcription  — Whisper extracts text from the audio track.
  2. Emotion        — YOLO model detects student emotions frame-by-frame.
  3. AI Report      — Claude correlates transcript + emotions to find confusion peaks.
  4. RAG Ingestion  — Transcript is added to the AI Tutor's knowledge base.
  5. Persist        — MeetingAnalytics row saved / updated.

Each step is fault-tolerant: a failure logs a warning but does not abort subsequent steps.
"""

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

def process_recording(
    recording_id: int,
    meeting_id: int,
    file_path: str,
    db_session_factory,
) -> None:
    """
    Orchestrate the full post-recording pipeline.
    Designed to be called from BackgroundTasks or a task queue.
    """
    logger.info(
        "[RecordingProcessor] Starting pipeline — recording=%d  meeting=%d",
        recording_id,
        meeting_id,
    )

    with db_session_factory() as db:
        from app.models.extensions import Meeting, MeetingAnalytics, MeetingRecording

        recording: Optional[MeetingRecording] = (
            db.query(MeetingRecording)
            .filter(MeetingRecording.id == recording_id)
            .first()
        )
        if not recording:
            logger.error("[RecordingProcessor] Recording %d not found", recording_id)
            return

        # Step 1: Transcription
        transcript_text: Optional[str] = None
        try:
            transcript_text = _transcribe(file_path)
            if transcript_text:
                recording.has_transcript = True
                db.commit()
                logger.info("[RecordingProcessor] Transcription done (%d chars)", len(transcript_text))
        except Exception as exc:
            logger.warning("[RecordingProcessor] Transcription failed: %s", exc)

        # Step 2: Emotion Analysis
        emotion_summary: dict[str, Any] = {}
        try:
            from app.services.ai.emotion_service import analyze_video_emotions
            logs = analyze_video_emotions(file_path, meeting_id, db)
            emotion_summary = _aggregate_emotions(logs)
            if logs:
                recording.has_analytics = True
                db.commit()
                logger.info("[RecordingProcessor] Emotion analysis done: %s", emotion_summary)
        except Exception as exc:
            logger.warning("[RecordingProcessor] Emotion analysis failed: %s", exc)

        # Step 3: AI Analytics Report
        try:
            report = _generate_ai_report(transcript_text, emotion_summary, meeting_id)
            existing = (
                db.query(MeetingAnalytics)
                .filter(MeetingAnalytics.meeting_id == meeting_id)
                .first()
            )
            if existing:
                existing.report_json = report
            else:
                db.add(MeetingAnalytics(meeting_id=meeting_id, report_json=report))
            db.commit()
            logger.info("[RecordingProcessor] Analytics report saved for meeting %d", meeting_id)
        except Exception as exc:
            logger.warning("[RecordingProcessor] AI report failed: %s", exc)

        # Step 4: RAG Ingestion
        if transcript_text:
            try:
                meeting: Optional[Meeting] = (
                    db.query(Meeting).filter(Meeting.id == meeting_id).first()
                )
                if meeting:
                    _ingest_to_rag(transcript_text, meeting, db)
            except Exception as exc:
                logger.warning("[RecordingProcessor] RAG ingestion failed: %s", exc)

    logger.info("[RecordingProcessor] Pipeline complete — recording=%d", recording_id)

# Helpers

def _transcribe(file_path: str) -> Optional[str]:
    """Extract audio and transcribe using the existing transcription service."""
    from app.services.ai.transcription_service import transcribe_audio_file
    return transcribe_audio_file(file_path)

def _aggregate_emotions(logs: list) -> dict[str, float]:
    """Convert raw emotion log rows into percentage summary."""
    if not logs:
        return {}
    counts: dict[str, int] = {}
    for log in logs:
        counts[log.emotion] = counts.get(log.emotion, 0) + 1
    total = len(logs)
    return {emotion: round(count / total * 100, 1) for emotion, count in counts.items()}

def _generate_ai_report(
    transcript: Optional[str],
    emotion_summary: dict,
    meeting_id: int,
) -> dict:
    """
    Use Claude to correlate transcript + emotion data and produce:
      - confusion_peaks (timestamped topic moments of confusion)
      - ai_suggestions  (teaching improvement tips)
      - engagement_score (0-100)
      - summary         (one-paragraph overview)
    """
    report: dict = {
        "meeting_id": meeting_id,
        "emotion_summary": emotion_summary,
        "confusion_peaks": [],
        "ai_suggestions": [],
        "engagement_score": None,
        "summary": None,
        "transcript": transcript or None,
        "transcript_snippet": (transcript or "")[:400] or None,
    }

    if not transcript and not emotion_summary:
        return report

    try:
        import anthropic

        emotion_text = (
            ", ".join(f"{k}: {v}%" for k, v in emotion_summary.items())
            if emotion_summary
            else "no emotion data available"
        )
        prompt = (
            "You are an educational analytics AI. Analyze this class session data.\n\n"
            f"Emotion breakdown (% of detected frames): {emotion_text}\n\n"
            f"Transcript excerpt (first 2000 chars):\n{(transcript or '')[:2000]}\n\n"
            "Return ONLY a JSON object with these exact keys:\n"
            '- "confusion_peaks": list of {"topic": str, "description": str}\n'
            '- "ai_suggestions": list of strings\n'
            '- "engagement_score": integer 0-100\n'
            '- "summary": one-paragraph string\n'
            "No markdown, no extra text — just the JSON object."
        )

        client = anthropic.Anthropic()
        msg = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if Claude wraps the JSON
        if raw.startswith("```"):
            raw = raw.split("```", 1)[1]        # drop opening ```
            if raw.startswith("json"):
                raw = raw[4:]                    # drop language tag
            raw = raw.rsplit("```", 1)[0]        # drop closing ```
            raw = raw.strip()
        if not raw:
            raise ValueError("Claude returned an empty response")
        parsed = json.loads(raw)
        report.update(parsed)
    except Exception as exc:
        logger.warning("[RecordingProcessor] AI report generation failed: %s", exc)

    return report

def _ingest_to_rag(transcript_text: str, meeting, db) -> None:
    """Add the session transcript to the AI Tutor's RAG knowledge base."""
    from app.models.ai_tutor import AiTutor, AiTutorTranscript, TranscriptStatusEnum
    from app.services.ai_tutor.document_ingestion import ingest_transcript

    tutor = (
        db.query(AiTutor)
        .filter(
            AiTutor.class_id == meeting.class_id,
            AiTutor.subject_id == meeting.subject_id,
        )
        .first()
    )
    if not tutor:
        logger.info(
            "[RecordingProcessor] No AI Tutor found for class=%d subject=%d — skipping RAG",
            meeting.class_id,
            meeting.subject_id,
        )
        return

    # Create a transcript record and auto-approve so it gets indexed immediately
    transcript_obj = AiTutorTranscript(
        tutor_id=tutor.id,
        raw_transcript=transcript_text,
        approved_transcript=transcript_text,
        status=TranscriptStatusEnum.approved,
    )
    db.add(transcript_obj)
    db.commit()
    db.refresh(transcript_obj)
    ingest_transcript(transcript_obj, db)
    logger.info(
        "[RecordingProcessor] Transcript ingested into AI Tutor %d", tutor.id
    )
