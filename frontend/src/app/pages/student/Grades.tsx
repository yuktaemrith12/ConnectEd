import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Award, TrendingUp, TrendingDown, Eye, X, BarChart3, Star, Loader2, FileCheck,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { studentGetAssignments, AssignmentRead } from "@/app/utils/api";

// ── helpers ───────────────────────────────────────────────────────────────────

function letterGrade(pct: number): string {
  if (pct >= 97) return "A+";
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 60) return "D";
  return "F";
}

function gradeCls(pct: number): string {
  if (pct >= 90) return "bg-green-100 text-green-700";
  if (pct >= 80) return "bg-blue-100 text-blue-700";
  if (pct >= 70) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StudentGrades() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AssignmentRead | null>(null);

  useEffect(() => {
    studentGetAssignments()
      .then(setAssignments)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  // Only show published grades
  const graded = assignments.filter(
    a => a.submission?.status === "PUBLISHED" && a.submission?.grade !== null,
  );

  // ── Derived stats ──────────────────────────────────────────────────────────

  const avgPct = graded.length > 0
    ? Math.round(
      graded.reduce((sum, a) => sum + ((a.submission!.grade! / a.max_score) * 100), 0) /
      graded.length,
    )
    : 0;

  // Per-subject aggregates
  const subjectMap: Record<string, { total: number; count: number }> = {};
  for (const a of graded) {
    const subj = a.subject_name ?? "Other";
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0 };
    subjectMap[subj].total += (a.submission!.grade! / a.max_score) * 100;
    subjectMap[subj].count++;
  }
  const subjectStats = Object.entries(subjectMap)
    .map(([subject, { total, count }]) => ({ subject, grade: Math.round(total / count) }))
    .sort((a, b) => b.grade - a.grade);

  const bestSubject = subjectStats[0] ?? null;
  const worstSubject = subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : null;

  // Monthly progress (use submitted_at, fallback due_at)
  const monthMap: Record<string, { total: number; count: number; ts: number }> = {};
  for (const a of graded) {
    const raw = a.submission?.submitted_at ?? a.due_at;
    if (!raw) continue;
    const d = new Date(raw);
    const key = d.toLocaleDateString("en-GB", { month: "short" }) + " " + d.getFullYear().toString().slice(2);
    if (!monthMap[key]) monthMap[key] = { total: 0, count: 0, ts: d.getTime() };
    monthMap[key].total += (a.submission!.grade! / a.max_score) * 100;
    monthMap[key].count++;
  }
  const monthlyData = Object.entries(monthMap)
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([month, { total, count }]) => ({ month, average: Math.round(total / count) }));

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <DashboardLayout role="student">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    </DashboardLayout>
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  if (graded.length === 0) return (
    <DashboardLayout role="student">
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">My Grades</h1>
          <p className="text-sm text-gray-500">Track your academic performance</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <FileCheck size={56} className="mb-4 opacity-25" />
          <p className="text-lg font-medium">No grades released yet</p>
          <p className="text-sm mt-1">Your teacher will publish grades once assignments are reviewed.</p>
        </div>
      </div>
    </DashboardLayout>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-1">My Grades</h1>
          <p className="text-sm text-gray-500">
            {graded.length} graded assignment{graded.length !== 1 ? "s" : ""} · overall average {avgPct}%
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Graded count */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-blue-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Award className="text-blue-600" size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm">Graded Assignments</p>
            <p className="text-3xl font-bold mt-1">{graded.length}</p>
          </motion.div>

          {/* Average score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }} whileHover={{ y: -4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-green-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <BarChart3 className="text-green-600" size={24} />
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${gradeCls(avgPct)}`}>
                {letterGrade(avgPct)}
              </span>
            </div>
            <p className="text-gray-500 text-sm">Average Score</p>
            <p className="text-3xl font-bold mt-1">{avgPct}%</p>
          </motion.div>

          {/* Best subject */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }} whileHover={{ y: -4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-purple-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Star className="text-purple-600" size={24} />
              </div>
              {bestSubject && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp size={15} />
                </div>
              )}
            </div>
            <p className="text-gray-500 text-sm">Best Subject</p>
            {bestSubject ? (
              <>
                <p className="text-xl font-bold mt-1 truncate">{bestSubject.subject}</p>
                <p className="text-sm text-gray-400 mt-0.5">{bestSubject.grade}% average</p>
              </>
            ) : (
              <p className="text-gray-400 mt-1 text-sm">—</p>
            )}
          </motion.div>

          {/* Needs improvement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }} whileHover={{ y: -4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-amber-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <TrendingDown className="text-amber-600" size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm">Needs Improvement</p>
            {worstSubject ? (
              <>
                <p className="text-xl font-bold mt-1 truncate">{worstSubject.subject}</p>
                <p className="text-sm text-gray-400 mt-0.5">{worstSubject.grade}% average</p>
              </>
            ) : (
              <p className="text-gray-400 mt-1 text-sm">—</p>
            )}
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Progress over time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <h3 className="text-base font-bold mb-4">Progress Over Time</h3>
            {monthlyData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "11px" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(v: number) => [`${v}%`, "Average"]}
                  />
                  <Line
                    type="monotone" dataKey="average" stroke="#3b82f6" strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[240px] text-gray-300">
                <BarChart3 size={40} className="mb-2" />
                <p className="text-sm">More data needed to show trend</p>
              </div>
            )}
          </motion.div>

          {/* Subject performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <h3 className="text-base font-bold mb-4">Subject Performance</h3>
            {subjectStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={subjectStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="subject" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "11px" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(v: number) => [`${v}%`, "Average"]}
                  />
                  <Bar dataKey="grade" radius={[6, 6, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-gray-300">
                <p className="text-sm">No data yet</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Subject summary cards */}
        {subjectStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
          >
            {subjectStats.map(s => (
              <div
                key={s.subject}
                className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-4 border border-blue-100"
              >
                <p className="text-xs font-semibold text-gray-500 truncate mb-2">{s.subject}</p>
                <p className="text-2xl font-bold text-blue-600">{s.grade}%</p>
                <p className="text-xs text-gray-400 mt-0.5">{letterGrade(s.grade)}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Detailed grade table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-base">Detailed Grades</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignment</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {graded.map(a => {
                  const pct = Math.round((a.submission!.grade! / a.max_score) * 100);
                  const ltr = letterGrade(pct);
                  return (
                    <motion.tr
                      key={a.id}
                      whileHover={{ backgroundColor: "#f9fafb" }}
                      className="transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.subject_name ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{a.title}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-semibold text-gray-900 text-sm">
                          {a.submission!.grade!} / {a.max_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${gradeCls(pct)}`}>
                          {ltr}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {fmtDate(a.submission?.submitted_at ?? a.due_at)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {a.submission?.feedback ? (
                          <button
                            onClick={() => navigate("/student/assignments")}
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View in Assignments"
                          >
                            <Eye size={17} className="text-blue-600" />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Feedback modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Teacher Feedback</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selected.subject_name} · {selected.title}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Score summary */}
              <div className="px-6 pt-5">
                {(() => {
                  const pct = Math.round((selected.submission!.grade! / selected.max_score) * 100);
                  return (
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="p-3 bg-blue-50 rounded-xl text-center">
                        <p className="text-xs text-gray-500 mb-1">Score</p>
                        <p className="text-xl font-bold text-blue-600">
                          {selected.submission!.grade!} <span className="text-sm font-normal text-blue-400">/ {selected.max_score}</span>
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-xl text-center">
                        <p className="text-xs text-gray-500 mb-1">Grade</p>
                        <p className="text-xl font-bold text-green-600">{letterGrade(pct)}</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-xl text-center">
                        <p className="text-xs text-gray-500 mb-1">Percentage</p>
                        <p className="text-xl font-bold text-purple-600">{pct}%</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Feedback text */}
              <div className="px-6 pb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Teacher Comments</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {selected.submission!.feedback}
                  </p>
                  {selected.teacher_name && (
                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200">
                      From: <span className="font-medium text-gray-600">{selected.teacher_name}</span>
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
