import { useState } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  FileText,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Calendar,
  Clock,
  Users,
  Video,
  Download,
  X,
  ChevronRight,
  Sparkles,
  MessageSquare,
  Target,
  Edit,
  Save,
  CheckCircle,
  Info,
} from "lucide-react";

type SessionReport = {
  id: string;
  subject: string;
  className: string;
  date: string;
  time: string;
  duration: number;
  attendanceCount: number;
  totalStudents: number;
  engagementScore: number;
  attentionSpan: number;
  participationRate: number;
  recordingId: string;
};

type EmotionData = {
  calm: number;
  focused: number;
  confused: number;
  disengaged: number;
};

type Insight = {
  id: string;
  type: "low-engagement" | "struggling-topic" | "high-performance";
  timestamp: string;
  title: string;
  description: string;
  confidence: "low" | "medium" | "high";
};

type TranscriptSegment = {
  timestamp: string;
  text: string;
  hasFlag?: boolean;
  flagType?: "confusion" | "disengagement";
};

const mockReports: SessionReport[] = [
  {
    id: "1",
    subject: "Mathematics",
    className: "Grade 10-A",
    date: "2026-02-04",
    time: "09:00",
    duration: 58,
    attendanceCount: 26,
    totalStudents: 28,
    engagementScore: 78,
    attentionSpan: 72,
    participationRate: 65,
    recordingId: "rec-001",
  },
  {
    id: "2",
    subject: "Physics",
    className: "Grade 11-A",
    date: "2026-02-04",
    time: "11:00",
    duration: 45,
    attendanceCount: 29,
    totalStudents: 30,
    engagementScore: 85,
    attentionSpan: 82,
    participationRate: 75,
    recordingId: "rec-002",
  },
  {
    id: "3",
    subject: "Mathematics",
    className: "Grade 10-B",
    date: "2026-02-03",
    time: "14:00",
    duration: 52,
    attendanceCount: 24,
    totalStudents: 26,
    engagementScore: 68,
    attentionSpan: 64,
    participationRate: 58,
    recordingId: "rec-003",
  },
];

const mockEmotionData: EmotionData = {
  calm: 35,
  focused: 45,
  confused: 12,
  disengaged: 8,
};

const mockInsights: Insight[] = [
  {
    id: "1",
    type: "low-engagement",
    timestamp: "00:23:15",
    title: "Low Engagement Detected",
    description: "Student attention dropped during explanation of quadratic formula derivation.",
    confidence: "high",
  },
  {
    id: "2",
    type: "struggling-topic",
    timestamp: "00:35:40",
    title: "Struggling Topic",
    description: "Multiple students showed confusion during complex problem-solving segment.",
    confidence: "medium",
  },
  {
    id: "3",
    type: "high-performance",
    timestamp: "00:12:20",
    title: "High Performance Moment",
    description: "Peak attention during interactive demonstration with real-world examples.",
    confidence: "high",
  },
];

const mockTranscript: TranscriptSegment[] = [
  {
    timestamp: "00:00:15",
    text: "Good morning everyone. Today we're going to explore quadratic equations and their real-world applications.",
  },
  {
    timestamp: "00:12:20",
    text: "Let me show you how this applies to projectile motion. Imagine throwing a ball...",
    hasFlag: true,
    flagType: "confusion",
  },
  {
    timestamp: "00:23:15",
    text: "Now, let's derive the quadratic formula step by step using the completing the square method.",
    hasFlag: true,
    flagType: "disengagement",
  },
  {
    timestamp: "00:35:40",
    text: "Can anyone solve this problem? What would be the first step?",
  },
];

const mockAIFeedback = {
  strengths: [
    "Strong opening with clear learning objectives",
    "Effective use of real-world examples to illustrate concepts",
    "Good pacing during the first 20 minutes",
  ],
  improvements: [
    "Consider breaking down complex derivations into smaller chunks",
    "Increase interactive elements during theoretical sections",
    "Allow more time for student questions during difficult topics",
  ],
  suggestions: [
    "Try using visual aids or animations for abstract concepts",
    "Implement quick knowledge checks every 15 minutes",
    "Consider pre-recorded derivation videos for complex formulas",
  ],
};

