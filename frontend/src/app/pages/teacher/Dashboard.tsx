import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Clock, FileText, GraduationCap, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import StatCard from "@/app/components/shared/StatCard";
import {
  getTeacherTimetable,
  teacherGetAssignments,
  teacherGetStats,
  type TimetableEntryOut,
  type AssignmentRead,
  type TeacherStats,
} from "@/app/utils/api";

export default function TeacherDashboard() {
  const [todayEntries, setTodayEntries] = useState<TimetableEntryOut[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<AssignmentRead[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setLoading(true);
    Promise.all([
      getTeacherTimetable({ view: "day", date: todayStr }),
      teacherGetAssignments(),
      teacherGetStats(),
    ])
      .then(([entries, assignments, s]) => {
        setTodayEntries(entries);
        setPendingAssignments(
          assignments.filter(
            (a) =>
              (a.status === "ACTIVE" || a.status === "CLOSED") &&
              a.submission_count > a.graded_count
          )
        );
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pendingTotal = pendingAssignments.reduce(
    (sum, a) => sum + (a.submission_count - a.graded_count),
    0
  );

  function formatDue(due: string | null): { label: string; color: string } {
    if (!due) return { label: "No date", color: "bg-gray-100 text-gray-600" };
    const d = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { label: "Overdue", color: "bg-red-100 text-red-700" };
    if (diff === 0) return { label: "Today", color: "bg-orange-100 text-orange-700" };
    if (diff === 1) return { label: "Tomorrow", color: "bg-yellow-100 text-yellow-700" };
    return {
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      color: "bg-blue-100 text-blue-700",
    };
  }

  const userName = localStorage.getItem("user_full_name") ?? "Teacher";

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
          <p className="text-gray-600">Welcome back, {userName.split(" ")[0]}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Today's Classes"
            value={loading ? "—" : String(todayEntries.length)}
            icon={Clock}
            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            title="Pending Grading"
            value={loading ? "—" : String(pendingTotal)}
            icon={FileText}
            gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          />
          <StatCard
            title="Total Students"
            value={loading ? "—" : String(stats?.total_students ?? 0)}
            icon={GraduationCap}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            title="Avg. Attendance"
            value={loading ? "—" : `${stats?.avg_attendance_rate ?? 0}%`}
            icon={CheckCircle2}
            gradient="bg-gradient-to-br from-green-500 to-green-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Today's Schedule</h3>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : todayEntries.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No classes scheduled today.</p>
            ) : (
              <div className="space-y-3">
                {todayEntries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    whileHover={{ x: 4 }}
                    className="p-4 bg-gradient-to-r from-purple-50 to-transparent rounded-xl border-l-4 border-purple-500"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{entry.subject_name ?? "—"}</p>
                        <p className="text-sm text-gray-600">{entry.class_name ?? "—"}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium whitespace-nowrap">
                        {entry.start_time
                          ? entry.start_time.slice(0, 5)
                          : (entry.time_slot ?? "—")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {entry.location_name
                        ? <span>{entry.location_name}</span>
                        : entry.room
                        ? <span>{entry.room}</span>
                        : null}
                      {entry.delivery_mode && (
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            entry.delivery_mode === "ONLINE"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {entry.delivery_mode === "ONLINE" ? "Online" : "On-site"}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Pending Grading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pending Grading</h3>
              <AlertCircle size={20} className="text-orange-500" />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : pendingAssignments.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">All caught up — nothing to grade!</p>
            ) : (
              <div className="space-y-3">
                {pendingAssignments.slice(0, 5).map((item) => {
                  const { label, color } = formatDue(item.due_at);
                  const pending = item.submission_count - item.graded_count;
                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ x: 4 }}
                      className="p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs text-gray-600">{item.class_name ?? "—"}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{item.submission_count} submitted</span>
                        <span>•</span>
                        <span className="text-orange-600 font-medium">{pending} ungraded</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-8 text-white"
        >
          <h3 className="text-xl font-bold mb-6">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.a
              href="/teacher/attendance"
              whileHover={{ scale: 1.02, y: -2 }}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl p-4 text-left transition-all border border-white/20"
            >
              <CheckCircle2 size={24} className="mb-3" />
              <p className="font-medium">Mark Attendance</p>
              <p className="text-sm text-white/80 mt-1">Record today's attendance</p>
            </motion.a>
            <motion.a
              href="/teacher/homework"
              whileHover={{ scale: 1.02, y: -2 }}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl p-4 text-left transition-all border border-white/20"
            >
              <FileText size={24} className="mb-3" />
              <p className="font-medium">Post Homework</p>
              <p className="text-sm text-white/80 mt-1">Create new homework</p>
            </motion.a>
            <motion.a
              href="/teacher/grading"
              whileHover={{ scale: 1.02, y: -2 }}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl p-4 text-left transition-all border border-white/20"
            >
              <GraduationCap size={24} className="mb-3" />
              <p className="font-medium">Grade Submissions</p>
              <p className="text-sm text-white/80 mt-1">Review pending work</p>
            </motion.a>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
