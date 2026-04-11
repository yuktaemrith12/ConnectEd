/**
 * ConsentGateway — GDPR first-login consent overlay for students.
 *
 * Renders a full-screen, non-dismissible modal when the student has any
 * consent type still in 'pending' state. The student must explicitly
 * Grant or Refuse each item before the dashboard is accessible.
 */

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Shield,
  Eye,
  Video,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  consentGetMy,
  consentSave,
  type ConsentRecord,
  type ConsentType,
  type ConsentChoiceItem,
} from "@/app/utils/api";

// Per-feature display metadata

const FEATURES: {
  type: ConsentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    type: "emotion_detection",
    label: "Emotion & Engagement Detection",
    description:
      "Your webcam feed is analysed in real time to detect engagement signals (e.g. focus, confusion). No video is stored — only anonymised emotion labels are logged to help teachers understand class dynamics.",
    icon: <Eye className="w-5 h-5" />,
    color: "text-purple-600",
  },
  {
    type: "session_recording",
    label: "Session Recording",
    description:
      "Live classes may be recorded for later review by enrolled students and teachers. Recordings are stored securely and deleted at the end of the academic year.",
    icon: <Video className="w-5 h-5" />,
    color: "text-blue-600",
  },
  {
    type: "transcript_generation",
    label: "AI Transcript & Notes",
    description:
      "Audio from sessions is transcribed by an AI model and converted into study notes. Transcripts are only accessible to you and your teachers.",
    icon: <FileText className="w-5 h-5" />,
    color: "text-emerald-600",
  },
];

// Component

export default function ConsentGateway() {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [choices, setChoices] = useState<Record<ConsentType, "granted" | "refused" | null>>({
    emotion_detection: null,
    session_recording: null,
    transcript_generation: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consentGetMy()
      .then((recs) => {
        setRecords(recs);
        const hasPending = recs.some((r) => r.status === "pending");
        if (hasPending) {
          // Pre-fill choices from already-decided types
          const initial: Record<ConsentType, "granted" | "refused" | null> = {
            emotion_detection: null,
            session_recording: null,
            transcript_generation: null,
          };
          for (const r of recs) {
            if (r.status === "granted") initial[r.consent_type] = "granted";
            else if (r.status === "refused") initial[r.consent_type] = "refused";
          }
          setChoices(initial);
          setVisible(true);
        }
      })
      .catch(() => {}) // Non-blocking — if API fails, don't block the student
      .finally(() => setLoading(false));
  }, []);

  const allDecided = Object.values(choices).every((v) => v !== null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const items: ConsentChoiceItem[] = (
        Object.entries(choices) as [ConsentType, "granted" | "refused" | null][]
      )
        .filter(([, v]) => v !== null)
        .map(([type, status]) => ({ consent_type: type, status: status! }));

      await consentSave(items);
      setVisible(false);
    } catch {
      setError("Could not save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (type: ConsentType, value: "granted" | "refused") => {
    setChoices((prev) => ({ ...prev, [type]: value }));
  };

  if (loading || !visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-7 h-7" />
                <h1 className="text-xl font-bold">Privacy & Data Consent</h1>
              </div>
              <p className="text-blue-100 text-sm leading-relaxed">
                ConnectEd uses AI-powered features to enhance your learning experience. Under GDPR, we
                need your explicit consent before processing any biometric or behavioural data.
                <strong className="text-white"> You can change these at any time</strong> from your
                Settings.
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {FEATURES.map((f) => {
                const choice = choices[f.type];
                return (
                  <div
                    key={f.type}
                    className={`border rounded-xl p-4 transition-all ${
                      choice === "granted"
                        ? "border-emerald-300 bg-emerald-50"
                        : choice === "refused"
                        ? "border-red-200 bg-red-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className={f.color}>{f.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">{f.label}</p>
                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">{f.description}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {/* Grant */}
                      <button
                        onClick={() => toggle(f.type, "granted")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                          choice === "granted"
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        I Consent
                      </button>

                      {/* Refuse */}
                      <button
                        onClick={() => toggle(f.type, "refused")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                          choice === "refused"
                            ? "bg-red-500 text-white shadow"
                            : "bg-white border border-red-300 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        I Refuse
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Legal note */}
              <p className="text-xs text-gray-400 leading-relaxed">
                Your choices are logged with a timestamp and IP address for compliance purposes. Refusing
                consent means those AI features will be disabled for you but all other platform
                functionality remains fully available.
              </p>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
              )}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!allDecided || saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {saving ? "Saving…" : allDecided ? "Save My Preferences" : "Please choose all options above"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
