/**
 * Teacher — Live Video Conference Room
 *
 * Flow:
 *   1. Teacher selects class + subject + gives the session a title.
 *   2. POST /video/meetings  → gets room_name + participant_token.
 *   3. LiveKitRoom component connects to the LiveKit server with the token.
 *   4. Teacher sees the full conference UI (camera, mic, participant grid).
 *   5. "End Class" → POST /video/meetings/{id}/end → room closes.
 *
 * Dependencies (run `pnpm install` after updating package.json):
 *   @livekit/components-react  @livekit/components-styles  livekit-client
 *
 * Environment variables (backend .env):
 *   LIVEKIT_URL          ws://localhost:7880
 *   LIVEKIT_API_KEY      devkey
 *   LIVEKIT_API_SECRET   secret
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Video,
  PhoneOff,
  Users,
  Loader2,
  AlertCircle,
  RadioTower,
  Zap,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import {
  videoStartMeeting,
  videoEndMeeting,
  type MeetingRead,
  type TeacherClassSubjects,
} from "@/app/utils/api";
import { teacherGetAssignmentClasses } from "@/app/utils/api";

// ── LiveKit imports ───────────────────────────────────────────────────────────
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

/** Inner room layout — must live inside <LiveKitRoom> so hooks resolve. */
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

// ─────────────────────────────────────────────────────────────────────────────

type SetupState = "setup" | "connecting" | "live" | "ended" | "error";

