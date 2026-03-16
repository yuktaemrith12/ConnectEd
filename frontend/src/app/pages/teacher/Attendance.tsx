import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import { ClipboardList, User, CheckCircle, XCircle, Clock, BookOpen, Lock, ChevronDown, ChevronUp } from "lucide-react";
import {
  AttendanceSessionDetail, StudentAttendanceRow,
  teacherGetMyClasses, teacherOpenSession,
  teacherMarkAttendance, teacherCloseSession,
} from "@/app/utils/api";

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type Status = typeof STATUS_OPTIONS[number];

const STATUS_STYLES: Record<Status, string> = {
  PRESENT: "bg-green-100 text-green-700 ring-green-300",
  ABSENT:  "bg-red-100   text-red-700   ring-red-300",
  LATE:    "bg-yellow-100 text-yellow-700 ring-yellow-300",
  EXCUSED: "bg-blue-100  text-blue-700  ring-blue-300",
};

const STATUS_ICONS: Record<Status, React.ReactNode> = {
  PRESENT: <CheckCircle size={12} />,
  ABSENT:  <XCircle    size={12} />,
  LATE:    <Clock      size={12} />,
  EXCUSED: <BookOpen   size={12} />,
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export default function TeacherAttendance() {
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [session, setSession] = useState<AttendanceSessionDetail | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<number, Status | null>>({});
  const [localNotes, setLocalNotes] = useState<Record<number, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    teacherGetMyClasses()
      .then((cls) => {
        setClasses(cls);
        if (cls.length > 0) setSelectedClassId(cls[0].id);
      })
      .catch(() => setError("Failed to load classes."));
  }, []);

  function initLocal(detail: AttendanceSessionDetail) {
    const s: Record<number, Status | null> = {};
    const n: Record<number, string> = {};
    detail.roster.forEach((row) => {
      s[row.student_id] = (row.status as Status | null) ?? null;
      n[row.student_id] = row.note ?? "";
    });
    setLocalStatus(s);
    setLocalNotes(n);
  }

  async function handleOpenSession() {
    if (!selectedClassId) return;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const detail = await teacherOpenSession(selectedClassId, selectedDate);
      setSession(detail);
      initLocal(detail);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(errMsg ?? "Failed to open session.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    setError("");
    try {
      const records = session.roster.map((row) => ({
        student_id: row.student_id,
        status: localStatus[row.student_id] ?? "ABSENT",
        note: localNotes[row.student_id] || undefined,
      }));
      const updated = await teacherMarkAttendance(session.session_id, records);
      setSession(updated);
      initLocal(updated);
      setMsg("Attendance saved.");
      setTimeout(() => setMsg(""), 3000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!session) return;
    if (!window.confirm("Close this session? All unmarked students will be marked Absent.")) return;
    setClosing(true);
    setError("");
    try {
      const updated = await teacherCloseSession(session.session_id);
      setSession(updated);
      initLocal(updated);
      setMsg("Session closed.");
      setTimeout(() => setMsg(""), 4000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Close failed.");
    } finally {
      setClosing(false);
    }
  }

  function markAll(status: Status) {
    if (!session) return;
    const next: Record<number, Status | null> = {};
    session.roster.forEach((r) => { next[r.student_id] = status; });
    setLocalStatus(next);
  }

  const isClosed = session?.status === "CLOSED";

  const counts = session
    ? STATUS_OPTIONS.reduce((acc, s) => {
        acc[s] = session.roster.filter((r) => (localStatus[r.student_id] ?? null) === s).length;
        return acc;
      }, {} as Record<Status, number>)
    : null;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendance</h1>
          <p className="text-gray-600">Mark and manage class attendance sessions</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-600 mb-1">Class</label>
              <select
                value={selectedClassId ?? ""}
                onChange={(e) => { setSelectedClassId(Number(e.target.value)); setSession(null); setError(""); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none text-sm"
              >
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSession(null); setError(""); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none text-sm"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleOpenSession}
              disabled={loading || !selectedClassId}
              className="px-5 py-2 bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] text-white rounded-xl font-medium shadow text-sm disabled:opacity-60"
            >
              {loading ? "Loading…" : session ? "Reload Session" : "Open Session"}
            </motion.button>
          </div>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </motion.div>
          )}
          {msg && (
            <motion.div key="msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session Panel */}
        {session && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4">

            {/* Session info bar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ClipboardList size={20} className="text-purple-500" />
                <div>
                  <p className="font-semibold text-gray-800">{session.subject_name} — {session.class_name}</p>
                  <p className="text-xs text-gray-500">{session.session_date} · {session.delivery_mode}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isClosed ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
              }`}>
                {isClosed ? <span className="flex items-center gap-1"><Lock size={10}/>CLOSED</span> : "OPEN"}
              </span>
            </div>

            {/* Summary counts + bulk actions */}
            {counts && (
              <div className="flex flex-wrap gap-3 items-center">
                {STATUS_OPTIONS.map((s) => (
                  <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ${STATUS_STYLES[s]}`}>
                    {STATUS_ICONS[s]} {s}: {counts[s]}
                  </div>
                ))}
                {!isClosed && (
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => markAll("PRESENT")}
                      className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium">
                      All Present
                    </button>
                    <button onClick={() => markAll("ABSENT")}
                      className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium">
                      All Absent
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Roster table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {session.roster.map((row: StudentAttendanceRow, idx) => {
                    const cur = localStatus[row.student_id] ?? null;
                    const noteExp = expandedNotes[row.student_id] ?? false;
                    return (
                      <tr key={row.student_id} className={`border-b border-gray-50 ${idx % 2 ? "bg-gray-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                              <User size={14} className="text-purple-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-800">{row.student_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{row.student_code}</td>
                        <td className="px-4 py-3">
                          {isClosed ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ring-1 ${cur ? STATUS_STYLES[cur as Status] : "bg-gray-100 text-gray-500 ring-gray-200"}`}>
                              {cur ?? "—"}
                            </span>
                          ) : (
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((s) => (
                                <button key={s}
                                  onClick={() => setLocalStatus((p) => ({ ...p, [row.student_id]: s }))}
                                  title={s}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold ring-1 transition-all ${
                                    cur === s
                                      ? STATUS_STYLES[s] + " scale-105"
                                      : "bg-gray-100 text-gray-500 ring-gray-200 hover:bg-gray-200"
                                  }`}
                                >
                                  {s[0]}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          {isClosed ? (
                            <span className="text-xs text-gray-500">{localNotes[row.student_id] || "—"}</span>
                          ) : (
                            <div>
                              <button onClick={() => setExpandedNotes((p) => ({ ...p, [row.student_id]: !noteExp }))}
                                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                                {noteExp ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                {localNotes[row.student_id] ? "Edit note" : "Add note"}
                              </button>
                              {noteExp && (
                                <input type="text"
                                  value={localNotes[row.student_id] ?? ""}
                                  onChange={(e) => setLocalNotes((p) => ({ ...p, [row.student_id]: e.target.value }))}
                                  placeholder="Optional note…"
                                  className="mt-1 w-full text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            {!isClosed && (
              <div className="flex gap-3 justify-end">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] text-white rounded-xl font-medium shadow text-sm disabled:opacity-60">
                  {saving ? "Saving…" : "Save Attendance"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleClose} disabled={closing}
                  className="px-5 py-2 bg-gray-800 text-white rounded-xl font-medium shadow text-sm disabled:opacity-60">
                  {closing ? "Closing…" : "Close Session"}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {!session && !loading && !error && (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Select a class and date, then click <strong>Open Session</strong> to begin.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
