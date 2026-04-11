import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  User,
  Clock,
  X,
  CheckCircle,
  Loader2,
  Wifi,
  ExternalLink,
  RadioTower,
} from "lucide-react";
import {
  getStudentTimetable,
  videoGetActiveMeetings,
  type TimetableEntryOut,
  type MeetingRead,
} from "@/app/utils/api";

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

// Subtle pastel tints for weekly grid cells
const SUBJECT_TINTS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Mathematics:         { bg: "bg-blue-50",   border: "border-blue-300",   text: "text-blue-800",   dot: "bg-blue-400" },
  Physics:             { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", dot: "bg-violet-400" },
  Chemistry:           { bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-800",  dot: "bg-amber-400" },
  "English Literature":{ bg: "bg-emerald-50",border: "border-emerald-300",text: "text-emerald-800",dot: "bg-emerald-400" },
  History:             { bg: "bg-rose-50",   border: "border-rose-300",   text: "text-rose-800",   dot: "bg-rose-400" },
  "Computer Science":  { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", dot: "bg-indigo-400" },
  Biology:             { bg: "bg-teal-50",   border: "border-teal-300",   text: "text-teal-800",   dot: "bg-teal-400" },
  Art:                 { bg: "bg-pink-50",   border: "border-pink-300",   text: "text-pink-800",   dot: "bg-pink-400" },
  Music:               { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-800", dot: "bg-yellow-400" },
};

const PALETTE: Array<{ bg: string; border: string; text: string; dot: string }> = [
  { bg: "bg-blue-50",   border: "border-blue-300",   text: "text-blue-800",   dot: "bg-blue-400" },
  { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", dot: "bg-violet-400" },
  { bg: "bg-emerald-50",border: "border-emerald-300",text: "text-emerald-800",dot: "bg-emerald-400" },
  { bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-800",  dot: "bg-amber-400" },
  { bg: "bg-rose-50",   border: "border-rose-300",   text: "text-rose-800",   dot: "bg-rose-400" },
  { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", dot: "bg-indigo-400" },
  { bg: "bg-teal-50",   border: "border-teal-300",   text: "text-teal-800",   dot: "bg-teal-400" },
  { bg: "bg-pink-50",   border: "border-pink-300",   text: "text-pink-800",   dot: "bg-pink-400" },
  { bg: "bg-cyan-50",   border: "border-cyan-300",   text: "text-cyan-800",   dot: "bg-cyan-400" },
  { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-400" },
];

function tintForSubject(name: string | null) {
  if (!name) return PALETTE[0];
  if (SUBJECT_TINTS[name]) return SUBJECT_TINTS[name];
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

function isOnline(e: TimetableEntryOut) {
  return e.delivery_mode === "ONLINE" || !!e.online_link;
}

type Status = "upcoming" | "ongoing" | "completed";

type ViewEntry = TimetableEntryOut & { status: Status; tint: ReturnType<typeof tintForSubject> };

function addStatus(e: TimetableEntryOut): ViewEntry {
  const tint = tintForSubject(e.subject_name);
  if (!e.start_time || !e.end_time) return { ...e, tint, status: "upcoming" };
  const now = new Date();
  const [sh, sm] = e.start_time.split(":").map(Number);
  const [eh, em] = e.end_time.split(":").map(Number);
  const start = new Date(); start.setHours(sh, sm, 0, 0);
  const end   = new Date(); end.setHours(eh, em, 0, 0);
  let status: Status = "upcoming";
  if (now > end) status = "completed";
  else if (now >= start) status = "ongoing";
  return { ...e, tint, status };
}

export default function StudentTimetable() {
  const navigate = useNavigate();
  const [view, setView] = useState<"daily" | "weekly">("weekly");
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().toLocaleDateString("en-GB", { weekday: "long" });
    return weekDays.includes(today) ? today : "Monday";
  });
  const [selectedClass, setSelectedClass] = useState<ViewEntry | null>(null);
  const [entries, setEntries] = useState<TimetableEntryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // keyed by subject_id — active meetings for this student's class
  const [activeMeetings, setActiveMeetings] = useState<Record<number, MeetingRead>>({});

  useEffect(() => {
    setLoading(true);
    setError("");
    getStudentTimetable({ view: "week" })
      .then((data) => {
        setEntries(data);
        // Fetch active live meetings for this class (all entries share the same class)
        const classId = data[0]?.class_id;
        if (classId) {
          videoGetActiveMeetings(classId)
            .then((meetings) => {
              const map: Record<number, MeetingRead> = {};
              meetings.forEach((m) => { map[m.subject_id] = m; });
              setActiveMeetings(map);
            })
            .catch(() => {});
        }
      })
      .catch(() => setError("Failed to load timetable."))
      .finally(() => setLoading(false));
  }, []);

  // Poll active meetings every 15 seconds while page is open
  useEffect(() => {
    const interval = setInterval(() => {
      const classId = entries[0]?.class_id;
      if (!classId) return;
      videoGetActiveMeetings(classId)
        .then((meetings) => {
          const map: Record<number, MeetingRead> = {};
          meetings.forEach((m) => { map[m.subject_id] = m; });
          setActiveMeetings(map);
        })
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [entries]);

  const activeMeetingsList = Object.values(activeMeetings);

  const viewEntries = useMemo(() => entries.map(addStatus), [entries]);

  const getTodayClasses = () =>
    viewEntries
      .filter((c) => c.day === selectedDay)
      .sort((a, b) => (a.time_slot || "").localeCompare(b.time_slot || ""));

  const getClassForSlot = (day: string, time: string) =>
    viewEntries.find((c) => c.day === day && c.time_slot === time);

  // Returns the active live meeting for a timetable entry (if teacher started one)
  function getLiveMeeting(entry: { subject_id: number }): MeetingRead | undefined {
    return activeMeetings[entry.subject_id];
  }

  // Renders the join button for daily view / modal
  function renderJoinButton(cs: ViewEntry, fullWidth = false) {
    const liveMeeting = getLiveMeeting(cs);
    const joinUrl = cs.online_join_url || cs.online_link;

    if (liveMeeting) {
      return (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(`/student/live/${liveMeeting.id}`)}
          className={`${fullWidth ? "w-full justify-center mt-3" : "shrink-0"} flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white shadow-lg shadow-blue-200 animate-pulse`}
        >
          <RadioTower size={16} />
          Join Live Class
        </motion.button>
      );
    }

    if (joinUrl && isOnline(cs)) {
      return (
        <motion.a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`${fullWidth ? "w-full justify-center mt-3" : "shrink-0"} flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            cs.status === "ongoing"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
              : "bg-blue-50 text-blue-600 border border-blue-200"
          }`}
        >
          <Video size={16} />
          {cs.status === "ongoing" ? "Join Now" : "Join"}
          <ExternalLink size={12} />
        </motion.a>
      );
    }

    return null;
  }

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-blue-500" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Timetable</h1>
            <p className="text-gray-500">Your weekly class schedule</p>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 shadow-inner">
            {(["daily", "weekly"] as const).map((v) => (
              <motion.button
                key={v}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView(v)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  view === v
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v}
              </motion.button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Live Now Banner */}
        {activeMeetingsList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-600 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg shadow-blue-200"
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-white animate-pulse shrink-0" />
              <div>
                <p className="text-white font-bold text-sm">Live class in session!</p>
                <p className="text-blue-100 text-xs mt-0.5">
                  {activeMeetingsList.map((m) => m.subject_name || m.title).join(", ")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {activeMeetingsList.map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/student/live/${m.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm shadow"
                >
                  <RadioTower size={14} />
                  Join Now
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {entries.length === 0 && !error && (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No timetable published yet</h3>
            <p className="text-gray-500">Your admin hasn't published a timetable for your class yet.</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Weekly View */}
          {view === "weekly" && entries.length > 0 && (
            <motion.div
              key="weekly"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                  <ChevronLeft size={20} />
                </motion.button>
                <h3 className="font-semibold text-gray-800">Weekly Schedule</h3>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                  <ChevronRight size={20} />
                </motion.button>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Header row */}
                  <div className="grid grid-cols-6 border-b border-gray-100">
                    <div className="p-4 bg-gray-50 border-r border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</span>
                    </div>
                    {weekDays.map((day) => (
                      <div key={day} className="p-4 bg-gray-50 border-r border-gray-100 last:border-r-0 text-center">
                        <span className="text-sm font-semibold text-gray-700">{day}</span>
                      </div>
                    ))}
                  </div>

                  {/* Time slots */}
                  {timeSlots.map((time) => (
                    <div key={time} className="grid grid-cols-6 border-b border-gray-100 last:border-b-0">
                      <div className="p-3 bg-gray-50 border-r border-gray-100 flex items-center">
                        <span className="text-xs text-gray-500 font-medium">{time}</span>
                      </div>
                      {weekDays.map((day) => {
                        const cs = getClassForSlot(day, time);
                        const online = cs ? isOnline(cs) : false;
                        return (
                          <div key={`${day}-${time}`} className="p-1.5 border-r border-gray-100 last:border-r-0 min-h-[64px]">
                            {cs && (
                              <motion.div
                                whileHover={{ scale: 1.03, y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedClass(cs)}
                                className={`${cs.tint.bg} border-l-[3px] ${cs.tint.border} rounded-lg p-2 cursor-pointer h-full`}
                              >
                                <div className="flex items-start gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${cs.tint.dot}`} />
                                  <div className="min-w-0">
                                    <p className={`text-xs font-semibold ${cs.tint.text} line-clamp-1`}>
                                      {cs.subject_name}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                      {cs.teacher_name}
                                    </p>
                                    <div className="flex items-center gap-1 mt-1">
                                      {getLiveMeeting(cs) ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/student/live/${getLiveMeeting(cs)!.id}`);
                                          }}
                                          className="inline-flex items-center gap-0.5 text-[10px] text-white bg-blue-600 px-1.5 py-0.5 rounded font-medium animate-pulse hover:bg-blue-700 transition-colors"
                                        >
                                          <RadioTower size={8} /> Join Live
                                        </button>
                                      ) : online ? (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                                          <Wifi size={8} /> Online
                                        </span>
                                      ) : cs.location_name ? (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                                          <MapPin size={8} />{cs.location_name}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Daily View */}
          {view === "daily" && entries.length > 0 && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Day selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {weekDays.map((day) => (
                  <motion.button
                    key={day}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDay(day)}
                    className={`px-5 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${
                      selectedDay === day
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {day}
                  </motion.button>
                ))}
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {getTodayClasses().map((cs, index) => {
                  const online = isOnline(cs);
                  return (
                    <motion.div
                      key={cs.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.07 }}
                      className={`bg-white rounded-2xl border border-l-4 ${cs.tint.border} shadow-sm hover:shadow-md transition-shadow`}
                    >
                      <div className="p-5 flex items-center gap-5">
                        {/* Subject icon */}
                        <div className={`w-12 h-12 ${cs.tint.bg} ${cs.tint.border} border-2 rounded-xl flex items-center justify-center shrink-0`}>
                          <span className={`text-sm font-bold ${cs.tint.text}`}>
                            {(cs.subject_name || "?").substring(0, 2).toUpperCase()}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-gray-900">{cs.subject_name}</h3>
                            {/* Status badge */}
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              cs.status === "ongoing"   ? "bg-blue-100 text-blue-700" :
                              cs.status === "completed" ? "bg-gray-100 text-gray-500" :
                                                          "bg-green-100 text-green-700"
                            }`}>
                              {cs.status === "completed" && <CheckCircle size={10} />}
                              {cs.status === "ongoing" ? "Ongoing" : cs.status === "completed" ? "Done" : "Upcoming"}
                            </span>
                            {/* Mode badge */}
                            {online ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                <Wifi size={10} /> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                                <MapPin size={10} /> {cs.location_name || "On-site"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {cs.start_time || cs.time_slot}{cs.end_time ? ` – ${cs.end_time}` : ""}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={14} />
                              {cs.teacher_name}
                            </span>
                          </div>
                        </div>

                        {/* Join button — live meeting (any session) or static URL (online only) */}
                        {renderJoinButton(cs)}
                      </div>
                    </motion.div>
                  );
                })}

                {getTodayClasses().length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No classes today</h3>
                    <p className="text-gray-500">Enjoy your free day!</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Class Detail Modal */}
      <AnimatePresence>
        {selectedClass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedClass(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className={`${selectedClass.tint.bg} border-b ${selectedClass.tint.border} px-6 py-5 flex items-center justify-between`}>
                <div>
                  <h2 className={`text-xl font-bold ${selectedClass.tint.text}`}>
                    {selectedClass.subject_name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedClass.day}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedClass(null)}
                  className="p-2 hover:bg-black/5 rounded-lg transition-colors text-gray-500"
                >
                  <X size={20} />
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Clock size={14} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Time</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {selectedClass.start_time || selectedClass.time_slot}
                      {selectedClass.end_time ? ` – ${selectedClass.end_time}` : ""}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <User size={14} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Teacher</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{selectedClass.teacher_name || "—"}</p>
                  </div>
                </div>

                {/* Location / Mode block */}
                <div className={`p-4 rounded-xl ${isOnline(selectedClass) ? "bg-blue-50 border border-blue-100" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isOnline(selectedClass) ? (
                      <><Wifi size={14} className="text-blue-500" />
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Online Session</span></>
                    ) : (
                      <><MapPin size={14} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</span></>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {isOnline(selectedClass) ? "Online" : selectedClass.location_name || selectedClass.room || "—"}
                  </p>

                  {/* Join button — live meeting (any session) or static URL (online only) */}
                  {renderJoinButton(selectedClass, true)}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
