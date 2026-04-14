"""
LiveKit service — token generation and room lifecycle management.
Prefix (set in main.py): /api/v1/video

Requires: pip install livekit-api
Docker: docker run -d -p 7880:7880 livekit/livekit-server --dev
"""

import logging
import os
import uuid
from datetime import timedelta
from typing import Optional

logger = logging.getLogger(__name__)

from app.core.config import settings as _settings

LIVEKIT_URL        = _settings.LIVEKIT_URL
LIVEKIT_API_KEY    = _settings.LIVEKIT_API_KEY
LIVEKIT_API_SECRET = _settings.LIVEKIT_API_SECRET


def _try_import_livekit_api():
    """Return the livekit.api module or None if not installed."""
    try:
        import livekit.api as lk_api
        return lk_api
    except ImportError:
        logger.warning(
            "livekit-api not installed. "
            "Run: pip install livekit-api  "
            "Tokens will be stub values until installed."
        )
        return None


def generate_room_name(class_id: int, subject_id: int) -> str:
    """Generate a unique room name for a meeting."""
    short = uuid.uuid4().hex[:8]
    return f"class-{class_id}-subj-{subject_id}-{short}"


def generate_participant_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    is_teacher: bool = False,
) -> str:
    """
    Generate a LiveKit JWT access token for a participant.

    Returns a stub token prefixed with 'stub:' when livekit-api is not installed.
    The frontend VideoConference page treats stub tokens as 'LiveKit not configured'.
    """
    lk = _try_import_livekit_api()
    if lk is None:
        return f"stub:{participant_identity}:{room_name}"

    try:
        token = lk.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity(participant_identity)
        token.with_name(participant_name)
        token.with_grants(
            lk.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,          # all participants can publish
                can_subscribe=True,
                can_publish_data=True,
                room_admin=is_teacher,     # teacher can kick participants
            )
        )
        token.with_ttl(timedelta(hours=3))
        return token.to_jwt()
    except Exception as exc:
        logger.error("Token generation failed: %s", exc)
        return f"stub:{participant_identity}:{room_name}"


def delete_room(room_name: str) -> bool:
    """
    Delete a LiveKit room and disconnect all participants.
    Called when a teacher ends a meeting.
    """
    lk = _try_import_livekit_api()
    if lk is None:
        return False
    try:
        import asyncio

        async def _delete() -> None:
            svc = lk.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            await svc.room.delete_room(lk.DeleteRoomRequest(room=room_name))
            await svc.aclose()

        asyncio.run(_delete())
        return True
    except Exception as exc:
        logger.error("Failed to delete LiveKit room %s: %s", room_name, exc)
        return False


def is_livekit_configured() -> bool:
    """Returns True when livekit-api is installed and tokens are real."""
    return _try_import_livekit_api() is not None


def start_egress_recording(room_name: str) -> Optional[str]:
    """
    Start a composite egress (MP4 recording) for a LiveKit room.

    Requires:
      - LiveKit Egress service running alongside the LiveKit server.
      - LIVEKIT_RECORDING_DIR env var pointing to a writable directory
        (defaults to /tmp/recordings).
      - pip install livekit-api livekit-protocol   (for the protobuf types)

    Returns the egress ID string on success, None on any failure.
    """
    lk = _try_import_livekit_api()
    if lk is None:
        return None

    try:
        from livekit.protocol.egress import (  # type: ignore[import]
            RoomCompositeEgressRequest,
            EncodedFileOutput,
            EncodedFileType,
        )
    except ImportError:
        logger.warning(
            "[LiveKitService] livekit.protocol not available — "
            "egress recording disabled. Run: pip install livekit-protocol"
        )
        return None

    # Always use the container-internal path — the egress service runs on Linux
    # and the volume is mounted at /tmp/recordings regardless of the host OS.
    # The host-side path (LIVEKIT_RECORDING_DIR) is only used when reading the
    # file back after the webhook fires (see _handle_egress_ended in video.py).
    egress_filepath = f"/tmp/recordings/{room_name}.mp4"

    # Ensure the host recordings directory exists (backend reads from here)
    host_dir = _settings.LIVEKIT_RECORDING_DIR or "/tmp/recordings"
    os.makedirs(host_dir, exist_ok=True)

    logger.info("[LiveKitService] start_egress_recording — room=%s  path=%s", room_name, egress_filepath)

    try:
        import asyncio

        async def _start() -> str:
            svc = lk.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            filepath = egress_filepath
            req = RoomCompositeEgressRequest(
                room_name=room_name,
                layout="grid",
                file_outputs=[
                    EncodedFileOutput(
                        file_type=EncodedFileType.MP4,
                        filepath=filepath,
                    )
                ],
            )
            resp = await svc.egress.start_room_composite_egress(req)
            await svc.aclose()
            return resp.egress_id

        egress_id: str = asyncio.run(_start())
        logger.info("[LiveKitService] Egress %s started for room %s", egress_id, room_name)
        return egress_id
    except Exception as exc:
        logger.error("[LiveKitService] Failed to start egress for room %s: %s", room_name, exc)
        return None


