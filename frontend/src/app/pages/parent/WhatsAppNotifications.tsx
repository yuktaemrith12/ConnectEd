import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import {
  MessageCircle,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  ClipboardList,
  MessageSquare,
  BarChart3,
  BookOpen,
  X,
  AlertCircle,
  Unlink,
} from "lucide-react";
import {
  parentGetWhatsAppSettings,
  parentUpdateWhatsAppSettings,
  parentDisconnectWhatsApp,
  type WhatsAppSettings,
} from "@/app/utils/api";

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${checked ? "bg-emerald-500" : "bg-gray-200"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <motion.span
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-block h-5 w-5 rounded-full bg-white shadow"
      />
    </button>
  );
}

// ── Notification Preference Row ────────────────────────────────────────────────

interface PrefRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function PrefRow({ icon, label, description, checked, onChange, disabled }: PrefRowProps) {
  return (
    <motion.div
      layout
      className="flex items-center justify-between p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </motion.div>
  );
}

// ── Connect Modal ─────────────────────────────────────────────────────────────

function ConnectModal({
  onClose,
  onConnect,
  saving,
}: {
  onClose: () => void;
  onConnect: (phone: string) => void;
  saving: boolean;
}) {
  const [phone, setPhone] = useState("+");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const cleaned = phone.trim();
    if (!cleaned.startsWith("+") || cleaned.length < 8) {
      setError("Enter a valid phone number in E.164 format, e.g. +60123456789");
      return;
    }
    setError("");
    onConnect(cleaned);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Connect WhatsApp</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Enter your WhatsApp number in international format. ConnectEd will send school
          updates directly to this number.
        </p>

        <div className="mb-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+60123456789"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </p>
        )}

        <p className="text-xs text-gray-400 mt-2 mb-5">
          Example: +60 for Malaysia, +44 for UK, +1 for USA/Canada
        </p>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4" /> Connect
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WhatsAppNotifications() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    parentGetWhatsAppSettings()
      .then(setSettings)
      .catch(() => showToast("error", "Failed to load WhatsApp settings."))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggle = async (field: keyof WhatsAppSettings, value: boolean) => {
    if (!settings) return;
    const optimistic = { ...settings, [field]: value };
    setSettings(optimistic);
    try {
      const updated = await parentUpdateWhatsAppSettings({ [field]: value });
      setSettings(updated);
    } catch {
      setSettings(settings); // rollback
      showToast("error", "Failed to save preference. Please try again.");
    }
  };

  const handleConnect = async (phone: string) => {
    setSaving(true);
    try {
      const updated = await parentUpdateWhatsAppSettings({ phone_number: phone });
      setSettings(updated);
      setShowModal(false);
      showToast("success", "WhatsApp connected successfully!");
    } catch {
      showToast("error", "Failed to connect. Check the number and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await parentDisconnectWhatsApp();
      setSettings((s) => s ? { ...s, is_connected: false, phone_number: null } : s);
      showToast("success", "WhatsApp disconnected.");
    } catch {
      showToast("error", "Failed to disconnect. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isConnected = settings?.is_connected ?? false;

  return (
    <DashboardLayout role="parent">
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WhatsApp Alerts</h1>
              <p className="text-sm text-gray-500">Real-time school updates via WhatsApp</p>
            </div>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Connection Status Card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border
                  ${isConnected
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white"
                    : "bg-white border-gray-100 text-gray-800"
                  }`}
              >
                {/* Decorative blob */}
                {isConnected && (
                  <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
                )}

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                      ${isConnected ? "bg-white/20" : "bg-emerald-50"}`}
                    >
                      {isConnected ? (
                        <motion.div
                          animate={{ scale: [1, 1.12, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          <CheckCircle2 className="w-7 h-7 text-white" />
                        </motion.div>
                      ) : (
                        <XCircle className="w-7 h-7 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className={`font-bold text-lg ${isConnected ? "text-white" : "text-gray-900"}`}>
                        {isConnected ? "Connected" : "Not Connected"}
                      </p>
                      <p className={`text-sm mt-0.5 ${isConnected ? "text-white/80" : "text-gray-500"}`}>
                        {isConnected && settings?.phone_number
                          ? settings.phone_number
                          : "Link your WhatsApp number to receive alerts"}
                      </p>
                    </div>
                  </div>

                  {isConnected ? (
                    <button
                      onClick={handleDisconnect}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlink className="w-4 h-4" />
                      )}
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowModal(true)}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 transition-all"
                    >
                      <Phone className="w-4 h-4" />
                      Connect WhatsApp
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Notification Preferences */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                  Notification Preferences
                </p>

                <div className="space-y-2">
                  <PrefRow
                    icon={<Calendar className="w-5 h-5" />}
                    label="Events & Exams"
                    description="School events, exams, and announcements published by the school"
                    checked={settings?.notify_events ?? true}
                    onChange={(v) => handleToggle("notify_events", v)}
                    disabled={!isConnected}
                  />
                  <PrefRow
                    icon={<ClipboardList className="w-5 h-5" />}
                    label="Attendance"
                    description="Alerts when your child is marked absent or late"
                    checked={settings?.notify_attendance ?? true}
                    onChange={(v) => handleToggle("notify_attendance", v)}
                    disabled={!isConnected}
                  />
                  <PrefRow
                    icon={<MessageSquare className="w-5 h-5" />}
                    label="Messages"
                    description="When a teacher sends you a message on ConnectEd"
                    checked={settings?.notify_messages ?? true}
                    onChange={(v) => handleToggle("notify_messages", v)}
                    disabled={!isConnected}
                  />
                  <PrefRow
                    icon={<BarChart3 className="w-5 h-5" />}
                    label="Grades Released"
                    description="Notified when assignment grades are published"
                    checked={settings?.notify_grades ?? true}
                    onChange={(v) => handleToggle("notify_grades", v)}
                    disabled={!isConnected}
                  />
                  <PrefRow
                    icon={<BookOpen className="w-5 h-5" />}
                    label="New Assignments"
                    description="When a teacher posts a new assignment for your child's class"
                    checked={settings?.notify_assignments ?? true}
                    onChange={(v) => handleToggle("notify_assignments", v)}
                    disabled={!isConnected}
                  />
                </div>
              </motion.div>

              {/* Footer Note */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-start gap-2.5 p-4 rounded-2xl bg-emerald-50 border border-emerald-100"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-700 leading-relaxed">
                  These settings apply to your parent account and cover notifications for{" "}
                  <strong>all your linked children</strong>. Each message will include your
                  child's name so you always know who it refers to.
                </p>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      <AnimatePresence>
        {showModal && (
          <ConnectModal
            onClose={() => setShowModal(false)}
            onConnect={handleConnect}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium
              ${toast.type === "success"
                ? "bg-emerald-500 text-white"
                : "bg-red-500 text-white"}`}
          >
            {toast.type === "success"
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
