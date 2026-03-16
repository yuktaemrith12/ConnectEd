import { useState, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileVideo,
  Languages,
  Loader2,
  CheckCircle,
  FileText,
  Copy,
  Sparkles,
  AlertCircle,
  Image,
  RefreshCw,
  XCircle,
  ChevronRight,
  Video,
  Play,
  Calendar,
  User,
} from "lucide-react";
import {
  t2nUpload,
  t2nGetJob,
  t2nGetHistory,
  videoGetCompletedMeetings,
  t2nFromRecording,
  type T2NJob,
  type T2NHistoryItem,
  type MeetingRead,
} from "@/app/utils/api";

// ── Types ──────────────────────────────────────────────────────────────────────
type ActiveTab   = "notes" | "transcript" | "visual";
type UploadState = "idle" | "uploading" | "processing" | "completed" | "failed";
type SourceMode  = "upload" | "recording";

// Flag images via flagcdn.com (reliable cross-platform, works on Windows Chrome)
const LANGUAGE_OPTIONS = [
  { value: "en",         label: "English", flagSrc: "https://flagcdn.com/24x18/gb.png",  alt: "GB" },
  { value: "fr",         label: "French",  flagSrc: "https://flagcdn.com/24x18/fr.png",  alt: "FR" },
  { value: "mfe_fusion", label: "Creole",  flagSrc: "https://flagcdn.com/24x18/mu.png",  alt: "MU" },
];

const STAGE_LABELS: Record<string, string> = {
  queued:                "Queued…",
  transcribing:          "Transcribing audio…",
  generating_notes:      "Generating study notes…",
  creating_illustration: "Creating visuals…",
  completed:             "Done!",
};

// ── Illustration helpers ───────────────────────────────────────────────────────
interface IllustrationItem { concept: string; image: string; }

function parseIllustrations(raw: string | null): IllustrationItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as IllustrationItem[];
  } catch { /* not JSON — legacy single-image */ }
  // Legacy: plain data URI or URL
  return [{ concept: "Visual", image: raw }];
}

