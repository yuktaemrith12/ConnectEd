import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  Calendar,
  Clock,
  Info,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router";
import { getTeacherTimetable, TimetableEntryOut } from "@/app/utils/api";

type ClassStatus = "upcoming" | "inprogress" | "completed";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function computeStatus(e: TimetableEntryOut): ClassStatus {
  if (!e.start_time || !e.end_time) return "upcoming";
  const now = new Date();
  const [sh, sm] = e.start_time.split(":").map(Number);
  const [eh, em] = e.end_time.split(":").map(Number);
  const start = new Date(); start.setHours(sh, sm, 0, 0);
  const end = new Date(); end.setHours(eh, em, 0, 0);
  if (now > end) return "completed";
  if (now >= start && now <= end) return "inprogress";
  return "upcoming";
}

export default function TeacherTimetable() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimetableEntryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getTeacherTimetable({ view: "week" })
      .then(setEntries)
      .catch(() => setError("Failed to load timetable."))
      .finally(() => setLoading(false));
  }, []);

  const getWeekLabel = () => {
    if (weekOffset === 0) return "Current Week";
    if (weekOffset === -1) return "Previous Week";
    if (weekOffset === 1) return "Next Week";
    return `Week ${weekOffset > 0 ? "+" : ""}${weekOffset}`;
  };

  const getClassesForDay = (dayName: string) =>
    entries
      .filter((e) => e.day === dayName)
      .sort((a, b) => (a.time_slot || "").localeCompare(b.time_slot || ""));

  const totalClasses = entries.length;
  const onlineClasses = entries.filter((e) => e.delivery_mode === "ONLINE" || !!e.online_link).length;
  const onsiteClasses = totalClasses - onlineClasses;
  const recordingsAvailable = entries.filter(
    (e) => computeStatus(e) === "completed" && !!e.online_link
  ).length;

  const getStatusBadge = (status: ClassStatus) => {
    switch (status) {
      case "upcoming":
        return (
          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            Upcoming
          </span>
        );
      case "inprogress":
        return (
          <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            In progress
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Completed
          </span>
        );
    }
  };

  const renderClassCard = (entry: TimetableEntryOut) => {
    const isOnline = entry.delivery_mode === "ONLINE" || !!entry.online_link;
    const status = computeStatus(entry);
    const timeLabel = entry.start_time && entry.end_time
      ? `${entry.start_time} - ${entry.end_time}`
      : entry.time_slot;
    const locationLabel = entry.location_name || entry.room || "On-site";

    return (
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(139, 92, 246, 0.15)" }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-purple-200 transition-all overflow-hidden group"
      >
        {/* Accent Line */}
        <motion.div
          className={`absolute left-0 top-0 bottom-0 w-1 ${isOnline ? "bg-purple-500" : "bg-gray-300"
            }`}
          initial={{ scaleY: 1 }}
          whileHover={{ scaleY: 1.05 }}
        />

        <div className="space-y-3 ml-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 text-sm truncate">
                {entry.subject_name}
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">{entry.class_name}</p>
            </div>
            {getStatusBadge(status)}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock size={13} className="text-gray-400" />
            <span className="font-medium">{timeLabel}</span>
          </div>

          {/* Delivery Mode */}
          <div className="flex items-center gap-1.5 text-xs">
            {isOnline ? (
              <>
                <Video size={13} className="text-purple-500" />
                <span className="text-gray-700">
                  <span className="font-semibold text-purple-700">Online</span> · Recording enabled
                </span>
              </>
            ) : (
              <>
                <MapPin size={13} className="text-gray-400" />
                <span className="text-gray-500">
                  <span className="font-semibold text-gray-700">{locationLabel}</span> · Not recorded
                </span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            {(status === "upcoming" || status === "inprogress") && (
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    navigate(
                      `/teacher/video-conference?classId=${entry.class_id}&subjectId=${entry.subject_id}`
                    )
                  }
                  className="flex-1 px-3 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md transition-shadow text-center"
                >
                  Start Class
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    navigate(`/teacher/attendance?classId=${entry.class_id}`)
                  }
                  className="flex-1 px-3 py-2.5 border-2 border-purple-300 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Mark Attendance
                </motion.button>
              </div>
            )}

            {status === "completed" && (
              <div className="flex gap-2">
                {isOnline && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    View Recording
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/teacher/attendance?classId=${entry.class_id}`)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Attendance
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-purple-500" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Teaching Timetable
            </h1>
            <p className="text-gray-600">
              Manage your scheduled classes and delivery mode
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Week Selector */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm">
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: "#f9fafb" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="p-2.5 rounded-l-xl transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-600" />
              </motion.button>
              <div className="px-6 py-2 min-w-[140px] text-center border-x border-gray-200">
                <span className="text-sm font-semibold text-gray-700">
                  {getWeekLabel()}
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: "#f9fafb" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-2.5 rounded-r-xl transition-colors"
              >
                <ChevronRight size={18} className="text-gray-600" />
              </motion.button>
            </div>

            {/* Info Label */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="p-1 bg-purple-50 rounded">
                <Info size={12} className="text-purple-500" />
              </div>
              <span>Online classes are recorded automatically</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {entries.length === 0 && !error && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No timetable published yet
              </h3>
              <p className="text-sm text-gray-500">
                Your admin hasn't published any timetable sessions assigned to you.
              </p>
            </div>
          </div>
        )}

        {/* Timetable Grid */}
        {weekOffset === 0 && entries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-200 p-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              {days.map((day) => {
                const dayClasses = getClassesForDay(day);
                return (
                  <div key={day} className="space-y-4">
                    {/* Day Header */}
                    <div className="pb-3 border-b-2 border-purple-200">
                      <h3 className="font-bold text-gray-900">{day}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {dayClasses.length} class{dayClasses.length !== 1 ? "es" : ""}
                      </p>
                    </div>

                    {/* Classes */}
                    <div className="space-y-3">
                      {dayClasses.length > 0 ? (
                        dayClasses.map((entry) =>
                          renderClassCard(entry)
                        )
                      ) : (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center">
                          <Calendar
                            size={32}
                            className="mx-auto text-gray-300 mb-2"
                          />
                          <p className="text-xs text-gray-400">
                            No classes
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : weekOffset !== 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-200 p-16 text-center"
          >
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {weekOffset > 0
                  ? "Upcoming sessions will appear here"
                  : "No classes scheduled for this week"}
              </h3>
              <p className="text-sm text-gray-500">
                Switch back to the current week to view your timetable
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* Summary Strip */}
        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-purple-500 rounded-full" />
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Weekly Summary
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Total Classes</p>
                <p className="text-3xl font-bold text-gray-900">{totalClasses}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-purple-600 font-medium">Online Sessions</p>
                <p className="text-3xl font-bold text-purple-600">{onlineClasses}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">On-site Sessions</p>
                <p className="text-3xl font-bold text-gray-900">{onsiteClasses}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-purple-600 font-medium">Recordings Available</p>
                <p className="text-3xl font-bold text-purple-600">{recordingsAvailable}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
