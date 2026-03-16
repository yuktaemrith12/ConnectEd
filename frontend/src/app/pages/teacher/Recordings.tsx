import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Search,
  Video,
  Calendar,
  Clock,
  Info,
  X,
  FileText,
  BarChart3,
  Loader2,
  Plus,
  Brain,
  TrendingUp,
} from "lucide-react";
import {
  videoListMeetings,
  videoGetAnalytics,
  videoTriggerProcessing,
  type MeetingRead,
  type MeetingAnalyticsRead,
} from "@/app/utils/api";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function TeacherRecordings() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<MeetingRead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRead | null>(null);
  const [analytics, setAnalytics]   = useState<MeetingAnalyticsRead | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    videoListMeetings()
      .then(setMeetings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // When a meeting is selected, load its analytics
  useEffect(() => {
    if (!selectedMeeting) { setAnalytics(null); return; }
    setAnalyticsLoading(true);
    videoGetAnalytics(selectedMeeting.id)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, [selectedMeeting?.id]);

  const filtered = meetings.filter((m) => {
    const matchesSearch =
      searchQuery === "" ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.class_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.subject_name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const report = analytics?.report_json;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Session Recordings</h1>
            <p className="text-gray-600">
              Recordings from your live classes with AI teaching analytics.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/teacher/video-conference")}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-shadow"
          >
            <Plus size={16} />
            Start Live Class
          </motion.button>
        </div>

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3"
        >
          <div className="p-1.5 bg-purple-100 rounded-lg flex-shrink-0">
            <Info size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-purple-900">
              Recordings are processed automatically after each live class ends.
            </p>
            <p className="text-xs text-purple-700 mt-1">
              AI transcription, emotion analysis, and teaching insights are generated in the background.
            </p>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, class, or subject…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          {filtered.length} meeting{filtered.length !== 1 ? "s" : ""} found
        </p>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={36} className="animate-spin text-purple-500" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((meeting, index) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(139,92,246,0.2)" }}
                className="bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative bg-gradient-to-br from-purple-900 to-purple-700 aspect-video flex items-center justify-center">
                  <Video size={40} className="text-purple-300/60" />

                  {/* Status badge */}
                  <div className={`absolute top-3 left-3 px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                    meeting.status === "active"
                      ? "bg-red-500 text-white"
                      : meeting.status === "completed"
                      ? "bg-green-500/90 text-white"
                      : "bg-gray-500/80 text-white"
                  }`}>
                    {meeting.status === "active" && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    )}
                    {meeting.status === "active" ? "LIVE" : meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                  </div>

                  {/* Duration badge */}
                  {meeting.recordings[0] && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
                      {formatDuration(meeting.recordings[0].duration_s)}
                    </div>
                  )}

                  {/* Analytics badge */}
                  {meeting.recordings[0]?.has_analytics && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-purple-500/90 text-white text-xs rounded">
                      <Brain size={11} />
                      AI Ready
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{meeting.title}</h3>
                    <p className="text-xs text-gray-500">{meeting.class_name} · {meeting.subject_name}</p>
                  </div>

                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      <span>
                        {meeting.started_at
                          ? new Date(meeting.started_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })
                          : "—"}
                      </span>
                      {meeting.started_at && (
                        <>
                          <span>·</span>
                          <Clock size={12} />
                          <span>
                            {new Date(meeting.started_at).toLocaleTimeString("en-US", {
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText size={12} />
                      <span>{meeting.recording_count} recording{meeting.recording_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-1 space-y-2">
                    {meeting.status === "active" ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate("/teacher/video-conference")}
                        className="w-full px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <Video size={14} />
                        Rejoin Live Class
                      </motion.button>
                    ) : (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate(`/teacher/recording/${meeting.id}`)}
                          className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                        >
                          <Play size={14} />
                          View Recording & Analytics
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedMeeting(meeting)}
                          className="w-full px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors"
                        >
                          <BarChart3 size={14} />
                          Quick Analytics
                        </motion.button>
                        {/* Show "Process Now" when a recording exists but analytics aren't ready */}
                        {meeting.recording_count > 0 && !meeting.recordings[0]?.has_analytics && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={processingId === meeting.id}
                            onClick={async () => {
                              setProcessingId(meeting.id);
                              try {
                                await videoTriggerProcessing(meeting.id);
                              } finally {
                                setProcessingId(null);
                              }
                            }}
                            className="w-full px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {processingId === meeting.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Brain size={14} />
                            )}
                            {processingId === meeting.id ? "Queued…" : "Process Now"}
                          </motion.button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-xl border border-gray-200 p-16 text-center"
          >
            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video size={32} className="text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No recordings yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
              Start a live class and the recording will appear here once the session ends.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/teacher/video-conference")}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-semibold text-sm"
            >
              Start Your First Live Class
            </motion.button>
          </motion.div>
        )}

        {/* ── Quick Analytics Modal ───────────────────────────────────── */}
        <AnimatePresence>
          {selectedMeeting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
              onClick={() => setSelectedMeeting(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              >
                {/* Modal header */}
                <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between bg-gradient-to-r from-purple-50 to-white">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedMeeting.title}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {selectedMeeting.class_name} · {selectedMeeting.subject_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={28} className="animate-spin text-purple-500" />
                    </div>
                  ) : report ? (
                    <>
                      {/* Engagement score */}
                      {report.engagement_score != null && (
                        <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
                          <TrendingUp size={20} className="text-purple-600" />
                          <div>
                            <p className="text-xs text-purple-600 font-medium">Engagement Score</p>
                            <p className="text-2xl font-bold text-purple-900">{report.engagement_score}/100</p>
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      {report.summary && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Brain size={15} className="text-purple-500" /> AI Summary
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
                        </div>
                      )}

                      {/* AI Suggestions */}
                      {report.ai_suggestions && report.ai_suggestions.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Teaching Suggestions</p>
                          <ul className="space-y-1.5">
                            {report.ai_suggestions.map((tip, i) => (
                              <li key={i} className="text-sm text-purple-800 bg-purple-50 rounded-lg px-3 py-2">
                                {i + 1}. {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Emotion breakdown */}
                      {report.emotion_summary && Object.keys(report.emotion_summary).length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Emotion Breakdown</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(report.emotion_summary).map(([emotion, pct]) => (
                              <div key={emotion} className="bg-gray-50 rounded-lg p-2.5">
                                <p className="text-xs font-medium text-gray-600 capitalize">{emotion}</p>
                                <p className="text-lg font-bold text-gray-900">{pct}%</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Brain size={36} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        AI analytics are not yet available for this meeting.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Processing runs in the background after the class ends.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/teacher/recording/${selectedMeeting.id}`)}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <Play size={15} />
                    Full Recording Player
                  </motion.button>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
