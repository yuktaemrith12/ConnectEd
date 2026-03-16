import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion } from "motion/react";
import { useParams } from "react-router";
import { CheckCircle, XCircle, Clock, BookOpen, BarChart3, Calendar } from "lucide-react";
import { StudentAttendanceSummary, StudentSessionRecord, getParentChildAttendance } from "@/app/utils/api";

const STATUS_CHIP: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100   text-red-700",
  LATE: "bg-yellow-100 text-yellow-700",
  EXCUSED: "bg-blue-100  text-blue-700",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PRESENT: <CheckCircle size={12} />,
  ABSENT: <XCircle size={12} />,
  LATE: <Clock size={12} />,
  EXCUSED: <BookOpen size={12} />,
};

export default function ParentAttendance() {
  const { childId } = useParams<{ childId: string }>();
  const studentId = Number(childId ?? "0");

  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    getParentChildAttendance(studentId)
      .then(setSummary)
      .catch((err) => {
        if (err?.response?.status === 403) {
          setError("This child is not linked to your account. Please check with your administrator.");
        } else {
          setError("Failed to load attendance.");
        }
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      </DashboardLayout>
    );
  }

  const stats = summary ? [
    { label: "Overall Attendance", value: `${summary.attendance_rate}%`, icon: BarChart3, color: "from-green-500 to-green-400" },
    { label: "Total Sessions", value: summary.total_sessions, icon: Calendar, color: "from-teal-500  to-teal-400" },
    { label: "Present", value: summary.present_count, icon: CheckCircle, color: "from-emerald-500 to-emerald-400" },
    { label: "Absent / Late", value: summary.absent_count + summary.late_count, icon: XCircle, color: "from-red-500 to-red-400" },
  ] : [];

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendance</h1>
          <p className="text-gray-600">Your child's session-by-session attendance record</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Rate bar */}
        {summary && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold text-gray-700">Attendance Rate</p>
              <p className="text-green-600 font-bold">{summary.attendance_rate}%</p>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.attendance_rate}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
              {[
                { label: "Present", count: summary.present_count, color: "bg-green-500" },
                { label: "Absent", count: summary.absent_count, color: "bg-red-500" },
                { label: "Late", count: summary.late_count, color: "bg-yellow-500" },
                { label: "Excused", count: summary.excused_count, color: "bg-blue-500" },
                { label: "Unmarked", count: summary.unmarked_count, color: "bg-gray-400" },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  {item.label}: {item.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent sessions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recent Sessions</h2>
          </div>
          {!summary || summary.recent.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No sessions recorded yet.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mode</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent.map((rec: StudentSessionRecord, idx) => (
                  <tr key={idx} className={`border-t border-gray-50 ${idx % 2 ? "bg-gray-50/30" : ""}`}>
                    <td className="px-5 py-3 text-sm text-gray-700">{rec.session_date}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{rec.subject_name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{rec.time_slot}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${rec.delivery_mode === "ONLINE" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                        }`}>
                        {rec.delivery_mode}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {rec.status ? (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${STATUS_CHIP[rec.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_ICON[rec.status]} {rec.status}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{rec.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
