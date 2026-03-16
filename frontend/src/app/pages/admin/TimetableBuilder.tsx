import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Clock, Save, User, Send, Wifi, MapPin } from "lucide-react";
import { motion } from "motion/react";
import {
  AdminClass, AdminSubject, TimetableSlot, TeacherOption, Location,
  adminGetClasses, adminGetClassSubjects,
  adminGetTimetable, adminSaveTimetable,
  adminGetClassSubjectTeachers,
  adminPublishTimetable,
  adminGetLocations,
} from "@/app/utils/api";

const TIME_SLOTS = ["9:00", "10:00", "11:00", "12:00", "1:00", "2:00", "3:00"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const LUNCH = "12:00";

interface CellValue {
  subject_id: number | null;
  teacher_id: number | null;
  delivery_mode: "ONLINE" | "ONSITE";
  location_id: number | null;
  online_join_url: string | null;
}

type Grid = Record<string, Record<string, CellValue>>;

function emptyCell(): CellValue {
  return { subject_id: null, teacher_id: null, delivery_mode: "ONSITE", location_id: null, online_join_url: null };
}

function buildGrid(slots: TimetableSlot[]): Grid {
  const g: Grid = {};
  DAYS.forEach((d) => {
    g[d] = {};
    TIME_SLOTS.forEach((t) => { g[d][t] = emptyCell(); });
  });
  slots.forEach(({ day, time_slot, subject_id, teacher_id, delivery_mode, location_id, online_join_url }) => {
    if (g[day]) {
      g[day][time_slot] = {
        subject_id,
        teacher_id: teacher_id ?? null,
        delivery_mode: (delivery_mode === "ONLINE" ? "ONLINE" : "ONSITE"),
        location_id: location_id ?? null,
        online_join_url: online_join_url ?? null,
      };
    }
  });
  return g;
}

export default function AdminTimetableBuilder() {
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [grid, setGrid] = useState<Grid>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");

  const [teacherCache, setTeacherCache] = useState<Record<number, TeacherOption[]>>({});

  // Load classes + locations on mount
  useEffect(() => {
    adminGetClasses()
      .then((cls) => {
        setClasses(cls);
        if (cls.length > 0) setClassId(cls[0].id);
      })
      .catch(() => setError("Failed to load classes."));
    adminGetLocations(true)
      .then(setLocations)
      .catch(() => {/* non-critical */});
  }, []);

  // When class changes → load class-specific subjects + timetable
  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setError("");
    setTeacherCache({});

    Promise.all([
      adminGetClassSubjects(classId),
      adminGetTimetable(classId),
    ])
      .then(([subs, slots]) => {
        setSubjects(subs);
        setGrid(buildGrid(slots));

        const uniqueSubIds = [...new Set(slots.map((s) => s.subject_id).filter(Boolean))];
        const fetches = uniqueSubIds.map((sid) =>
          adminGetClassSubjectTeachers(classId, sid)
            .then((teachers): [number, TeacherOption[]] => [sid, teachers])
            .catch((): [number, TeacherOption[]] => [sid, []])
        );
        Promise.all(fetches).then((results) => {
          const cache: Record<number, TeacherOption[]> = {};
          results.forEach(([sid, teachers]) => { cache[sid] = teachers; });
          setTeacherCache(cache);
        });
      })
      .catch(() => setError("Failed to load timetable."))
      .finally(() => setLoading(false));
  }, [classId]);

  const loadTeachers = useCallback(
    async (subjectId: number): Promise<TeacherOption[]> => {
      if (!classId) return [];
      if (teacherCache[subjectId]) return teacherCache[subjectId];
      try {
        const teachers = await adminGetClassSubjectTeachers(classId, subjectId);
        setTeacherCache((prev) => ({ ...prev, [subjectId]: teachers }));
        return teachers;
      } catch {
        return [];
      }
    },
    [classId, teacherCache],
  );

  function handleSubjectChange(day: string, time: string, value: string) {
    const subjectId = value === "" ? null : Number(value);
    setGrid((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: { ...emptyCell(), subject_id: subjectId },
      },
    }));
    if (subjectId != null) loadTeachers(subjectId);
  }

  function handleTeacherChange(day: string, time: string, value: string) {
    const teacherId = value === "" ? null : Number(value);
    setGrid((prev) => ({
      ...prev,
      [day]: { ...prev[day], [time]: { ...prev[day][time], teacher_id: teacherId } },
    }));
  }

  function handleModeChange(day: string, time: string, mode: "ONLINE" | "ONSITE") {
    setGrid((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: {
          ...prev[day][time],
          delivery_mode: mode,
          location_id: mode === "ONLINE" ? null : prev[day][time].location_id,
          online_join_url: mode === "ONSITE" ? null : prev[day][time].online_join_url,
        },
      },
    }));
  }

  function handleLocationChange(day: string, time: string, value: string) {
    setGrid((prev) => ({
      ...prev,
      [day]: { ...prev[day], [time]: { ...prev[day][time], location_id: value === "" ? null : Number(value) } },
    }));
  }

  function handleJoinUrlChange(day: string, time: string, value: string) {
    setGrid((prev) => ({
      ...prev,
      [day]: { ...prev[day], [time]: { ...prev[day][time], online_join_url: value || null } },
    }));
  }

  async function handleSave() {
    if (!classId) return;
    setSaving(true);
    setSaveMsg("");
    setError("");

    const slots: TimetableSlot[] = [];
    DAYS.forEach((day) => {
      TIME_SLOTS.forEach((time) => {
        if (time === LUNCH) return;
        const cell = grid[day]?.[time];
        if (cell?.subject_id != null) {
          const subj = subjects.find((s) => s.id === cell.subject_id);
          slots.push({
            day,
            time_slot: time,
            subject_id: cell.subject_id,
            subject_name: subj?.name ?? null,
            teacher_id: cell.teacher_id,
            teacher_name: null,
            delivery_mode: cell.delivery_mode,
            location_id: cell.delivery_mode === "ONSITE" ? cell.location_id : null,
            online_join_url: cell.delivery_mode === "ONLINE" ? cell.online_join_url : null,
          });
        }
      });
    });

    try {
      const saved = await adminSaveTimetable(classId, slots);
      setGrid(buildGrid(saved));
      setSaveMsg("Timetable saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!classId) return;
    setPublishing(true);
    setSaveMsg("");
    setError("");
    try {
      const res = await adminPublishTimetable({ class_id: classId, publish_all: true });
      setSaveMsg(res.detail || `Published ${res.count} session(s) to Student & Teacher portals.`);
      setTimeout(() => setSaveMsg(""), 5000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold mb-2">Timetable Builder</h1>
            <p className="text-gray-600">Create and manage weekly schedules per class</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={classId ?? ""}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving || !classId}
              className="px-5 py-2 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-medium shadow flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? "Saving…" : "Save Timetable"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handlePublish}
              disabled={publishing || !classId}
              className="px-5 py-2 bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] text-white rounded-xl font-medium shadow flex items-center gap-2 disabled:opacity-60"
            >
              <Send size={18} />
              {publishing ? "Publishing…" : "Publish Timetable"}
            </motion.button>
          </div>
        </div>

        {saveMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">{saveMsg}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3.5 text-left">
                    <Clock size={15} className="text-gray-400" />
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="px-3 py-3.5 text-center text-sm font-semibold text-gray-700 tracking-wide">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => {
                  const isLunch = time === LUNCH;
                  return (
                    <tr key={time} className="border-t border-gray-50">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap tabular-nums w-14">{time}</td>
                      {DAYS.map((day) => {
                        if (isLunch) {
                          return (
                            <td key={day} className="px-2 py-1.5">
                              <div className="py-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 text-center font-medium select-none tracking-wide">
                                Lunch Break
                              </div>
                            </td>
                          );
                        }
                        const cell = grid[day]?.[time] ?? emptyCell();
                        const sid = cell.subject_id;
                        const tid = cell.teacher_id;
                        const mode = cell.delivery_mode;
                        const teachers = sid != null ? (teacherCache[sid] ?? []) : [];

                        return (
                          <td key={day} className="px-2 py-1.5">
                            <div className={`rounded-xl p-2.5 space-y-2 transition-colors ${sid != null
                              ? mode === "ONLINE"
                                ? "bg-blue-50/80 border-l-[3px] border-blue-400"
                                : "bg-orange-50/80 border-l-[3px] border-orange-400"
                              : "bg-gray-50/70 hover:bg-gray-100/60"
                              }`}>
                              {/* Subject selector */}
                              <select
                                value={sid ?? ""}
                                onChange={(e) => handleSubjectChange(day, time, e.target.value)}
                                className="w-full text-sm bg-transparent border-none focus:outline-none cursor-pointer font-semibold text-gray-800"
                              >
                                <option value="">— Free —</option>
                                {subjects.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>

                              {/* Teacher selector */}
                              {sid != null && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <User size={11} className="text-gray-400 shrink-0" />
                                  <select
                                    value={tid ?? ""}
                                    onChange={(e) => handleTeacherChange(day, time, e.target.value)}
                                    onFocus={() => loadTeachers(sid)}
                                    className="w-full bg-transparent border-none focus:outline-none cursor-pointer text-gray-500"
                                  >
                                    <option value="">— No Teacher —</option>
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.id}>{t.full_name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Delivery mode toggle */}
                              {sid != null && (
                                <div className="flex items-center gap-1 pt-0.5">
                                  <button
                                    onClick={() => handleModeChange(day, time, "ONSITE")}
                                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${mode === "ONSITE"
                                      ? "bg-orange-500 text-white shadow-sm"
                                      : "bg-white/80 text-gray-400 border border-gray-200 hover:border-gray-300"}`}
                                  >
                                    <MapPin size={9} /> On-site
                                  </button>
                                  <button
                                    onClick={() => handleModeChange(day, time, "ONLINE")}
                                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${mode === "ONLINE"
                                      ? "bg-blue-500 text-white shadow-sm"
                                      : "bg-white/80 text-gray-400 border border-gray-200 hover:border-gray-300"}`}
                                  >
                                    <Wifi size={9} /> Online
                                  </button>
                                </div>
                              )}

                              {/* Location selector (ONSITE only) */}
                              {sid != null && mode === "ONSITE" && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <MapPin size={11} className="text-orange-400 shrink-0" />
                                  <select
                                    value={cell.location_id ?? ""}
                                    onChange={(e) => handleLocationChange(day, time, e.target.value)}
                                    className="w-full bg-transparent border-none focus:outline-none cursor-pointer text-gray-500"
                                  >
                                    <option value="">— No Room —</option>
                                    {locations.map((l) => (
                                      <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Join URL (ONLINE only) */}
                              {sid != null && mode === "ONLINE" && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Wifi size={11} className="text-blue-400 shrink-0" />
                                  <input
                                    type="text"
                                    placeholder="Join URL (optional)"
                                    value={cell.online_join_url ?? ""}
                                    onChange={(e) => handleJoinUrlChange(day, time, e.target.value)}
                                    className="w-full bg-white/70 border border-blue-200 rounded-lg px-2 py-0.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Click any cell to assign a subject, teacher, and delivery mode. Use <span className="font-medium text-gray-500">On-site</span> to pick a room or <span className="font-medium text-gray-500">Online</span> to add a join link. The 12:00 lunch slot is locked.
        </p>
      </div>
    </DashboardLayout>
  );
}