// ── Markdown helpers ──────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm text-gray-800 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("# "))
          return <h1 key={i} className="text-xl font-bold text-gray-900 mt-4 mb-1">{renderInline(line.slice(2))}</h1>;
        if (line.startsWith("## "))
          return <h2 key={i} className="text-lg font-semibold text-gray-900 mt-3 mb-1">{renderInline(line.slice(3))}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} className="font-semibold text-gray-800 mt-2">{renderInline(line.slice(4))}</h3>;
        if (line.startsWith("  - ") || line.startsWith("  * "))
          return (
            <div key={i} className="flex gap-2 ml-4">
              <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-gray-600">{renderInline(line.slice(4))}</span>
            </div>
          );
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentTranscriptToNotes() {
  const [sourceMode, setSourceMode]       = useState<SourceMode>("upload");
  const [uploadState, setUploadState]     = useState<UploadState>("idle");
  const [selectedLang, setSelectedLang]   = useState("en");
  const [activeTab, setActiveTab]         = useState<ActiveTab>("notes");
  const [dragOver, setDragOver]           = useState(false);
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [currentJob, setCurrentJob]       = useState<T2NJob | null>(null);
  const [history, setHistory]             = useState<T2NHistoryItem[]>([]);
  const [showHistory, setShowHistory]     = useState(false);
  const [copyDone, setCopyDone]           = useState(false);
  const [errorMsg, setErrorMsg]           = useState("");
  // Recording-source state
  const [recordings, setRecordings]       = useState<MeetingRead[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load history on mount
  useEffect(() => {
    t2nGetHistory().then(setHistory).catch(() => {});
  }, []);

  // Load recordings when switching to recording mode
  useEffect(() => {
    if (sourceMode !== "recording" || recordings.length > 0) return;
    setRecordingsLoading(true);
    videoGetCompletedMeetings()
      .then((list) => setRecordings(list.filter((m) => (m.recording_count ?? 0) > 0)))
      .catch(() => setRecordings([]))
      .finally(() => setRecordingsLoading(false));
  }, [sourceMode, recordings.length]);

  // Polling for job status
  const startPolling = useCallback((jobId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await t2nGetJob(jobId);
        setCurrentJob(job);
        if (job.status === "completed") {
          setUploadState("completed");
          clearInterval(pollRef.current!);
          pollRef.current = null;
          t2nGetHistory().then(setHistory).catch(() => {});
        } else if (job.status === "failed") {
          setUploadState("failed");
          setErrorMsg(job.error_message || "Processing failed.");
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFile = (file: File) => { setSelectedFile(file); setErrorMsg(""); };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFile(file);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0]; if (file) handleFile(file);
  };

  const handleGenerateUpload = async () => {
    if (!selectedFile) return;
    setUploadState("uploading"); setCurrentJob(null); setErrorMsg("");
    try {
      const { job_id } = await t2nUpload(selectedFile, selectedLang);
      setUploadState("processing"); startPolling(job_id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Upload failed.";
      setErrorMsg(msg); setUploadState("failed");
    }
  };

  const handleGenerateFromRecording = async () => {
    if (!selectedMeetingId) return;
    setUploadState("uploading"); setCurrentJob(null); setErrorMsg("");
    try {
      const { job_id } = await t2nFromRecording(selectedMeetingId, selectedLang);
      setUploadState("processing"); startPolling(job_id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to start job.";
      setErrorMsg(msg); setUploadState("failed");
    }
  };

  const handleCopy = () => {
    const text = activeTab === "transcript" ? currentJob?.transcript : currentJob?.notes_markdown;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopyDone(true); setTimeout(() => setCopyDone(false), 2000);
    });
  };

  const handleReset = () => {
    setUploadState("idle"); setSelectedFile(null); setCurrentJob(null);
    setErrorMsg(""); setSelectedMeetingId(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const loadHistoryJob = async (item: T2NHistoryItem) => {
    setShowHistory(false);
    try {
      const job = await t2nGetJob(item.job_id);
      setCurrentJob(job);
      setUploadState(job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : "processing");
      if (job.status === "processing") startPolling(job.job_id);
    } catch { /* ignore */ }
  };

  const switchMode = (mode: SourceMode) => {
    if (uploadState !== "idle" && uploadState !== "completed" && uploadState !== "failed") return;
    setSourceMode(mode);
    setSelectedFile(null);
    setSelectedMeetingId(null);
    setErrorMsg("");
  };

  const stageName = currentJob?.current_stage ? (STAGE_LABELS[currentJob.current_stage] ?? currentJob.current_stage) : "";
  const langLabel = LANGUAGE_OPTIONS.find(l => l.value === selectedLang)?.label ?? "";
  const canGenerate = sourceMode === "upload" ? !!selectedFile : !!selectedMeetingId;

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold">Transcript to Notes</h1>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
                <Sparkles size={12} /> AI-Powered
              </span>
            </div>
            <p className="text-gray-600">Convert audio/video recordings into structured study notes</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} />
            History
          </button>
        </div>

        {/* History panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
            >
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Recent Jobs</h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">No past jobs yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.map(item => (
                    <button
                      key={item.job_id}
                      onClick={() => loadHistoryJob(item)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                          {item.source_reference || `Job #${item.job_id}`}
                        </p>
                        <p className="text-xs text-gray-500">{item.language} · {item.created_at?.slice(0, 10)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.status === "completed" ? "bg-green-100 text-green-700"
                          : item.status === "failed"  ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                        }`}>{item.status}</span>
                        <ChevronRight size={14} className="text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left: Input panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            {/* Source mode toggle */}
            <div className="flex rounded-xl border border-gray-200 p-1 mb-5">
              <button
                onClick={() => switchMode("upload")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  sourceMode === "upload"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Upload size={15} />
                Upload File
              </button>
              <button
                onClick={() => switchMode("recording")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  sourceMode === "recording"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Video size={15} />
                Class Recording
              </button>
            </div>

            {/* Language selector */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Language</label>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedLang(opt.value)}
                    className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                      selectedLang === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <img src={opt.flagSrc} alt={opt.alt} className="w-6 h-auto rounded-sm" />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {selectedLang === "mfe_fusion" && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                  Creole mode uses MMS + Whisper + GPT-4o fusion for best quality. Downloads ~2 GB model on first use.
                </p>
              )}
            </div>

            {/* ── Upload mode: drop zone ── */}
            {sourceMode === "upload" && uploadState === "idle" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.mp4,.m4a,.mov,.webm,.ogg,.flac"
                  className="hidden"
                  onChange={onInputChange}
                />
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/40"
                  }`}
                >
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="text-blue-600" size={28} />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="font-semibold text-gray-900 truncate max-w-xs mx-auto">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Drag & drop or click to browse</p>
                      <p className="text-xs text-gray-500">MP3, WAV, MP4, M4A, MOV, WebM · Max 100 MB</p>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle size={16} />{errorMsg}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleGenerateUpload}
                  disabled={!canGenerate}
                  className="mt-4 w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  Generate Notes ({langLabel})
                </motion.button>
              </>
            )}

            {/* ── Recording mode: recording list ── */}
            {sourceMode === "recording" && uploadState === "idle" && (
              <>
                {recordingsLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-400">
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Loading recordings…
                  </div>
                ) : recordings.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Video size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No class recordings with transcripts yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {recordings.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMeetingId(m.id === selectedMeetingId ? null : m.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          selectedMeetingId === m.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          selectedMeetingId === m.id ? "bg-blue-500" : "bg-blue-100"
                        }`}>
                          <Play size={14} className={selectedMeetingId === m.id ? "text-white ml-0.5" : "text-blue-500 ml-0.5"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {m.title || m.subject_name || "Class Recording"}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <User size={10} />{m.teacher_name || "–"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {m.started_at
                                ? new Date(m.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                : "–"}
                            </span>
                          </div>
                        </div>
                        {selectedMeetingId === m.id && (
                          <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle size={16} />{errorMsg}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleGenerateFromRecording}
                  disabled={!canGenerate}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  Generate Notes ({langLabel})
                </motion.button>
              </>
            )}

            {/* Uploading state */}
            {uploadState === "uploading" && (
              <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-8 text-center">
                <Loader2 className="animate-spin text-blue-600 mx-auto mb-3" size={32} />
                <p className="font-semibold text-blue-900">
                  {sourceMode === "recording" ? "Preparing notes…" : "Uploading file…"}
                </p>
              </div>
            )}

            {/* Processing state */}
            {uploadState === "processing" && (
              <div className="border-2 border-indigo-200 bg-indigo-50 rounded-xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <FileVideo className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{currentJob?.source_reference ?? "Processing…"}</p>
                    <p className="text-sm text-indigo-700 mt-0.5">{stageName}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(sourceMode === "recording"
                    ? ["generating_notes", "creating_illustration"]
                    : ["transcribing", "generating_notes", "creating_illustration"]
                  ).map((stage, i) => {
                    const allStages = sourceMode === "recording"
                      ? ["generating_notes", "creating_illustration", "completed"]
                      : ["transcribing", "generating_notes", "creating_illustration", "completed"];
                    const currentIdx = allStages.indexOf(currentJob?.current_stage ?? "");
                    const done   = currentIdx > i;
                    const active = currentIdx === i;
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          done ? "bg-green-500" : active ? "bg-indigo-500 animate-pulse" : "bg-gray-200"
                        }`}>
                          {done
                            ? <CheckCircle size={14} className="text-white" />
                            : <span className="text-white text-xs font-bold">{i + 1}</span>
                          }
                        </div>
                        <span className={`text-sm ${done ? "text-green-700 font-medium" : active ? "text-indigo-700 font-medium" : "text-gray-400"}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed state */}
            {uploadState === "completed" && (
              <div className="border-2 border-green-200 bg-green-50 rounded-xl p-8 text-center">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="text-white" size={28} />
                </div>
                <p className="font-semibold text-gray-900 mb-1">Notes Ready!</p>
                <p className="text-sm text-gray-500 mb-4 truncate">{currentJob?.source_reference}</p>
                <button
                  onClick={handleReset}
                  className="px-5 py-2 border-2 border-green-300 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors"
                >
                  Process Another
                </button>
              </div>
            )}

            {/* Failed state */}
            {uploadState === "failed" && (
              <div className="border-2 border-red-200 bg-red-50 rounded-xl p-8 text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <XCircle className="text-red-600" size={28} />
                </div>
                <p className="font-semibold text-gray-900 mb-1">Processing Failed</p>
                <p className="text-sm text-red-600 mb-4">{errorMsg || currentJob?.error_message}</p>
                <button
                  onClick={handleReset}
                  className="px-5 py-2 border-2 border-red-300 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Info banner */}
            {(uploadState === "idle") && (
              <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="text-gray-400 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-gray-500">
                  {sourceMode === "recording"
                    ? "Select a class recording with a transcript. Notes are generated from the session transcript — no re-upload needed."
                    : "Processing time depends on file length and language mode. English files typically finish in 1–3 min."}
                </p>
              </div>
            )}
          </motion.div>

          {/* ── Right: Output panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Generated Output</h3>
              {currentJob && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copyDone ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                  {copyDone ? "Copied!" : "Copy"}
                </button>
              )}
            </div>

            {currentJob ? (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4">
                  {([
                    { key: "notes",      label: "Study Notes",  icon: <Sparkles size={14} /> },
                    { key: "transcript", label: "Transcript",   icon: <FileText size={14} /> },
                    { key: "visual",     label: "Visual",       icon: <Image size={14} /> },
                  ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[480px] pr-1">
                  <AnimatePresence mode="wait">
                    {activeTab === "notes" && (
                      <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {currentJob.notes_markdown ? (
                          <MarkdownText text={currentJob.notes_markdown} />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Loader2 className="animate-spin mb-2" size={24} />
                            <p className="text-sm">Generating notes…</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {activeTab === "transcript" && (
                      <motion.div key="transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {currentJob.transcript ? (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {currentJob.transcript}
                          </p>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Loader2 className="animate-spin mb-2" size={24} />
                            <p className="text-sm">Transcribing audio…</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {activeTab === "visual" && (
                      <motion.div key="visual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {(() => {
                          const visuals = parseIllustrations(currentJob.illustration_url);
                          if (visuals.length > 0) {
                            return (
                              <div className="space-y-6">
                                {visuals.map((v, idx) => (
                                  <div key={idx} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                                      <span className="w-5 h-5 bg-blue-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="text-sm font-semibold text-blue-800 truncate">{v.concept}</span>
                                    </div>
                                    <img
                                      src={v.image}
                                      alt={v.concept}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          if (currentJob.status === "completed") {
                            return (
                              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Image size={32} className="mb-2 text-gray-300" />
                                <p className="text-sm">Visuals unavailable</p>
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                              <Loader2 className="animate-spin mb-2" size={24} />
                              <p className="text-sm">Creating visuals…</p>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Languages size={32} className="text-gray-300" />
                </div>
                <h4 className="font-semibold text-gray-700 mb-1">No output yet</h4>
                <p className="text-sm max-w-xs">
                  {sourceMode === "recording"
                    ? "Select a class recording and click Generate Notes."
                    : "Upload an audio or video file and click Generate Notes to get started."}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