export default function TeacherSessionReports() {
  const [selectedReport, setSelectedReport] = useState<SessionReport | null>(null);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState("");

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  const getConfidenceBadge = (confidence: string) => {
    const styles = {
      high: "bg-green-100 text-green-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-red-100 text-red-700",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[confidence as keyof typeof styles]}`}>
        {confidence} confidence
      </span>
    );
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "low-engagement":
        return <TrendingUp className="text-orange-600" size={18} />;
      case "struggling-topic":
        return <AlertCircle className="text-red-600" size={18} />;
      case "high-performance":
        return <Target className="text-green-600" size={18} />;
      default:
        return <Lightbulb className="text-purple-600" size={18} />;
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Session Reports</h1>
          <p className="text-gray-600">Post-session engagement and teaching analysis</p>
        </div>

        {/* Info Banner */}
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
              AI-powered insights to support teaching reflection
            </p>
            <p className="text-xs text-purple-700 mt-1">
              All insights are generated from recorded session data and are intended to support teaching improvement. No student profiling or real-time monitoring is performed.
            </p>
          </div>
        </motion.div>

        {/* Report Cards */}
        {!selectedReport ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mockReports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(139, 92, 246, 0.2)" }}
                className="bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all overflow-hidden cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{report.subject}</h3>
                    <p className="text-sm text-gray-600">{report.className}</p>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-gray-400" />
                      <span>
                        {new Date(report.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-gray-400">•</span>
                      <Clock size={13} className="text-gray-400" />
                      <span>{report.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-gray-400" />
                      <span>
                        {report.attendanceCount}/{report.totalStudents} students
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Video size={13} className="text-purple-500" />
                      <span className="text-purple-700">{formatDuration(report.duration)}</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-25 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">Engagement Score</span>
                      <span className="font-semibold text-purple-700">{report.engagementScore}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 rounded-full"
                        style={{ width: `${report.engagementScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Action */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    View Full Report
                    <ChevronRight size={16} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Detailed Report View */
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={() => setSelectedReport(null)}
              className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-2"
            >
              ← Back to Reports
            </button>

            {/* Report Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedReport.subject}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{selectedReport.className}</span>
                    <span>•</span>
                    <span>
                      {new Date(selectedReport.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span>•</span>
                    <span>{selectedReport.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold">
                    {formatDuration(selectedReport.duration)}
                  </span>
                  <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-semibold flex items-center gap-1">
                    <Video size={14} />
                    Recorded
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-gray-400" />
                  <span>
                    {selectedReport.attendanceCount}/{selectedReport.totalStudents} students attended
                  </span>
                </div>
              </div>
            </div>

            {/* Recording Overview */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2 mb-1">
                  <Video size={18} className="text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Recording Overview</h3>
                </div>
                <p className="text-xs text-gray-600">Recording captured during online session</p>
              </div>
              <div className="p-5">
                <div className="relative bg-gradient-to-br from-purple-900 to-purple-700 rounded-xl aspect-video flex items-center justify-center mb-4">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer"
                  >
                    <Play size={32} className="text-white ml-1" />
                  </motion.div>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg font-semibold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2">
                    <Play size={16} />
                    View Recording
                  </button>
                  <button className="flex-1 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg font-semibold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2">
                    <FileText size={16} />
                    View Transcript
                  </button>
                </div>
              </div>
            </div>

            {/* Engagement & Emotion Analysis */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Engagement & Emotion Analysis</h3>
                </div>
              </div>
              <div className="p-5 space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl p-4 border border-purple-100">
                    <p className="text-xs text-gray-600 mb-1">Overall Engagement</p>
                    <p className="text-2xl font-bold text-purple-700 mb-2">
                      {selectedReport.engagementScore}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                        style={{ width: `${selectedReport.engagementScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-gray-600 mb-1">Attention Span</p>
                    <p className="text-2xl font-bold text-blue-700 mb-2">
                      {selectedReport.attentionSpan}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                        style={{ width: `${selectedReport.attentionSpan}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-4 border border-green-100">
                    <p className="text-xs text-gray-600 mb-1">Participation Rate</p>
                    <p className="text-2xl font-bold text-green-700 mb-2">
                      {selectedReport.participationRate}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                        style={{ width: `${selectedReport.participationRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Emotion Breakdown */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Emotion Breakdown</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-blue-700 mb-1">Calm</p>
                      <p className="text-xl font-bold text-blue-900">{mockEmotionData.calm}%</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-700 mb-1">Focused</p>
                      <p className="text-xl font-bold text-green-900">{mockEmotionData.focused}%</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-orange-700 mb-1">Confused</p>
                      <p className="text-xl font-bold text-orange-900">{mockEmotionData.confused}%</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-700 mb-1">Disengaged</p>
                      <p className="text-xl font-bold text-red-900">{mockEmotionData.disengaged}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                    <Info size={12} />
                    Derived from aggregated facial expression patterns
                  </p>
                </div>
              </div>
            </div>

            {/* AI Teaching Insights */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-600" />
                  <h3 className="font-semibold text-gray-900">AI Teaching Insights</h3>
                </div>
                <p className="text-xs text-gray-600 mt-1">Decision support based on session data</p>
              </div>
              <div className="p-5 space-y-3">
                {mockInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-gradient-to-r from-purple-50 to-white rounded-xl p-4 border border-purple-200"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg flex-shrink-0">
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                          {getConfidenceBadge(insight.confidence)}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                        <button className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                          Jump to {insight.timestamp}
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Teaching Feedback */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare size={18} className="text-purple-600" />
                      <h3 className="font-semibold text-gray-900">AI Teaching Feedback</h3>
                    </div>
                    <p className="text-xs text-purple-700">AI-generated feedback — teacher review required</p>
                  </div>
                  <button
                    onClick={() => setIsEditingFeedback(!isEditingFeedback)}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors flex items-center gap-2"
                  >
                    {isEditingFeedback ? (
                      <>
                        <Save size={16} />
                        Save Notes
                      </>
                    ) : (
                      <>
                        <Edit size={16} />
                        Edit Feedback
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Strengths */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={16} className="text-green-600" />
                    <h4 className="font-semibold text-gray-900">Strengths Observed</h4>
                  </div>
                  <ul className="space-y-2">
                    {mockAIFeedback.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-600 mt-0.5">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvements */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-orange-600" />
                    <h4 className="font-semibold text-gray-900">Areas to Improve</h4>
                  </div>
                  <ul className="space-y-2">
                    {mockAIFeedback.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-orange-600 mt-0.5">•</span>
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggestions */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={16} className="text-purple-600" />
                    <h4 className="font-semibold text-gray-900">Suggested Adjustments</h4>
                  </div>
                  <ul className="space-y-2">
                    {mockAIFeedback.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-600 mt-0.5">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Teacher Notes */}
                {isEditingFeedback && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Your Notes & Reflections
                    </label>
                    <textarea
                      value={teacherNotes}
                      onChange={(e) => setTeacherNotes(e.target.value)}
                      placeholder="Add your own reflections and notes about this session..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>
                )}

                {/* Export */}
                <div className="pt-4 border-t border-gray-200">
                  <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow flex items-center gap-2">
                    <Download size={18} />
                    Export Report (PDF)
                  </button>
                </div>
              </div>
            </div>

            {/* Ethical Disclaimer */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Info size={18} className="text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong>Ethical Notice:</strong> Insights are generated from recorded session data and are
                    intended to support teaching reflection. No student profiling or real-time monitoring is
                    performed. All data is aggregated and anonymized for privacy protection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
