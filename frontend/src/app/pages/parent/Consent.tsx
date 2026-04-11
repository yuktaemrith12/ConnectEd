/**
 * Parent — Child Consent Management
 * Route: /parent/:childId/consent
 *
 * Lets parents view and manage GDPR consent for their child's AI features.
 * Matches the student consent page layout but with a green parent theme.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useParams } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import {
  Shield,
  Eye,
  Video,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  Clock,
  Info,
  User,
} from "lucide-react";
import {
  consentGetChildRecords,
  consentSave,
  consentWithdraw,
  type ConsentRecord,
  type ConsentType,
  type ConsentChoiceItem,
} from "@/app/utils/api";

// Feature metadata

const FEATURES: {
  type: ConsentType;
  label: string;
  summary: string;
  detail: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "emotion_detection",
    label: "Emotion & Engagement Detection",
    summary: "Real-time engagement analysis via webcam during live classes.",
    detail:
      "Your child's webcam feed is analysed to detect engagement signals (e.g. focus, confusion). No video is stored — only anonymised emotion labels are logged per session.",
    icon: <Eye className="w-5 h-5" />,
  },
  {
    type: "session_recording",
    label: "Session Recording",
    summary: "Live classes may be recorded for later review.",
    detail:
      "Live class audio and video are recorded and stored securely. Only enrolled students and teachers can access recordings. They are deleted at end of academic year.",
    icon: <Video className="w-5 h-5" />,
  },
  {
    type: "transcript_generation",
    label: "AI Transcript & Study Notes",
    summary: "Session audio is transcribed and converted into AI-generated notes.",
    detail:
      "An AI model transcribes session audio and produces structured study notes. Transcripts are private to your child and their teachers.",
    icon: <FileText className="w-5 h-5" />,
  },
];

// Page

export default function ParentConsent() {
  const { childId } = useParams<{ childId: string }>();
  const studentUserId = Number(childId ?? "0");

  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [choices, setChoices] = useState<Record<ConsentType, "granted" | "refused" | null>>({
    emotion_detection: null,
    session_recording: null,
    transcript_generation: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWithdrawAll, setShowWithdrawAll] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = async () => {
    if (!studentUserId) return;
    setLoading(true);
    try {
      const recs = await consentGetChildRecords(studentUserId);
      setRecords(recs);
      const init: Record<ConsentType, "granted" | "refused" | null> = {
        emotion_detection: null,
        session_recording: null,
        transcript_generation: null,
      };
      for (const r of recs) {
        if (r.status === "granted") init[r.consent_type] = "granted";
        else if (r.status === "refused") init[r.consent_type] = "refused";
      }
      setChoices(init);
    } catch {
      setMessage({ type: "error", text: "Failed to load consent settings for this child." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [studentUserId]);

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

      await consentSave(items, studentUserId);
      setMessage({ type: "success", text: "Consent preferences saved for your child." });
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
          await consentWithdraw(type, studentUserId);
        }
      }
      setShowWithdrawAll(false);
      setMessage({ type: "success", text: "All consents withdrawn for your child." });
      await fetchData();
    } catch {
      setMessage({ type: "error", text: "Failed to withdraw consents. Please try again." });
    } finally {
      setWithdrawing(false);
    }
  };

  const hasAnyGranted = records.some((r) => r.status === "granted");

  return (
    <DashboardLayout role="parent">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-emerald-100">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Child Data Consent</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12 flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            Managing consent for child ID {studentUserId} — you can update these at any time.
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
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-4">
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
                  <div className="flex items-start gap-3 mb-3">
                    <span className="mt-0.5 text-emerald-600">{f.icon}</span>
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

                  <p className="text-gray-500 text-xs leading-relaxed mb-4 border-t border-gray-200 pt-3">
                    <Info className="w-3 h-3 inline mr-1 text-gray-400" />
                    {f.detail}
                  </p>

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

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Preferences"}
            </button>

            {hasAnyGranted && (
              <button
                onClick={() => setShowWithdrawAll(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-300 text-red-600 font-medium text-sm hover:bg-red-50 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                Withdraw All Consent
              </button>
            )}

            {/* Legal note */}
            <p className="text-xs text-gray-400 text-center leading-relaxed px-2">
              As a parent/guardian you have the right to manage consent on behalf of your child. All
              changes are logged for compliance purposes.
            </p>
          </div>
        )}

        {/* Withdraw All Modal */}
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
                  This will immediately disable all AI analytics features for your child. Existing
                  data will be retained until a formal erasure request is submitted.
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
                    {withdrawing && <Loader2 className="w-4 h-4 animate-spin" />}
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
