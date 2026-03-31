"""
Live Inference Script — Student Emotion Detection
=================================================
Full-featured real-time emotion detection with all enhancements:

  ✓ Webcam / video stream input
  ✓ Temporal smoothing (rolling average over N frames)
  ✓ Confusion alert system (triggers when ratio exceeds threshold)
  ✓ Per-student emotion tracking with colored bounding boxes
  ✓ FPS counter overlay
  ✓ Frame skipping for performance
  ✓ ONNX / TensorRT accelerated inference
  ✓ Half-precision (FP16) support
  ✓ Configurable confidence thresholds per class
  ✓ Dashboard overlay with class distribution bar
  ✓ Recording / screenshot capability
  ✓ Engagement score display
"""

import argparse
import time
import sys
import cv2
import numpy as np
from pathlib import Path
from collections import deque, defaultdict
from datetime import datetime

try:
    from ultralytics import YOLO
except ImportError:
    print("✗ ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)


# ── Constants ──────────────────────────────────────────────────────────────

CLASS_NAMES = {0: "Engaged", 1: "Confused", 2: "Disengaged"}
CLASS_COLORS = {
    0: (0, 200, 0),     # Engaged → Green
    1: (0, 165, 255),   # Confused → Orange
    2: (0, 0, 220),     # Disengaged → Red
}
CLASS_EMOJIS = {0: "✓", 1: "?", 2: "✗"}


def get_args():
    parser = argparse.ArgumentParser(description="Live Student Emotion Detection")

    # Input
    parser.add_argument("--source", type=str, default="0",
                        help="Video source: 0 for webcam, path for video file, RTSP URL")
    parser.add_argument("--model", type=str, required=True,
                        help="Path to model (best.pt, .onnx, or .engine)")

    # Detection
    parser.add_argument("--conf", type=float, default=0.35,
                        help="Default confidence threshold")
    parser.add_argument("--conf-confused", type=float, default=0.25,
                        help="Lower threshold for Confused class (catch more)")
    parser.add_argument("--iou", type=float, default=0.45,
                        help="IoU threshold for NMS")
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Inference image size")

    # Performance
    parser.add_argument("--half", action="store_true",
                        help="Use FP16 half-precision inference")
    parser.add_argument("--skip-frames", type=int, default=1,
                        help="Process every Nth frame (1=all, 2=every other)")
    parser.add_argument("--max-det", type=int, default=30,
                        help="Max detections per frame")

    # Temporal smoothing
    parser.add_argument("--smooth-window", type=int, default=8,
                        help="Number of frames to average for temporal smoothing")

    # Alert system
    parser.add_argument("--alert-threshold", type=float, default=0.4,
                        help="Alert when confused+disengaged ratio exceeds this (0-1)")
    parser.add_argument("--alert-cooldown", type=int, default=10,
                        help="Seconds between alerts")

    # Display
    parser.add_argument("--show-dashboard", action="store_true", default=True,
                        help="Show engagement dashboard overlay")
    parser.add_argument("--show-fps", action="store_true", default=True,
                        help="Show FPS counter")
    parser.add_argument("--fullscreen", action="store_true",
                        help="Run in fullscreen")

    # Recording
    parser.add_argument("--record", action="store_true",
                        help="Record output video")
    parser.add_argument("--record-path", type=str, default=None,
                        help="Recording output path")

    return parser.parse_args()


class TemporalSmoother:
    """Smooth detections over multiple frames to reduce flickering."""

    def __init__(self, window_size: int = 8):
        self.window_size = window_size
        self.history = defaultdict(lambda: deque(maxlen=window_size))
        self.tracker_id = 0

    def update(self, detections: list) -> list:
        """
        Update with new detections and return smoothed results.
        Each detection: (bbox, class_id, confidence)
        Uses position-based matching for simple tracking.
        """
        if not detections:
            return []

        # Simple position-based matching using bbox centers
        smoothed = []
        current_centers = []

        for bbox, cls_id, conf in detections:
            cx = (bbox[0] + bbox[2]) / 2
            cy = (bbox[1] + bbox[3]) / 2
            current_centers.append((cx, cy, bbox, cls_id, conf))

        # Match with existing tracks or create new ones
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
                    if dist < best_dist and dist < 100:  # Max match distance
                        best_dist = dist
                        best_track = track_id

            if best_track is None:
                best_track = self.tracker_id
                self.tracker_id += 1

            used_tracks.add(best_track)
            self.history[best_track].append((cx, cy, cls_id, conf))

            # Smooth: majority vote for class, average confidence
            cls_votes = defaultdict(int)
            conf_sum = 0
            for _, _, c, co in self.history[best_track]:
                cls_votes[c] += 1
                conf_sum += co

            smooth_cls = max(cls_votes, key=cls_votes.get)
            smooth_conf = conf_sum / len(self.history[best_track])

            results.append((bbox, smooth_cls, smooth_conf, best_track))

        # Clean up old tracks
        active = set(used_tracks)
        to_remove = [k for k in self.history if k not in active]
        for k in to_remove:
            if len(self.history[k]) > 0:
                self.history[k].append(self.history[k][-1])  # Decay
                if len(self.history[k]) >= self.window_size:
                    del self.history[k]

        return results


class AlertSystem:
    """Monitors class distribution and triggers alerts."""

    def __init__(self, threshold: float = 0.4, cooldown: int = 10):
        self.threshold = threshold
        self.cooldown = cooldown
        self.last_alert_time = 0
        self.alert_active = False
        self.alert_message = ""

    def check(self, class_counts: dict) -> bool:
        """Check if alert should trigger. Returns True if alerting."""
        total = sum(class_counts.values())
        if total == 0:
            self.alert_active = False
            return False

        negative_ratio = (class_counts.get(1, 0) + class_counts.get(2, 0)) / total

        now = time.time()
        if negative_ratio >= self.threshold:
            if now - self.last_alert_time >= self.cooldown:
                self.last_alert_time = now
                self.alert_active = True

                confused_pct = class_counts.get(1, 0) / total * 100
                disengaged_pct = class_counts.get(2, 0) / total * 100
                self.alert_message = (
                    f"ATTENTION: {negative_ratio*100:.0f}% students not engaged! "
                    f"(Confused: {confused_pct:.0f}%, Disengaged: {disengaged_pct:.0f}%)"
                )
                return True
        else:
            self.alert_active = False

        return False


class EngagementDashboard:
    """Renders an overlay dashboard on the frame."""

    def __init__(self):
        self.engagement_history = deque(maxlen=120)  # ~4 seconds at 30fps

    def compute_engagement_score(self, class_counts: dict) -> float:
        """Compute 0-100 engagement score."""
        total = sum(class_counts.values())
        if total == 0:
            return 100.0

        engaged = class_counts.get(0, 0)
        confused = class_counts.get(1, 0)
        disengaged = class_counts.get(2, 0)

        # Weighted score: engaged=100, confused=40, disengaged=0
        score = (engaged * 100 + confused * 40 + disengaged * 0) / total
        return score

    def draw(self, frame: np.ndarray, class_counts: dict, fps: float,
             alert_system: AlertSystem) -> np.ndarray:
        """Draw dashboard overlay on frame."""
        h, w = frame.shape[:2]

        # Dashboard background (top-right)
        dash_w, dash_h = 280, 200
        dash_x = w - dash_w - 15
        dash_y = 15

        overlay = frame.copy()
        cv2.rectangle(overlay, (dash_x, dash_y), (dash_x + dash_w, dash_y + dash_h),
                      (30, 30, 30), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        # Border
        cv2.rectangle(frame, (dash_x, dash_y), (dash_x + dash_w, dash_y + dash_h),
                      (100, 100, 100), 1)

        # Title
        cv2.putText(frame, "ENGAGEMENT DASHBOARD", (dash_x + 15, dash_y + 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # Engagement score
        score = self.compute_engagement_score(class_counts)
        self.engagement_history.append(score)
        avg_score = sum(self.engagement_history) / len(self.engagement_history)

        score_color = (0, 200, 0) if avg_score >= 70 else (0, 165, 255) if avg_score >= 40 else (0, 0, 220)
        cv2.putText(frame, f"Score: {avg_score:.0f}/100", (dash_x + 15, dash_y + 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, score_color, 2)

        # Class distribution bars
        total = sum(class_counts.values()) or 1
        bar_y = dash_y + 75

        for cls_id in [0, 1, 2]:
            count = class_counts.get(cls_id, 0)
            pct = count / total
            color = CLASS_COLORS[cls_id]
            name = CLASS_NAMES[cls_id]

            # Label
            cv2.putText(frame, f"{name}: {count}", (dash_x + 15, bar_y + 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

            # Bar
            bar_x = dash_x + 135
            bar_width = 120
            bar_height = 14
            cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height),
                          (60, 60, 60), -1)
            cv2.rectangle(frame, (bar_x, bar_y),
                          (bar_x + int(bar_width * pct), bar_y + bar_height),
                          color, -1)
            cv2.putText(frame, f"{pct*100:.0f}%",
                        (bar_x + bar_width + 5, bar_y + 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)

            bar_y += 30

        # FPS
        cv2.putText(frame, f"FPS: {fps:.1f}", (dash_x + 15, dash_y + dash_h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1)

        # Alert banner
        if alert_system.alert_active:
            # Pulsing red banner at top
            pulse = abs(np.sin(time.time() * 3)) * 0.5 + 0.5
            alpha = 0.6 + pulse * 0.3

            banner_overlay = frame.copy()
            cv2.rectangle(banner_overlay, (0, 0), (w, 45), (0, 0, 180), -1)
            cv2.addWeighted(banner_overlay, alpha, frame, 1 - alpha, 0, frame)

            cv2.putText(frame, f"⚠ {alert_system.alert_message}",
                        (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        return frame


def draw_detections(frame: np.ndarray, results: list) -> dict:
    """Draw bounding boxes and labels. Returns class counts."""
    class_counts = defaultdict(int)

    for bbox, cls_id, conf, track_id in results:
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        color = CLASS_COLORS.get(cls_id, (200, 200, 200))
        name = CLASS_NAMES.get(cls_id, "Unknown")
        class_counts[cls_id] += 1

        # Bounding box
        thickness = 2 if cls_id == 0 else 3  # Thicker for Confused/Disengaged
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Label background
        label = f"{name} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
        cv2.putText(frame, label, (x1 + 5, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        # Emoji indicator at bottom of box
        emoji = CLASS_EMOJIS.get(cls_id, "")
        cv2.putText(frame, emoji, (x1 + 5, y2 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    return dict(class_counts)


def main():
    args = get_args()

    # ── Load Model ─────────────────────────────────────────────────────────
    print("=" * 60)
    print("  LIVE STUDENT EMOTION DETECTION")
    print("=" * 60)
    print(f"  Model:       {args.model}")
    print(f"  Source:       {args.source}")
    print(f"  Confidence:   {args.conf} (Confused: {args.conf_confused})")
    print(f"  Frame skip:   Every {args.skip_frames} frame(s)")
    print(f"  Smoothing:    {args.smooth_window} frame window")
    print(f"  Alert:        {args.alert_threshold*100:.0f}% threshold")
    print()

    model = YOLO(args.model)

    # ── Video Source ───────────────────────────────────────────────────────
    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"✗ Could not open video source: {args.source}")
        sys.exit(1)

    # Get video properties
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30

    print(f"  Video: {frame_w}x{frame_h} @ {source_fps:.0f}fps")

    # ── Recording Setup ───────────────────────────────────────────────────
    writer = None
    if args.record:
        record_path = args.record_path or f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(record_path, fourcc, source_fps / args.skip_frames,
                                 (frame_w, frame_h))
        print(f"  Recording to: {record_path}")

    # ── Initialize Components ─────────────────────────────────────────────
    smoother = TemporalSmoother(window_size=args.smooth_window)
    alert_system = AlertSystem(threshold=args.alert_threshold, cooldown=args.alert_cooldown)
    dashboard = EngagementDashboard()

    # ── Display Window ────────────────────────────────────────────────────
    window_name = "Study Hive - Student Emotion Detection"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    if args.fullscreen:
        cv2.setWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    else:
        cv2.resizeWindow(window_name, min(frame_w, 1280), min(frame_h, 720))

    # ── Main Loop ─────────────────────────────────────────────────────────
    print("\n  🎥 Live detection started!")
    print("  Controls: [Q] Quit | [S] Screenshot | [R] Toggle record | [D] Toggle dashboard | [F] Fullscreen")
    print()

    frame_count = 0
    fps_history = deque(maxlen=30)
    show_dashboard = args.show_dashboard
    last_results = []
    last_class_counts = {}

    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break

        frame_count += 1
        t_start = time.time()

        # ── Frame Skipping ─────────────────────────────────────────────
        if frame_count % args.skip_frames == 0:
            # Run inference
            results = model.predict(
                frame,
                imgsz=args.imgsz,
                conf=args.conf_confused,  # Use lower threshold, filter per-class later
                iou=args.iou,
                half=args.half,
                max_det=args.max_det,
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

                    # Per-class confidence filtering
                    if cls_id == 1:  # Confused: use lower threshold
                        min_conf = args.conf_confused
                    else:
                        min_conf = args.conf

                    if conf >= min_conf:
                        detections.append((bbox, cls_id, conf))

            # Temporal smoothing
            last_results = smoother.update(detections)

        # ── Draw Results ───────────────────────────────────────────────
        class_counts = draw_detections(frame, last_results)
        last_class_counts = class_counts

        # ── Alert Check ────────────────────────────────────────────────
        alert_system.check(class_counts)

        # ── FPS ────────────────────────────────────────────────────────
        t_end = time.time()
        fps = 1.0 / max(t_end - t_start, 0.001)
        fps_history.append(fps)
        avg_fps = sum(fps_history) / len(fps_history)

        # ── Dashboard ──────────────────────────────────────────────────
        if show_dashboard:
            frame = dashboard.draw(frame, class_counts, avg_fps, alert_system)
        elif args.show_fps:
            cv2.putText(frame, f"FPS: {avg_fps:.1f}", (15, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # ── Recording ─────────────────────────────────────────────────
        if writer:
            writer.write(frame)

        # ── Display ───────────────────────────────────────────────────
        cv2.imshow(window_name, frame)

        # ── Keyboard Controls ─────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q') or key == 27:  # Q or ESC
            break
        elif key == ord('s'):  # Screenshot
            screenshot_path = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(screenshot_path, frame)
            print(f"  📸 Screenshot saved: {screenshot_path}")
        elif key == ord('d'):  # Toggle dashboard
            show_dashboard = not show_dashboard
        elif key == ord('f'):  # Toggle fullscreen
            prop = cv2.getWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN)
            if prop == cv2.WINDOW_FULLSCREEN:
                cv2.setWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_NORMAL)
            else:
                cv2.setWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
        elif key == ord('r'):  # Toggle recording
            if writer:
                writer.release()
                writer = None
                print("  ⏹ Recording stopped")
            else:
                record_path = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(record_path, fourcc, source_fps / args.skip_frames,
                                         (frame_w, frame_h))
                print(f"  ⏺ Recording started: {record_path}")

    # ── Cleanup ────────────────────────────────────────────────────────────
    cap.release()
    if writer:
        writer.release()
    cv2.destroyAllWindows()

    print("\n✅ Live detection ended.")
    print(f"  Total frames processed: {frame_count}")


if __name__ == "__main__":
    main()
