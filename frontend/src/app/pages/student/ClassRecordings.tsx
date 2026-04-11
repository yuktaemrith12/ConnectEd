import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Video,
  Play,
  Clock,
  Calendar,
  User,
  Search,
  X,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  videoGetCompletedMeetings,
  videoGetTranscript,
  type MeetingRead,
} from "@/app/utils/api";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getVideoUrl(meeting: MeetingRead): string | null {
  const rec = meeting.recordings?.[0];
  if (!rec?.storage_path) return null;
  const filename = rec.storage_path.replace(/\\/g, "/").split("/").pop();
  return `http://127.0.0.1:8000/uploads/recordings/${filename}`;
}

export default function StudentClassRecordings() {
  const [meetings, setMeetings] = useState<MeetingRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRead | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  useEffect(() => {
    videoGetCompletedMeetings()
      .then(setMeetings)
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false));
  }, []);

  const openMeeting = (meeting: MeetingRead) => {
    setSelectedMeeting(meeting);
    setTranscript(null);
    setTranscriptExpanded(false);
    setTranscriptLoading(true);
    videoGetTranscript(meeting.id)
      .then((r) => setTranscript(r.transcript))
      .catch(() => setTranscript(null))
      .finally(() => setTranscriptLoading(false));
  };

  const closeModal = () => {
    setSelectedMeeting(null);
    setTranscript(null);
  };

  const filtered = meetings.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.title || "").toLowerCase().includes(q) ||
      (m.subject_name || "").toLowerCase().includes(q) ||
      (m.teacher_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Class Recordings</h1>
          <p className="text-gray-600">Watch recorded classes and read the session transcript</p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by subject, teacher or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={24} />
            Loading recordings…
          </div>
        )}

        {/* Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((meeting, index) => {
              const hasRecording = (meeting.recording_count ?? 0) > 0;
              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div
                    className={`relative aspect-video bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center ${hasRecording ? "cursor-pointer" : ""}`}
                    onClick={() => hasRecording && openMeeting(meeting)}
                  >
                    {hasRecording ? (
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Play size={28} className="text-white ml-1" />
                      </motion.div>
                    ) : (
                      <div className="text-center text-blue-400 px-4">
                        <Video size={32} className="mx-auto mb-1" />
                        <p className="text-xs font-medium">No recording yet</p>
                      </div>
                    )}
                    {meeting.recordings?.[0]?.duration_s && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded-md font-medium">
                        {formatDuration(meeting.recordings[0].duration_s)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 mb-1 text-lg leading-tight">
                      {meeting.title || meeting.subject_name || "Class Recording"}
                    </h3>
                    <p className="text-sm text-blue-600 font-medium mb-3">
                      {meeting.subject_name}
                      {meeting.class_name && ` · ${meeting.class_name}`}
                    </p>
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <User size={13} />
                        <span>{meeting.teacher_name || "–"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar size={13} />
                        <span>
                          {meeting.started_at
                            ? new Date(meeting.started_at).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })
                            : "–"}
                        </span>
                      </div>
                    </div>
                    {hasRecording && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openMeeting(meeting)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                      >
                        <Play size={16} />
                        Watch Recording
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl p-12 text-center border border-gray-100"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No recordings yet</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery
                ? "No recordings match your search."
                : "Your teacher's completed classes will appear here once recordings are processed."}
            </p>
          </motion.div>
        )}
      </div>

      {/* Video + Transcript Modal */}
      <AnimatePresence>
        {selectedMeeting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              {/* Video player */}
              <div className="relative aspect-video bg-gray-900 rounded-t-2xl overflow-hidden">
                {getVideoUrl(selectedMeeting) ? (
                  <video
                    src={getVideoUrl(selectedMeeting)!}
                    controls
                    autoPlay
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Video size={48} />
                  </div>
                )}
                <button
                  onClick={closeModal}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Meta row */}
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedMeeting.title || selectedMeeting.subject_name}
                </h2>
                <p className="text-blue-600 font-medium text-sm mt-0.5">
                  {selectedMeeting.subject_name}
                  {selectedMeeting.class_name && ` · ${selectedMeeting.class_name}`}
                </p>
                <div className="flex items-center gap-5 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <User size={13} /> {selectedMeeting.teacher_name || "–"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    {selectedMeeting.started_at
                      ? new Date(selectedMeeting.started_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })
                      : "–"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} />
                    {formatDuration(selectedMeeting.recordings?.[0]?.duration_s)}
                  </span>
                </div>
              </div>

              {/* Transcript section */}
              <div className="px-6 pb-6">
                <div className="border border-blue-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setTranscriptExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                      <FileText size={16} />
                      Session Transcript
                    </div>
                    {transcriptExpanded ? (
                      <ChevronUp size={16} className="text-blue-500" />
                    ) : (
                      <ChevronDown size={16} className="text-blue-500" />
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {transcriptExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-4 max-h-72 overflow-y-auto">
                          {transcriptLoading ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                              <Loader2 className="animate-spin" size={16} />
                              Loading transcript…
                            </div>
                          ) : transcript ? (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {transcript}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 py-4 text-center">
                              {selectedMeeting.recordings?.[0]?.has_transcript
                                ? "Transcript not available."
                                : "This recording has not been transcribed yet."}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
