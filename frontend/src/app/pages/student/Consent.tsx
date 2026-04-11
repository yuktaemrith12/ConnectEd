/**
 * Student — Privacy & Consent Settings
 * Route: /student/consent
 *
 * Card-based layout with granular toggles for each AI feature.
 * Displays current status, last-changed date, and full audit history accordion.
 * Includes a "Withdraw All Consent" button with confirmation modal.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import {
  Shield,
  Eye,
  Video,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Clock,
  Info,
} from "lucide-react";
import {
  consentGetMy,
  consentSave,
  consentWithdraw,
  consentGetAuditLog,
  type ConsentRecord,
  type ConsentType,
  type ConsentChoiceItem,
  type ConsentAuditLog,
} from "@/app/utils/api";

// Feature metadata

const FEATURES: {
  type: ConsentType;
  label: string;
  summary: string;
  detail: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  border: string;
}[] = [
  {
    type: "emotion_detection",
    label: "Emotion & Engagement Detection",
    summary: "Real-time engagement analysis via your webcam during live classes.",
    detail:
      "Your webcam feed is analysed frame-by-frame to detect engagement signals such as focus, confusion, or distraction. No video footage is stored — only anonymised emotion labels are logged. This data helps your teachers adapt their lessons in real time.",
    icon: <Eye className="w-5 h-5" />,
    accent: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  {
    type: "session_recording",
    label: "Session Recording",
    summary: "Live class audio and video are recorded for later review.",
    detail:
      "Live classes may be recorded and made available for enrolled students and teachers to replay. Recordings are stored on secure servers and automatically deleted at the end of the academic year unless otherwise requested.",
    icon: <Video className="w-5 h-5" />,
    accent: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    type: "transcript_generation",
    label: "AI Transcript & Study Notes",
    summary: "Session audio is transcribed and converted into AI-generated notes.",
    detail:
      "An AI model processes session audio to produce a text transcript and structured study notes. Transcripts are private — only you and your teachers can access them. You may delete them from the Recordings page at any time.",
    icon: <FileText className="w-5 h-5" />,
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
];

const ACTION_LABELS: Record<string, string> = {
  granted: "Consented",
  refused: "Refused",
  withdrawn: "Withdrawn",
  expired: "Expired",
  renewed: "Renewed",
  blocked_attempt: "Blocked Attempt",
  pending: "Pending",
};

const ACTION_COLORS: Record<string, string> = {
  granted: "bg-emerald-100 text-emerald-700",
  refused: "bg-red-100 text-red-700",
  withdrawn: "bg-orange-100 text-orange-700",
  expired: "bg-gray-100 text-gray-600",
  renewed: "bg-blue-100 text-blue-700",
  blocked_attempt: "bg-yellow-100 text-yellow-700",
};

// Page

export default function StudentConsent() {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [choices, setChoices] = useState<Record<ConsentType, "granted" | "refused" | null>>({
    emotion_detection: null,
    session_recording: null,
    transcript_generation: null,
  });
  const [auditLogs, setAuditLogs] = useState<ConsentAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showWithdrawAll, setShowWithdrawAll] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const studentId = parseInt(localStorage.getItem("user_id") || "0");

  const fetchData = async () => {
    setLoading(true);
    try {
      const recs = await consentGetMy();
      setRecords(recs);
      const init: Record<ConsentType, "granted" | "refused" | null> = {
        emotion_detection: null,
        session_recording: null,
        transcript_generation: null,
      };
      for (const r of recs) {
        if (r.status === "granted") init[r.consent_type] = "granted";
        else if (r.status === "refused") init[r.consent_type] = "refused";
        // pending / withdrawn / expired → null (force explicit choice)
      }
      setChoices(init);
    } catch {
      setMessage({ type: "error", text: "Failed to load consent settings." });
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      // Students call the student-facing my endpoint; audit is admin-only on backend
      // We fetch audit via admin endpoint — if 403, just skip showing audit
      const studentUserId = records[0]?.student_id;
      if (!studentUserId) return;
      const logs = await consentGetAuditLog(studentUserId).catch(() => []);
      setAuditLogs(logs);
    } catch {
      // silent — audit section simply stays empty
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getRecord = (type: ConsentType) => records.find((r) => r.consent_type === type);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const items: ConsentChoiceItem[] = (
        Object.entries(choices) as [ConsentType, "granted" | "refused" | null][]
      )
        .filter(([, v]) => v !== null)
        .map(([type, status]) => ({ consent_type: type, status: status! }));

      if (items.length === 0) {
        setMessage({ type: "error", text: "No changes to save." });
        return;
      }
      await consentSave(items);
      setMessage({ type: "success", text: "Your consent preferences have been saved." });
      await fetchData();
    } catch {
      setMessage({ type: "error", text: "Failed to save preferences. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleWithdrawAll = async () => {
    setWithdrawing(true);
    setMessage(null);
    try {
      for (const type of ["emotion_detection", "session_recording", "transcript_generation"] as ConsentType[]) {
        const rec = getRecord(type);
        if (rec && rec.status === "granted") {
          await consentWithdraw(type);
        }
      }
      setShowWithdrawAll(false);
      setMessage({ type: "success", text: "All consents have been withdrawn." });
      await fetchData();
    } catch {
      setMessage({ type: "error", text: "Failed to withdraw consents. Please try again." });
    } finally {
      setWithdrawing(false);
    }
  };

  const hasAnyGranted = records.some((r) => r.status === "granted");

  return (
    <DashboardLayout role="student">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-blue-100">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Privacy & Consent</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">
            Manage your GDPR consent for AI-powered learning features. You can change your choices at
            any time and they take effect immediately.
          </p>
        </motion.div>

        {/* Feedback */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Consent cards */}
            {FEATURES.map((f) => {
              const rec = getRecord(f.type);
              const choice = choices[f.type];

              return (
                <motion.div
                  key={f.type}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-2xl p-5 transition-all ${
                    choice === "granted"
                      ? "border-emerald-300 bg-emerald-50"
                      : choice === "refused"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Title row */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`mt-0.5 ${f.accent}`}>{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{f.label}</p>
                        {rec && rec.status !== "pending" && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              rec.status === "granted"
                                ? "bg-emerald-100 text-emerald-700"
                                : rec.status === "refused"
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{f.summary}</p>
                      {rec?.updated_at && (
                        <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last changed: {new Date(rec.updated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detail */}
                  <p className="text-gray-500 text-xs leading-relaxed mb-4 border-t border-gray-200 pt-3">
                    <Info className="w-3 h-3 inline mr-1 text-gray-400" />
                    {f.detail}
                  </p>

                  {/* Choice buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setChoices((p) => ({ ...p, [f.type]: "granted" }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        choice === "granted"
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Grant Consent
                    </button>
                    <button
                      onClick={() => setChoices((p) => ({ ...p, [f.type]: "refused" }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        choice === "refused"
                          ? "bg-red-500 text-white shadow-md"
                          : "bg-white border border-red-300 text-red-600 hover:bg-red-50"
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      Refuse
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Preferences"}
            </button>

            {/* Withdraw all */}
            {hasAnyGranted && (
              <button
                onClick={() => setShowWithdrawAll(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-300 text-red-600 font-medium text-sm hover:bg-red-50 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                Withdraw All Consent
              </button>
            )}

            {/* Audit history accordion */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition text-sm font-medium text-gray-700"
                onClick={() => {
                  setShowAudit((p) => !p);
                  if (!showAudit) fetchAudit();
                }}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  Consent History
                </span>
                {showAudit ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              <AnimatePresence>
                {showAudit && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 py-4 space-y-3">
                      {auditLogs.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">No history available.</p>
                      ) : (
                        auditLogs.map((log) => (
                          <div key={log.log_id} className="flex items-start gap-3 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {ACTION_LABELS[log.action] ?? log.action}
                            </span>
                            <div>
                              <p className="text-gray-600 font-medium">
                                {log.consent_id
                                  ? records.find((r) => r.id === log.consent_id)?.consent_type?.replace(/_/g, " ") ?? `Record #${log.consent_id}`
                                  : ""}
                              </p>
                              {log.timestamp && (
                                <p className="text-gray-400">
                                  {new Date(log.timestamp).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Withdraw All Confirmation Modal */}
        <AnimatePresence>
          {showWithdrawAll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            >
              <motion.div
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.92 }}
                className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h2 className="font-bold text-gray-800">Withdraw All Consent?</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                  This will immediately disable all AI analytics features for you. Your existing data
                  will be retained unless you submit a formal erasure request.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWithdrawAll(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdrawAll}
                    disabled={withdrawing}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {withdrawing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Withdraw All
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
