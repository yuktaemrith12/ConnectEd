/**
 * Student — Live Class Room
 *
 * Accessed via: /student/live/:meetingId
 * Student gets a participant token and joins the LiveKit room.
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Loader2, AlertCircle, PhoneOff, CheckCircle, WifiOff } from "lucide-react";
import { videoJoinMeeting, type MeetingRead } from "@/app/utils/api";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

function ConferenceRoomLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <GridLayout tracks={tracks} style={{ flex: 1, minHeight: 0 }}>
        <ParticipantTile />
      </GridLayout>
      <ControlBar variation="minimal" />
    </div>
  );
}

export default function StudentLiveClass() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting]     = useState<MeetingRead | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [roomEnded, setRoomEnded] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  // Track whether we ever successfully connected — prevents a connection
  // failure from showing the misleading "Class has ended" screen.
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (!meetingId) return;
    videoJoinMeeting(parseInt(meetingId, 10))
      .then(setMeeting)
      .catch((e) => {
        const msg = e?.response?.data?.detail ?? "Failed to join meeting";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [meetingId]);

  const wsUrl = meeting?.livekit_url
    ? meeting.livekit_url.replace("http://", "ws://").replace("https://", "wss://")
    : "ws://localhost:7880";
  const token = meeting?.participant_token ?? "";
  const isStubToken = token.startsWith("stub:");

  // Class ended (room closed by teacher after we were connected)
  if (roomEnded) {
    return (
      <DashboardLayout role="student" skipConsent>
        <div className="max-w-lg mx-auto py-24 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-4" />
          <p className="text-gray-800 font-semibold text-xl mb-2">Class has ended</p>
          <p className="text-gray-500 text-sm mb-6">
            The teacher has ended this session. Check Recordings for the playback.
          </p>
          <button
            onClick={() => navigate("/student/timetable")}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
          >
            Back to Timetable
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Connection error (server unreachable)
  if (connError) {
    return (
      <DashboardLayout role="student" skipConsent>
        <div className="max-w-lg mx-auto py-24 text-center">
          <WifiOff size={40} className="text-amber-400 mx-auto mb-4" />
          <p className="text-gray-800 font-semibold text-xl mb-2">Could not connect</p>
          <p className="text-gray-500 text-sm mb-6">{connError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setConnError(null); wasConnectedRef.current = false; }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/student/timetable")}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
            >
              Back to Timetable
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Loading
  if (loading) {
    return (
      <DashboardLayout role="student" skipConsent>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={40} className="animate-spin text-blue-500" />
          <p className="text-gray-500 font-medium">Joining class…</p>
        </div>
      </DashboardLayout>
    );
  }

  // Error / not found
  if (error || !meeting) {
    return (
      <DashboardLayout role="student" skipConsent>
        <div className="max-w-lg mx-auto py-24 text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold text-lg mb-2">
            {error || "Meeting not found"}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            The class may have ended or the link is no longer valid.
          </p>
          <button
            onClick={() => navigate("/student/timetable")}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Timetable
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Live Room
  return (
    <DashboardLayout role="student" skipConsent>
      <div className="space-y-4">
        {/* Header bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="font-semibold text-gray-900">{meeting.title}</span>
            <span className="text-xs text-gray-500">
              {meeting.class_name} · {meeting.subject_name}
            </span>
          </div>
          <button
            onClick={() => navigate("/student/timetable")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-colors"
          >
            <PhoneOff size={16} />
            Leave Class
          </button>
        </div>

        {/* Stub token warning */}
        {isStubToken && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
            <p className="font-semibold mb-1">Video not available</p>
            <p>The LiveKit video server is not running. Contact your administrator.</p>
          </div>
        )}

        {/* LiveKit Room */}
        {!isStubToken && (
          <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: "75vh" }}>
            <LiveKitRoom
              serverUrl={wsUrl}
              token={token}
              connect={true}
              audio={true}
              video={true}
              data-lk-theme="default"
              style={{ height: "100%" }}
              onConnected={() => { wasConnectedRef.current = true; }}
              onDisconnected={() => {
                if (wasConnectedRef.current) {
                  setRoomEnded(true);
                } else {
                  setConnError("Could not reach the video server. Make sure the LiveKit server is running at " + wsUrl);
                }
              }}
            >
              <ConferenceRoomLayout />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
