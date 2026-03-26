/**
 * Admin — Consent Compliance Dashboard
 * Route: /admin/consent
 *
 * Institution-wide consent rates, breakdown per feature, table of non-consenting
 * students, searchable audit log, and "Send Bulk Request" trigger.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import {
  Shield,
  Eye,
  Video,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Bell,
} from "lucide-react";
import {
  consentGetComplianceOverview,
  consentBulkRequest,
  consentGetAuditLog,
  consentGetStudentRecords,
  adminGetUsers,
  type ComplianceOverview,
  type ConsentAuditLog,
  type ConsentRecord,
  type AdminUser,
} from "@/app/utils/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FEATURE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  emotion_detection:    { label: "Emotion Detection",    icon: <Eye className="w-4 h-4" />,      color: "text-purple-600" },
  session_recording:    { label: "Session Recording",    icon: <Video className="w-4 h-4" />,     color: "text-blue-600"   },
  transcript_generation:{ label: "AI Transcript",        icon: <FileText className="w-4 h-4" />,  color: "text-emerald-600"},
};

const ACTION_COLORS: Record<string, string> = {
  granted:         "bg-emerald-100 text-emerald-700",
  refused:         "bg-red-100 text-red-700",
  withdrawn:       "bg-orange-100 text-orange-700",
  expired:         "bg-gray-100 text-gray-600",
  renewed:         "bg-blue-100 text-blue-700",
  blocked_attempt: "bg-yellow-100 text-yellow-700",
};

function RateBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${rate}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminConsentCompliance() {
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  // Audit section
  const [auditStudentId, setAuditStudentId] = useState("");
  const [auditLogs, setAuditLogs] = useState<ConsentAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // Student consent lookup
  const [lookupStudentId, setLookupStudentId] = useState("");
  const [lookupRecords, setLookupRecords] = useState<ConsentRecord[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await consentGetComplianceOverview();
      setOverview(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const handleBulkRequest = async () => {
    setBulkLoading(true);
    setBulkMsg(null);
    try {
      const res = await consentBulkRequest();
      setBulkMsg(res.detail);
    } catch {
      setBulkMsg("Failed to send bulk request.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAuditSearch = async () => {
    const id = parseInt(auditStudentId);
    if (!id) return;
    setAuditLoading(true);
    try {
      const logs = await consentGetAuditLog(id);
      setAuditLogs(logs);
      setShowAudit(true);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleLookup = async () => {
    const id = parseInt(lookupStudentId);
    if (!id) return;
    setLookupLoading(true);
    try {
      const recs = await consentGetStudentRecords(id);
      setLookupRecords(recs);
      setShowLookup(true);
    } catch {
      setLookupRecords([]);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-100">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consent Compliance</h1>
              <p className="text-gray-500 text-sm">Institution-wide GDPR consent overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOverview}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleBulkRequest}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
            >
              {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Send Consent Requests
            </button>
          </div>
        </motion.div>

        {bulkMsg && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl">
            {bulkMsg}
          </div>
        )}

        {/* Overview cards */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : overview ? (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{overview.total_students}</p>
                  <p className="text-xs text-gray-500">Total Students</p>
                </div>
              </div>
              {overview.consent_types.map((ct) => {
                const meta = FEATURE_META[ct.type];
                return (
                  <div key={ct.type} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className={`flex items-center gap-2 mb-2 ${meta.color}`}>
                      {meta.icon}
                      <span className="text-xs font-semibold">{meta.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{ct.rate}%</p>
                    <p className="text-xs text-gray-500 mb-2">consent rate</p>
                    <RateBar
                      rate={ct.rate ?? 0}
                      color={
                        (ct.rate ?? 0) >= 70
                          ? "bg-emerald-500"
                          : (ct.rate ?? 0) >= 40
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }
                    />
                  </div>
                );
              })}
            </div>

            {/* Detailed breakdown table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Consent Breakdown by Feature</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Feature</th>
                      <th className="text-right px-4 py-3 text-emerald-600">Granted</th>
                      <th className="text-right px-4 py-3 text-red-500">Refused</th>
                      <th className="text-right px-4 py-3 text-yellow-600">Pending</th>
                      <th className="text-right px-4 py-3 text-orange-500">Withdrawn</th>
                      <th className="text-right px-5 py-3">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {overview.consent_types.map((ct) => {
                      const meta = FEATURE_META[ct.type];
                      return (
                        <tr key={ct.type} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3">
                            <div className={`flex items-center gap-2 ${meta.color}`}>
                              {meta.icon}
                              <span className="font-medium text-gray-800">{meta.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {ct.granted}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              {ct.refused}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-yellow-600 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {ct.pending}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {ct.withdrawn}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`font-bold ${
                                (ct.rate ?? 0) >= 70
                                  ? "text-emerald-600"
                                  : (ct.rate ?? 0) >= 40
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {ct.rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* Student consent lookup */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Student Consent Lookup</h2>
            <p className="text-xs text-gray-400 mt-0.5">Enter a student user ID to view their consent records.</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex gap-2">
              <input
                type="number"
                value={lookupStudentId}
                onChange={(e) => setLookupStudentId(e.target.value)}
                placeholder="Student user ID"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading || !lookupStudentId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Lookup
              </button>
            </div>

            <AnimatePresence>
              {showLookup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-2"
                >
                  {lookupRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No records found.</p>
                  ) : (
                    lookupRecords.map((rec) => {
                      const meta = FEATURE_META[rec.consent_type];
                      return (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100"
                        >
                          <div className={`flex items-center gap-2 ${meta?.color ?? "text-gray-600"}`}>
                            {meta?.icon}
                            <span className="text-sm font-medium text-gray-700">
                              {meta?.label ?? rec.consent_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${
                                rec.status === "granted"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : rec.status === "refused"
                                  ? "bg-red-100 text-red-700"
                                  : rec.status === "withdrawn"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {rec.status}
                            </span>
                            {rec.updated_at && (
                              <span className="text-gray-400">
                                {new Date(rec.updated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Audit log viewer */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition text-sm font-medium text-gray-700"
            onClick={() => setShowAudit((p) => !p)}
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Audit Log Viewer
            </span>
            {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showAudit && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4">
                  <div className="flex gap-2 mb-4">
                    <input
                      type="number"
                      value={auditStudentId}
                      onChange={(e) => setAuditStudentId(e.target.value)}
                      placeholder="Student user ID"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <button
                      onClick={handleAuditSearch}
                      disabled={auditLoading || !auditStudentId}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
                    >
                      {auditLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      Search
                    </button>
                  </div>

                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Enter a student ID and click Search to view their audit history.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div
                          key={log.log_id}
                          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                        >
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${
                              ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {log.action}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-700">
                                Consent #{log.consent_id}
                              </span>
                              {log.previous_status && log.new_status && (
                                <span className="text-gray-400">
                                  {log.previous_status} → {log.new_status}
                                </span>
                              )}
                            </div>
                            {log.timestamp && (
                              <p className="text-gray-400 mt-0.5">
                                {new Date(log.timestamp).toLocaleString()}
                                {log.ip_address && ` · ${log.ip_address}`}
                              </p>
                            )}
                            {log.notes && <p className="text-gray-500 mt-0.5 italic">{log.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
