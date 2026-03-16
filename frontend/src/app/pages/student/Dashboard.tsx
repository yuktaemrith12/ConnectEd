import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import StatCard from "@/app/components/shared/StatCard";
import { Clock, FileText, BarChart3, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import {
  getStudentTimetable,
  studentGetHomework,
  getStudentAttendanceSummary,
  studentGetAssignments,
  type TimetableEntryOut,
  type HomeworkRead,
  type StudentAttendanceSummary,
  type AssignmentRead,
} from "@/app/utils/api";

function scoreToGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export default function StudentDashboard() {
  const [todayEntries, setTodayEntries] = useState<TimetableEntryOut[]>([]);
  const [homeworkList, setHomeworkList] = useState<HomeworkRead[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceSummary | null>(null);
  const [gradedAssignments, setGradedAssignments] = useState<AssignmentRead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setLoading(true);
    Promise.all([
      getStudentTimetable({ view: "day", date: todayStr }),
      studentGetHomework(),
      getStudentAttendanceSummary(),
      studentGetAssignments(),
    ])
      .then(([entries, hw, att, assignments]) => {
        setTodayEntries(entries);
        const pending = hw
          .filter((h) => h.status === "PUBLISHED" && !h.is_done)
          .sort((a, b) => {
            if (!a.due_at) return 1;
            if (!b.due_at) return -1;
            return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
          });
        setHomeworkList(pending);
        setAttendance(att);
        const graded = assignments
          .filter(
            (a) =>
              a.submission &&
              (a.submission.status === "GRADED" || a.submission.status === "PUBLISHED") &&
              a.submission.grade !== null
          )
          .sort((a, b) => {
            const da = a.submission?.updated_at ?? a.updated_at ?? "";
            const db2 = b.submission?.updated_at ?? b.updated_at ?? "";
            return db2.localeCompare(da);
          });
        setGradedAssignments(graded);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const overallGrade = (() => {
    const valid = gradedAssignments.filter(
      (a) => a.submission?.grade !== null && a.max_score > 0
    );
    if (valid.length === 0) return "—";
    const avg =
      valid.reduce((sum, a) => sum + ((a.submission!.grade! / a.max_score) * 100), 0) /
      valid.length;
    return scoreToGrade(avg);
  })();

  function formatDue(due: string | null): { label: string; color: string } {
    if (!due) return { label: "No date", color: "bg-gray-100 text-gray-600" };
    const d = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { label: "Overdue", color: "bg-red-100 text-red-700" };
    if (diff === 0) return { label: "Due Today", color: "bg-orange-100 text-orange-700" };
    if (diff === 1) return { label: "Tomorrow", color: "bg-yellow-100 text-yellow-700" };
    return {
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      color: "bg-blue-100 text-blue-700",
    };
  }

  const userName = localStorage.getItem("user_full_name") ?? "Student";

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
          <p className="text-gray-600">Welcome back, {userName.split(" ")[0]}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Classes Today"
            value={loading ? "—" : String(todayEntries.length)}
            icon={Clock}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            title="Pending Homework"
            value={loading ? "—" : String(homeworkList.length)}
            icon={FileText}
            gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          />
          <StatCard
            title="Attendance"
            value={loading ? "—" : `${attendance?.attendance_rate ?? 0}%`}
            icon={CheckCircle2}
            gradient="bg-gradient-to-br from-green-500 to-green-600"
          />
          <StatCard
            title="Overall Grade"
            value={loading ? "—" : overallGrade}
            icon={BarChart3}
            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Timetable */}
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
                    className="p-4 bg-gradient-to-r from-blue-50 to-transparent rounded-xl border-l-4 border-blue-500"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{entry.subject_name ?? "—"}</p>
                        <p className="text-sm text-gray-600">{entry.teacher_name ?? "—"}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium whitespace-nowrap">
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

          {/* Pending Homework */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Pending Homework</h3>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : homeworkList.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">All homework is done!</p>
            ) : (
              <div className="space-y-3">
                {homeworkList.slice(0, 5).map((hw) => {
                  const { label, color } = formatDue(hw.due_at);
                  return (
                    <motion.div
                      key={hw.id}
                      whileHover={{ x: 4 }}
                      className="p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{hw.title}</p>
                          <p className="text-xs text-gray-600">{hw.subject_name ?? "—"}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
                          {label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Latest Grades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 text-white"
        >
          <h3 className="text-xl font-bold mb-4">Latest Grades</h3>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-white/70">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : gradedAssignments.length === 0 ? (
            <p className="text-white/80 text-sm">No graded assignments yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gradedAssignments.slice(0, 3).map((a) => {
                const grade = a.submission!.grade!;
                const pct = Math.round((grade / a.max_score) * 100);
                const letter = scoreToGrade(pct);
                return (
                  <div key={a.id} className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                    <p className="text-sm mb-1 truncate">{a.title}</p>
                    <p className="text-xs text-white/70 mb-2">{a.subject_name ?? "—"}</p>
                    <p className="text-3xl font-bold">{pct}%</p>
                    <p className="text-xs text-white/80 mt-1">
                      {grade} / {a.max_score} · Grade {letter}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
