/**
 * Recording Player — Teacher view
 *
 * Shows:
 *  - HTML5 video player for the MP4 recording
 *  - AI-generated transcript excerpt
 *  - Recharts line chart of emotion/engagement over time
 *  - AI confusion peaks + teaching suggestions
 *
 * Accessed via: /teacher/recording/:meetingId
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Brain,
  Lightbulb,
  AlertTriangle,
  Play,
  Loader2,
  BarChart3,
  FileText,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  videoGetMeeting,
  videoGetAnalytics,
  videoGetEmotionTimeline,
  type MeetingRead,
  type MeetingAnalyticsRead,
  type EmotionTimelinePoint,
} from "@/app/utils/api";

const EMOTION_COLORS: Record<string, string> = {
  engagement:   "#8b5cf6",
  understanding:"#10b981",
  confusion:    "#f59e0b",
  boredom:      "#6b7280",
  frustration:  "#ef4444",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordingPlayer() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [meeting, setMeeting]     = useState<MeetingRead | null>(null);
  const [analytics, setAnalytics] = useState<MeetingAnalyticsRead | null>(null);
  const [timeline, setTimeline]   = useState<EmotionTimelinePoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<"chart" | "insights" | "transcript">("chart");

  useEffect(() => {
    if (!meetingId) return;
    const id = parseInt(meetingId, 10);

    Promise.allSettled([
      videoGetMeeting(id).then(setMeeting),
      videoGetAnalytics(id).then(setAnalytics).catch(() => {}),
      videoGetEmotionTimeline(id).then((r) => setTimeline(r.timeline)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [meetingId]);

  // Determine video URL from the first recording
  const firstRec = meeting?.recordings?.[0];
  // Normalize Windows backslashes before extracting filename
  const videoUrl = firstRec
    ? `http://127.0.0.1:8000/uploads/recordings/${firstRec.storage_path.replace(/\\/g, "/").split("/").pop()}`
    : null;

  const report = analytics?.report_json;
  const engagementScore = report?.engagement_score;

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={40} className="animate-spin text-purple-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!meeting) {
    return (
      <DashboardLayout role="teacher">
        <div className="text-center py-24">
          <p className="text-gray-500">Meeting not found.</p>
          <button
            onClick={() => navigate("/teacher/recordings")}
            className="mt-4 text-purple-600 hover:underline text-sm"
          >
            ← Back to Recordings
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/teacher/recordings")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
            <p className="text-sm text-gray-500">
              {meeting.class_name} · {meeting.subject_name} ·{" "}
              {meeting.started_at
                ? new Date(meeting.started_at).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  })
                : "—"}
            </p>
          </div>
          {engagementScore != null && (
            <div className="ml-auto flex items-center gap-2 bg-purple-50 border border-purple-200 px-4 py-2 rounded-full">
              <TrendingUp size={16} className="text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">
                Engagement Score: {engagementScore}/100
              </span>
            </div>
          )}
        </div>

        {/* Main grid: video + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video player — spans 2 columns on large screens */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <Play size={48} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    {firstRec
                      ? "Recording file not yet accessible"
                      : "No recording available for this meeting"}
                  </p>
                </div>
              )}
            </div>

            {/* Recording metadata row */}
            {firstRec && (
              <div className="flex gap-3 text-sm text-gray-600">
                <span className="bg-gray-100 px-3 py-1 rounded-full">
                  {Math.floor(firstRec.duration_s / 60)} min {firstRec.duration_s % 60} sec
                </span>
                {firstRec.has_transcript && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    Transcript ready
                  </span>
                )}
                {firstRec.has_analytics && (
                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                    Analytics ready
                  </span>
                )}
                {!firstRec.has_transcript && !firstRec.has_analytics && (
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    Processing…
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — AI summary */}
          <div className="space-y-4">
            {report?.summary ? (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={18} className="text-purple-600" />
                  <h3 className="font-semibold text-purple-900">AI Summary</h3>
                </div>
                <p className="text-sm text-purple-800 leading-relaxed">{report.summary}</p>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
                <Brain size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  AI analysis pending. Check back after processing completes.
                </p>
              </div>
            )}

            {/* Quick emotion breakdown */}
            {report?.emotion_summary && Object.keys(report.emotion_summary).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
                <h3 className="font-semibold text-gray-800 text-sm">Emotion Breakdown</h3>
                {Object.entries(report.emotion_summary).map(([emotion, pct]) => (
                  <div key={emotion} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="capitalize">{emotion}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: EMOTION_COLORS[emotion] ?? "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analytics Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {[
              { key: "chart",      label: "Emotion Timeline", Icon: BarChart3 },
              { key: "insights",   label: "Teaching Insights", Icon: Lightbulb },
              { key: "transcript", label: "Transcript Snippet", Icon: FileText },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? "border-purple-500 text-purple-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Chart Tab */}
            {activeTab === "chart" && (
              <>
                {timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="timestamp_s"
                        tickFormatter={formatTime}
                        label={{ value: "Time", position: "insideBottomRight", offset: -8, fontSize: 12 }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value, name) => [`${value} detections`, name]}
                        labelFormatter={(v) => `Time: ${formatTime(Number(v))}`}
                      />
                      <Legend />
                      {Object.entries(EMOTION_COLORS).map(([emotion, color]) => (
                        <Line
                          key={emotion}
                          type="monotone"
                          dataKey={emotion}
                          stroke={color}
                          dot={false}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      Emotion timeline not yet available.
                      {" "}Place your trained model at <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">emotion_detection_model/research/runs/emotion_detect_phase2/weights/best.pt</code> and reprocess.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Insights Tab */}
            {activeTab === "insights" && (
              <div className="space-y-6">
                {/* Confusion peaks */}
                {report?.confusion_peaks && report.confusion_peaks.length > 0 ? (
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-500" />
                      Confusion Peaks
                    </h3>
                    <div className="space-y-2">
                      {report.confusion_peaks.map((peak, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-amber-900">{peak.topic}</p>
                          <p className="text-xs text-amber-700 mt-0.5">{peak.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* AI suggestions */}
                {report?.ai_suggestions && report.ai_suggestions.length > 0 ? (
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Lightbulb size={16} className="text-purple-500" />
                      Teaching Suggestions
                    </h3>
                    <ul className="space-y-2">
                      {report.ai_suggestions.map((tip, i) => (
                        <li key={i} className="flex gap-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
                          <span className="w-5 h-5 bg-purple-200 text-purple-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm text-purple-800">{tip}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Lightbulb size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">AI insights not yet available.</p>
                  </div>
                )}
              </div>
            )}

            {/* Transcript Tab */}
            {activeTab === "transcript" && (
              <div>
                {report?.transcript_snippet ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">Showing first 400 characters of transcript</p>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap">
                      {report.transcript_snippet}
                      {report.transcript_snippet.length >= 400 && (
                        <span className="text-gray-400">…</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Transcript not yet available.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
