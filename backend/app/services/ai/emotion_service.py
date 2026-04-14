"""
Emotion detection service.

Uses a YOLO-based model (`emotion_detection_model/best.pt`) to classify student
emotional states from video frames at 1-second intervals.

Detected emotions: engagement, confusion, boredom, frustration, understanding

Prerequisites (when model is available):
  pip install ultralytics opencv-python-headless
  Place the trained model at: <project_root>/emotion_detection_model/best.pt

Falls back gracefully (logs a warning, returns empty list) when:
  - The model file is not found.
  - ultralytics / opencv is not installed.
"""

import logging
import os
from typing import List

logger = logging.getLogger(__name__)

EMOTION_LABELS = ["engagement", "confusion", "boredom", "frustration", "understanding"]

# Model path: <project_root>/emotion_detection_model/research/runs/emotion_detect_phase2/weights/best.pt
# __file__ = backend/app/services/ai/emotion_service.py  (4 dirs deep inside backend)
# One extra dirname gets us out of backend/ to the ConnectEd project root.
_PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
)
MODEL_PATH = os.path.join(
    _PROJECT_ROOT,
    "emotion_detection_model", "research", "runs",
    "emotion_detect_phase2", "weights", "best.pt",
)

_model = None   # lazy-loaded once


def _load_model():
    """Load the YOLO model; returns None if not available."""
    if not os.path.exists(MODEL_PATH):
        logger.warning(
            "[EmotionService] Model not found at %s — "
            "emotion analysis disabled. "
            "Place your trained best.pt there to enable it.",
            MODEL_PATH,
        )
        return None
    try:
        from ultralytics import YOLO  # type: ignore[import]

        model = YOLO(MODEL_PATH)
        logger.info("[EmotionService] Loaded model from %s", MODEL_PATH)
        return model
    except ImportError:
        logger.warning(
            "[EmotionService] ultralytics not installed — "
            "run: pip install ultralytics"
        )
        return None
    except Exception as exc:
        logger.warning("[EmotionService] Failed to load model: %s", exc)
        return None


def analyze_video_emotions(
    video_path: str,
    meeting_id: int,
    db,
) -> List:
    """
    Process a recorded video file and save per-second emotion detections
    to the meeting_emotion_logs table.

    Returns the list of MeetingEmotionLog ORM objects that were created.
    """
    global _model
    if _model is None:
        _model = _load_model()

    if _model is None:
        logger.info("[EmotionService] Skipping — model unavailable")
        return []

    try:
        import cv2  # type: ignore[import]
    except ImportError:
        logger.warning(
            "[EmotionService] opencv-python-headless not installed — "
            "run: pip install opencv-python-headless"
        )
        return []

    if not os.path.exists(video_path):
        logger.warning("[EmotionService] Video file not found: %s", video_path)
        return []

    from app.models.extensions import MeetingEmotionLog

    cap = cv2.VideoCapture(video_path)
    fps: float = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval: int = max(1, int(fps))  # sample 1 frame per second

    logs: List[MeetingEmotionLog] = []
    frame_idx: int = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp_s = frame_idx / fps
            try:
                results = _model(frame, verbose=False)
                for result in results:
                    if result.boxes is None or len(result.boxes) == 0:
                        continue
                    for box in result.boxes:
                        cls_idx = int(box.cls[0])
                        conf    = float(box.conf[0])
                        if cls_idx < len(EMOTION_LABELS):
                            log = MeetingEmotionLog(
                                meeting_id=meeting_id,
                                student_id=0,       # aggregate — camera can't identify individuals
                                timestamp_s=round(timestamp_s, 2),
                                emotion=EMOTION_LABELS[cls_idx],
                                confidence=round(conf, 4),
                            )
                            db.add(log)
                            logs.append(log)
            except Exception as exc:
                logger.debug(
                    "[EmotionService] Frame %d inference failed: %s",
                    frame_idx,
                    exc,
                )

        frame_idx += 1

    cap.release()

    if logs:
        db.commit()

    logger.info(
        "[EmotionService] Processed %d frames → %d emotion events for meeting %d",
        frame_idx,
        len(logs),
        meeting_id,
    )
    return logs


def get_emotion_timeline(meeting_id: int, db) -> List[dict]:
    """
    Return aggregated emotion data bucketed by 10-second windows.
    Used by the RecordingPlayer analytics chart.
    """
    from app.models.extensions import MeetingEmotionLog
    from sqlalchemy import func

    rows = (
        db.query(MeetingEmotionLog)
        .filter(MeetingEmotionLog.meeting_id == meeting_id)
        .order_by(MeetingEmotionLog.timestamp_s)
        .all()
    )

    if not rows:
        return []

    buckets: dict[int, dict[str, int]] = {}
    for row in rows:
        bucket = int(row.timestamp_s // 10) * 10
        if bucket not in buckets:
            buckets[bucket] = {label: 0 for label in EMOTION_LABELS}
        buckets[bucket][row.emotion] = buckets[bucket].get(row.emotion, 0) + 1

    return [
        {"timestamp_s": ts, **counts}
        for ts, counts in sorted(buckets.items())
    ]