export default function TeacherVideoConference() {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState<TeacherClassSubjects[]>([]);
  const [selectedClassId, setSelectedClassId]   = useState<number | "">("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");
  const [sessionTitle, setSessionTitle]           = useState("");
  const [state, setState]   = useState<SetupState>("setup");
  const [meeting, setMeeting] = useState<MeetingRead | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Derive subjects for the selected class
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const subjects       = selectedClass?.subjects ?? [];

  // ── Load teacher's classes, then autofill from URL params ─────────────────
  useEffect(() => {
    teacherGetAssignmentClasses()
      .then((data) => {
        setClasses(data);
        const classId = Number(searchParams.get("classId")) || "";
        const subjectId = Number(searchParams.get("subjectId")) || "";
        if (classId) setSelectedClassId(classId);
        if (subjectId) setSelectedSubjectId(subjectId);
      })
      .catch(() => setError("Failed to load classes"))
      .finally(() => setLoadingClasses(false));
  }, []);

  // Auto-populate title when class + subject are picked
  useEffect(() => {
    if (selectedClass && selectedSubjectId) {
      const subj = subjects.find((s) => s.id === selectedSubjectId);
      if (subj) setSessionTitle(`${selectedClass.name} — ${subj.name}`);
    }
  }, [selectedClassId, selectedSubjectId]);

  // ── Start meeting ─────────────────────────────────────────────────────────
  async function handleStartMeeting() {
    if (!selectedClassId || !selectedSubjectId || !sessionTitle.trim()) return;
    setState("connecting");
    setError(null);
    try {
      const mtg = await videoStartMeeting({
        class_id:   selectedClassId as number,
        subject_id: selectedSubjectId as number,
        title:      sessionTitle.trim(),
      });
      setMeeting(mtg);
      setState("live");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to start meeting");
      setState("error");
    }
  }

  // ── End meeting ───────────────────────────────────────────────────────────
  async function handleEndMeeting() {
    if (!meeting) return;
    try {
      await videoEndMeeting(meeting.id);
    } catch {
      // ignore
    }
    setState("ended");
    setMeeting(null);
  }

  // ── Decide which LiveKit URL to use ───────────────────────────────────────
  // The backend returns the HTTP URL; LiveKit SDK needs the WS URL.
  const wsUrl = meeting?.livekit_url
    ? meeting.livekit_url.replace("http://", "ws://").replace("https://", "wss://")
    : "ws://localhost:7880";
  const token = meeting?.participant_token ?? "";
  const isStubToken = token.startsWith("stub:");

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">

        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <motion.div
          whileHover={{ scale: 1.006 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-700 to-indigo-800 rounded-2xl p-8 text-white shadow-lg shadow-purple-400/30 cursor-default"
        >
          <div className="relative z-10 flex items-center gap-5">
            <motion.div
              whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 ring-2 ring-white/25 shadow-inner"
            >
              <RadioTower size={30} className="text-white drop-shadow" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">Start a Live Class</h1>
              <p className="text-purple-100 mt-1 text-sm">
                Launch a real-time video session for your students. Recordings are processed automatically.
              </p>
            </div>
          </div>
          {/* Animated orbs */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.06, 0.12, 0.06] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-10 -top-10 w-52 h-52 bg-white rounded-full pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.18, 1], opacity: [0.05, 0.09, 0.05] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
            className="absolute right-16 -bottom-16 w-72 h-72 bg-purple-300 rounded-full pointer-events-none"
          />
          {/* Shimmer sweep */}
          <motion.div
            animate={{ x: ["-110%", "220%"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.5, repeatDelay: 4 }}
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none -skew-x-12"
          />
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── SETUP FORM ─────────────────────────────────────────────── */}
          {(state === "setup" || state === "error") && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-6"
            >
              {/* Left: Form (3 cols) */}
              <div className="lg:col-span-3 space-y-4">
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3"
                  >
                    <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </motion.div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Video size={16} className="text-purple-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Session Details</h2>
                  </div>

                  <div className="p-6 space-y-5">
                    {loadingClasses ? (
                      <div className="flex items-center gap-3 py-8 justify-center">
                        <Loader2 size={20} className="animate-spin text-purple-500" />
                        <span className="text-sm text-gray-500 font-medium">Loading your classes…</span>
                      </div>
                    ) : (
                      <>
                        {/* Step 1 — Class */}
                        <div>
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                              1
                            </span>
                            Select Class
                          </label>
                          <select
                            value={selectedClassId}
                            onChange={(e) => {
                              setSelectedClassId(Number(e.target.value) || "");
                              setSelectedSubjectId("");
                            }}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-colors"
                          >
                            <option value="">Select a class…</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Step 2 — Subject */}
                        <div>
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 transition-colors ${selectedClassId ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"}`}>
                              2
                            </span>
                            Select Subject
                          </label>
                          <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(Number(e.target.value) || "")}
                            disabled={!selectedClassId}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <option value="">Select a subject…</option>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Step 3 — Session Title */}
                        <div>
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 transition-colors ${selectedSubjectId ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"}`}>
                              3
                            </span>
                            Session Title
                          </label>
                          <input
                            type="text"
                            value={sessionTitle}
                            onChange={(e) => setSessionTitle(e.target.value)}
                            placeholder="e.g. Grade 10-A — Quadratic Equations"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-colors"
                          />
                          <AnimatePresence>
                            {sessionTitle && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="mt-2 text-xs text-purple-600 flex items-center gap-1"
                              >
                                <CheckCircle size={12} />
                                Ready: "{sessionTitle}"
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Launch button */}
                        <motion.button
                          whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -8px rgba(147, 51, 234, 0.55)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleStartMeeting}
                          disabled={!selectedClassId || !selectedSubjectId || !sessionTitle.trim()}
                          className="relative w-full px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2.5 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <RadioTower size={18} />
                          Launch Live Class
                          {/* Shimmer */}
                          <motion.span
                            animate={{ x: ["-100%", "250%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 2.5 }}
                            className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none"
                          />
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Info panel (2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                    <h3 className="font-semibold text-gray-900 text-sm">What happens when you go live</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    {([
                      { icon: Users,   title: "Students are notified",  desc: "Students in this class see a live banner on their timetable with a direct Join button." },
                      { icon: Video,   title: "Auto-recording",          desc: "The session is recorded automatically. No extra setup needed." },
                      { icon: Zap,     title: "AI post-processing",      desc: "After class, AI generates transcripts, emotion analytics, and teaching insights." },
                      { icon: Sparkles,title: "Attendance linking",      desc: "Open a session from your Timetable to mark attendance for the same class simultaneously." },
                    ] as const).map(({ icon: Icon, title, desc }) => (
                      <div key={title} className="flex gap-3">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={15} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ── CONNECTING ─────────────────────────────────────────────── */}
          {state === "connecting" && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-28 gap-5"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                  <Loader2 size={36} className="animate-spin text-purple-600" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-300 animate-ping opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-gray-800 font-semibold text-lg">Setting up your classroom…</p>
                <p className="text-gray-400 text-sm mt-1">This usually takes just a moment</p>
              </div>
            </motion.div>
          )}

          {/* ── LIVE ROOM ──────────────────────────────────────────────── */}
          {state === "live" && meeting && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Room header bar */}
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-semibold text-gray-900">{meeting.title}</span>
                  <span className="text-xs text-gray-500">
                    {meeting.class_name} · {meeting.subject_name}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEndMeeting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  <PhoneOff size={16} />
                  End Class
                </motion.button>
              </div>

              {/* Stub-token warning */}
              {isStubToken && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">LiveKit not connected</p>
                    <p>
                      Install the LiveKit packages and start the server to see the live video room.
                      Meeting ID: {meeting.id} — will appear in Recordings once ended.
                    </p>
                    <p className="mt-1 font-mono text-xs bg-amber-100 px-2 py-1 rounded">pnpm install   # frontend</p>
                    <p className="mt-1 font-mono text-xs bg-amber-100 px-2 py-1 rounded">pip install livekit-api   # backend</p>
                    <p className="mt-1 font-mono text-xs bg-amber-100 px-2 py-1 rounded">docker run -d -p 7880:7880 livekit/livekit-server --dev</p>
                  </div>
                </div>
              )}

              {/* LiveKit Room */}
              {!isStubToken && (
                <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: "70vh" }}>
                  <LiveKitRoom
                    serverUrl={wsUrl}
                    token={token}
                    connect={true}
                    audio={true}
                    video={true}
                    data-lk-theme="default"
                    style={{ height: "100%" }}
                  >
                    <ConferenceRoomLayout />
                    <RoomAudioRenderer />
                  </LiveKitRoom>
                </div>
              )}

              {/* Share link helper */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700">
                <p className="font-medium mb-1">Share this meeting with students</p>
                <p className="text-xs">
                  Students can join via their Timetable page when the session is marked ONLINE.
                  Meeting ID: <span className="font-mono font-semibold">{meeting.id}</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* ── ENDED ──────────────────────────────────────────────────── */}
          {state === "ended" && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Class Ended</h2>
              <p className="text-gray-500 text-sm mb-6">
                The session has been saved. AI is processing the recording — transcription, emotion
                analysis, and teaching insights will appear shortly in Recordings.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setState("setup");
                  setError(null);
                  setSelectedClassId("");
                  setSelectedSubjectId("");
                  setSessionTitle("");
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-md"
              >
                Start Another Class
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
