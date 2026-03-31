"""
Live Emotion Detection Web App — Study Hive
============================================
Flask + Flask-SocketIO server that:
  1. Receives webcam frames from the browser via WebSocket
  2. Runs YOLOv8 inference with temporal smoothing
  3. Draws annotated bounding boxes + engagement dashboard
  4. Streams results back to the browser in real time
"""

import base64
import time
import sys
import os
import cv2
import numpy as np
from collections import deque, defaultdict
from pathlib import Path
from flask import Flask, render_template
from flask_socketio import SocketIO, emit

# ── Add parent directory for imports ───────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from ultralytics import YOLO
except ImportError:
    print("✗ ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)


# ── App Setup ──────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['SECRET_KEY'] = 'studyhive-emotion-detection'
socketio = SocketIO(app, cors_allowed_origins="*",
                    ping_timeout=60, ping_interval=25, max_http_buffer_size=10_000_000)


# ── Constants ──────────────────────────────────────────────────────────────
CLASS_NAMES = {0: "Engaged", 1: "Confused", 2: "Disengaged"}
CLASS_COLORS = {
    0: (0, 200, 0),      # Green
    1: (0, 165, 255),     # Orange
    2: (0, 0, 220),       # Red
}
CLASS_COLORS_HEX = {
    0: "#00c800",   # Green
    1: "#ffa500",   # Orange
    2: "#dc0000",   # Red
}

MODEL_PATH = str(Path(__file__).resolve().parent.parent / "runs" / "emotion_detect_phase2" / "weights" / "best.pt")


# ── Temporal Smoother ─────────────────────────────────────────────────────
class TemporalSmoother:
    """Smooth detections over multiple frames to reduce flickering."""

    def __init__(self, window_size: int = 6):
        self.window_size = window_size
        self.history = defaultdict(lambda: deque(maxlen=window_size))
        self.tracker_id = 0

    def update(self, detections: list) -> list:
        if not detections:
            # Decay existing tracks
            to_remove = []
            for k in self.history:
                if len(self.history[k]) > 0:
                    self.history[k].append(self.history[k][-1])
                    if len(self.history[k]) >= self.window_size:
                        to_remove.append(k)
            for k in to_remove:
                del self.history[k]
            return []

        current_centers = []
        for bbox, cls_id, conf in detections:
            cx = (bbox[0] + bbox[2]) / 2
            cy = (bbox[1] + bbox[3]) / 2
            current_centers.append((cx, cy, bbox, cls_id, conf))

        used_tracks = set()
        results = []

        for cx, cy, bbox, cls_id, conf in current_centers:
            best_track = None
            best_dist = float('inf')

            for track_id, history in self.history.items():
                if track_id in used_tracks:
                    continue
                if len(history) > 0:
                    last = history[-1]
                    dist = ((cx - last[0]) ** 2 + (cy - last[1]) ** 2) ** 0.5
                    if dist < best_dist and dist < 100:
                        best_dist = dist
                        best_track = track_id

            if best_track is None:
                best_track = self.tracker_id
                self.tracker_id += 1

            used_tracks.add(best_track)
            self.history[best_track].append((cx, cy, cls_id, conf))

            # Majority vote + average confidence
            cls_votes = defaultdict(int)
            conf_sum = 0
            for _, _, c, co in self.history[best_track]:
                cls_votes[c] += 1
                conf_sum += co

            smooth_cls = max(cls_votes, key=cls_votes.get)
            smooth_conf = conf_sum / len(self.history[best_track])
            results.append((bbox, smooth_cls, smooth_conf, best_track))

        # Clean old tracks
        active = set(used_tracks)
        to_remove = [k for k in self.history if k not in active]
        for k in to_remove:
            if len(self.history[k]) > 0:
                self.history[k].append(self.history[k][-1])
                if len(self.history[k]) >= self.window_size:
                    del self.history[k]

        return results


# ── Engagement Metrics ────────────────────────────────────────────────────
class EngagementTracker:
    """Track engagement metrics over time."""

    def __init__(self):
        self.score_history = deque(maxlen=60)  # ~2 seconds

    def compute_score(self, class_counts: dict) -> float:
        total = sum(class_counts.values())
        if total == 0:
            return 100.0
        engaged = class_counts.get(0, 0)
        confused = class_counts.get(1, 0)
        score = (engaged * 100 + confused * 40) / total
        return round(score, 1)

    def update(self, class_counts: dict) -> dict:
        score = self.compute_score(class_counts)
        self.score_history.append(score)
        avg_score = sum(self.score_history) / len(self.score_history)

        total = sum(class_counts.values()) or 1
        return {
            "score": round(avg_score, 1),
            "counts": {CLASS_NAMES[i]: class_counts.get(i, 0) for i in range(3)},
            "percentages": {CLASS_NAMES[i]: round(class_counts.get(i, 0) / total * 100, 1) for i in range(3)},
            "total": sum(class_counts.values()),
            "alert": (class_counts.get(1, 0) + class_counts.get(2, 0)) / total > 0.4 if total > 0 else False,
        }


# ── Drawing Functions ─────────────────────────────────────────────────────
def draw_detections(frame, results):
    """Draw bounding boxes and labels on frame. Returns class counts."""
    class_counts = defaultdict(int)

    for bbox, cls_id, conf, track_id in results:
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        color = CLASS_COLORS.get(cls_id, (200, 200, 200))
        name = CLASS_NAMES.get(cls_id, "Unknown")
        class_counts[cls_id] += 1

        # Bounding box
        thickness = 2 if cls_id == 0 else 3
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Label background
        label = f"{name} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
        cv2.putText(frame, label, (x1 + 5, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

    return dict(class_counts)


# ── Global State ──────────────────────────────────────────────────────────
print(f"  Loading model: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("  ✅ Model loaded successfully!")

smoother = TemporalSmoother(window_size=6)
engagement = EngagementTracker()
fps_history = deque(maxlen=30)
processing = False  # Back-pressure flag


# ── Routes ────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')


# ── WebSocket Events ─────────────────────────────────────────────────────
@socketio.on('connect')
def handle_connect():
    print("  🔌 Client connected")
    emit('server_ready', {'status': 'connected', 'model': Path(MODEL_PATH).name})


@socketio.on('disconnect')
def handle_disconnect():
    print("  🔌 Client disconnected")


@socketio.on('frame')
def handle_frame(data):
    global processing
    if processing:
        return  # Back-pressure: skip if still processing previous frame
    processing = True

    try:
        t_start = time.time()

        # Decode base64 frame
        img_data = data.get('image', '')
        if ',' in img_data:
            img_data = img_data.split(',')[1]

        img_bytes = base64.b64decode(img_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            processing = False
            return

        # Run inference
        results = model.predict(
            frame,
            imgsz=640,
            conf=0.25,
            iou=0.45,
            half=False,
            max_det=30,
            verbose=False,
        )

        # Extract detections
        detections = []
        if results and len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                bbox = boxes.xyxy[i].cpu().numpy()
                cls_id = int(boxes.cls[i].cpu().numpy())
                conf = float(boxes.conf[i].cpu().numpy())

                min_conf = 0.25 if cls_id == 1 else 0.35
                if conf >= min_conf:
                    detections.append((bbox, cls_id, conf))

        # Temporal smoothing
        smoothed = smoother.update(detections)

        # Draw on frame
        class_counts = draw_detections(frame, smoothed)

        # Encode result frame
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 75]
        _, buffer = cv2.imencode('.jpg', frame, encode_params)
        result_b64 = base64.b64encode(buffer).decode('utf-8')

        # Compute metrics
        t_end = time.time()
        fps = 1.0 / max(t_end - t_start, 0.001)
        fps_history.append(fps)
        avg_fps = sum(fps_history) / len(fps_history)

        metrics = engagement.update(class_counts)
        metrics['fps'] = round(avg_fps, 1)
        metrics['inference_ms'] = round((t_end - t_start) * 1000, 1)

        # Send back
        emit('result', {
            'image': f'data:image/jpeg;base64,{result_b64}',
            'metrics': metrics,
        })

    except Exception as e:
        print(f"  ✗ Frame processing error: {e}")
    finally:
        processing = False


# ── Main ──────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  STUDY HIVE — LIVE EMOTION DETECTION WEB APP")
    print("=" * 60)
    print(f"  Model:  {MODEL_PATH}")
    print(f"  Server: http://localhost:5000")
    print("=" * 60 + "\n")

    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