async def start_egress_recording_async(room_name: str) -> Optional[str]:
    """
    Async version of start_egress_recording for use inside async FastAPI handlers.
    Uses await instead of asyncio.run() so it works inside a running event loop.

    Before starting egress, checks that at least one participant is present in
    the room — starting egress against an empty room is the most common cause
    of EGRESS_ABORTED.
    """
    lk = _try_import_livekit_api()
    if lk is None:
        return None

    try:
        from livekit.protocol.egress import (  # type: ignore[import]
            RoomCompositeEgressRequest,
            EncodedFileOutput,
            EncodedFileType,
        )
    except ImportError:
        logger.warning("[LiveKitService] livekit.protocol not available — egress disabled.")
        return None

    egress_filepath = f"/tmp/recordings/{room_name}.mp4"
    host_dir = _settings.LIVEKIT_RECORDING_DIR or "/tmp/recordings"
    os.makedirs(host_dir, exist_ok=True)

    logger.info(
        "[LiveKitService] start_egress_recording_async — room=%s  path=%s",
        room_name, egress_filepath,
    )

    try:
        svc = lk.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

        # ── Participant guard ─────────────────────────────────────────────
        # Starting egress before any participant is publishing media causes
        # EGRESS_ABORTED.  Check the participant list first; if nobody is
        # there yet, bail out — the participant_joined webhook will retry.
        try:
            from livekit.protocol.room import ListParticipantsRequest  # type: ignore[import]
            part_resp = await svc.room.list_participants(
                ListParticipantsRequest(room=room_name)
            )
            participant_count = len(part_resp.participants)
            logger.info(
                "[LiveKitService] Room %s has %d participant(s) before egress start",
                room_name, participant_count,
            )
            if participant_count == 0:
                logger.warning(
                    "[LiveKitService] No participants yet in room %s — "
                    "deferring egress to participant_joined event",
                    room_name,
                )
                await svc.aclose()
                return None
        except Exception as check_exc:
            # Participant check is best-effort; proceed even if it fails
            logger.debug(
                "[LiveKitService] Could not check participants for room %s: %s — proceeding",
                room_name, check_exc,
            )

        # ── Start egress ──────────────────────────────────────────────────
        req = RoomCompositeEgressRequest(
            room_name=room_name,
            layout="grid",
            file_outputs=[
                EncodedFileOutput(
                    file_type=EncodedFileType.MP4,
                    filepath=egress_filepath,
                )
            ],
        )
        resp = await svc.egress.start_room_composite_egress(req)
        await svc.aclose()

        egress_id     = resp.egress_id
        egress_status = str(getattr(resp, "status", "unknown"))
        logger.info(
            "[LiveKitService] Egress %s started (status=%s) for room %s",
            egress_id, egress_status, room_name,
        )
        return egress_id
    except Exception as exc:
        logger.error(
            "[LiveKitService] Failed to start egress for room %s: %s",
            room_name, exc, exc_info=True,
        )
        return None
