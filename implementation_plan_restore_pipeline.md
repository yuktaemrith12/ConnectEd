# Restore Live Emotion Detection & Recording Pipeline

This plan outlines the steps to restore the real-time emotion detection pipeline (Stages 1-6) and fix the LiveKit recording pipeline (Egress) which is currently failing with `EGRESS_ABORTED`.

## User Review Required

> [!IMPORTANT]
> **Inference Server Context**: The live emotion detection relies on a Flask-SocketIO server (`app.py`) located in `emotion_detection_model/research/webapp/`. This server runs on port 5000. It must be running for real-time engagement monitoring to work.
> 
> **Camera Permissions**: The frontend will now capture webcam frames at 10-15 FPS and send them to the local inference server. This may increase CPU/GPU usage on the teacher's machine.

## Proposed Changes

---

### [Component] Infrastructure & Startup

#### [MODIFY] [start_app.bat](file:///C:/Users/yukta/ConnectEd/start_app.bat)
- Add a new startup task for the Emotion Inference Server.
- Ensure it uses the existing Python `venv`.
- Command: `start "Emotion Inference Server" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && cd ../emotion_detection_model/research/webapp && python app.py"`

---

### [Component] Frontend Integration

#### [NEW] [InClassEngagement.tsx](file:///C:/Users/yukta/ConnectEd/frontend/src/app/components/video/InClassEngagement.tsx)
- Create a new component to encapsulate the Socket.IO logic and the "Engagement Dashboard" UI.
- Features: 
    - Real-time gauge for Engagement Score.
    - Mini-bars for Engaged/Confused/Disengaged distribution.
    - Animated "Alert" notifications when confusion peaks.
    - High-quality glassmorphism design.

#### [MODIFY] [VideoConference.tsx](file:///C:/Users/yukta/ConnectEd/frontend/src/app/pages/teacher/VideoConference.tsx)
- Integrate `InClassEngagement` component.
- Add a hidden `canvas` for frame capturing.
- Implement the `captureLoop`:
    - Use `requestAnimationFrame` for smooth capture.
    - Capture frames from the local video element (from LiveKit).
    - Convert to base64 and emit via Socket.IO.
- Display the engagement dashboard as a sliding sidebar or floating panel.

---

### [Component] Backend & Egress Stability

#### [MODIFY] [livekit_service.py](file:///C:/Users/yukta/ConnectEd/backend/app/services/video/livekit_service.py)
- Update `start_egress_recording_async` to check if at least one participant is publishing before starting egress. Starting egress in an empty room or before the first frame is published often causes `EGRESS_ABORTED`.
- Add better error handling and logging for the egress response.

#### [MODIFY] [video.py](file:///C:/Users/yukta/ConnectEd/backend/app/api/video.py)
- Improve logging in `_handle_egress_ended` to capture `error` and `errorCode` from the `egressInfo` body, which will help diagnose why Egress is aborting.
- Add a small delay in `_handle_room_started` before starting egress to ensure the room is fully initialized on the server side.

## Open Questions

> [!NOTE]
> **Port Conflicts**: Port 5000 is used by the inference server. If you have other services (like macOS AirPlay Receiver) running on port 5000, please let me know so I can switch it to 5001.

## Verification Plan

### Automated/Tool-based Tests
- Use the `browser_subagent` to verify the frontend UI components are rendered.
- Check backend logs for `[EmotionService]` and `[VideoWebhook]` success messages.

### Manual Verification
1. Launch app via `start_app.bat`.
2. Verify "Emotion Inference Server" window opens and logs "Model loaded successfully".
3. Start a meeting as a teacher.
4. Verify the "In-Class Engagement" panel appears and starts showing data (Engagement Score > 0).
5. End the class and verify the `egress_ended` webhook fires with status `EGRESS_COMPLETE`.
6. Confirm the recording appears in the `Recordings` page with AI analytics.
