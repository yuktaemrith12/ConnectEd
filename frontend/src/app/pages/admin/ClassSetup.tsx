import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Plus, Users, BookOpen, X, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  AdminClass, AdminSubject, AdminUser, TeacherOption, SubjectTeacherMapping,
  adminGetClasses, adminCreateClass,
  adminGetSubjects, adminManageClass,
  adminGetUsers, adminGetClassSubjects,
  adminGetClassMappings, adminGetSubjectTeachers,
} from "@/app/utils/api";

export default function AdminClassSetup() {
  const [classes, setClasses]   = useState<AdminClass[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // Create-class modal
  const [showCreate, setShowCreate]     = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating]         = useState(false);

  // Manage-class modal
  const [managing, setManaging]               = useState<AdminClass | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<number | "">("");
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  // subjectId → teacherId (or "" for unassigned)
  const [subjectTeacherMap, setSubjectTeacherMap] = useState<Record<number, number | "">>({});
  // cached eligible teachers per subjectId
  const [teacherOptionsCache, setTeacherOptionsCache] = useState<Record<number, TeacherOption[]>>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    Promise.all([
      adminGetClasses(),
      adminGetSubjects(),
      adminGetUsers("teacher"),
    ])
      .then(([cls, sub, tch]) => {
        setClasses(cls);
        setSubjects(sub);
        setTeachers(tch);
      })
      .catch(() => setError("Failed to load data. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch eligible teachers for a subject (cached)
  const loadTeachersForSubject = useCallback(async (subjectId: number): Promise<TeacherOption[]> => {
    if (teacherOptionsCache[subjectId]) return teacherOptionsCache[subjectId];
    try {
      const opts = await adminGetSubjectTeachers(subjectId);
      setTeacherOptionsCache((prev) => ({ ...prev, [subjectId]: opts }));
      return opts;
    } catch {
      return [];
    }
  }, [teacherOptionsCache]);

  async function handleCreate() {
    if (!newClassName.trim()) return;
    setCreating(true);
    try {
      const created = await adminCreateClass(newClassName.trim());
      setClasses((prev) => [...prev, created]);
      setShowCreate(false);
      setNewClassName("");
    } catch {
      alert("Failed to create class.");
    } finally {
      setCreating(false);
    }
  }

  async function openManage(cls: AdminClass) {
    setManaging(cls);
    setSelectedTeacher(cls.head_teacher_id ?? "");
    setSelectedSubjects([]);
    setSubjectTeacherMap({});
    setTeacherOptionsCache({});
    setModalLoading(true);

    try {
      const [assignedSubjects, mappings] = await Promise.all([
        adminGetClassSubjects(cls.id),
        adminGetClassMappings(cls.id),
      ]);

      const subjectIds = assignedSubjects.map((s) => s.id);
      setSelectedSubjects(subjectIds);

      // Build the subject-teacher map from existing mappings
      const map: Record<number, number | ""> = {};
      for (const sid of subjectIds) {
        const m = mappings.find((x) => x.subject_id === sid);
        map[sid] = m ? m.teacher_id : "";
      }
      setSubjectTeacherMap(map);

      // Pre-fetch teacher options for all assigned subjects
      const cacheUpdates: Record<number, TeacherOption[]> = {};
      await Promise.all(
        subjectIds.map(async (sid) => {
          try {
            const opts = await adminGetSubjectTeachers(sid);
            cacheUpdates[sid] = opts;
          } catch { /* ignore */ }
        })
      );
      setTeacherOptionsCache(cacheUpdates);
    } catch {
      // If loading fails, at least open modal with empty state
    } finally {
      setModalLoading(false);
    }
  }

  async function toggleSubject(id: number) {
    const isOn = selectedSubjects.includes(id);
    if (isOn) {
      setSelectedSubjects((prev) => prev.filter((s) => s !== id));
      setSubjectTeacherMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setSelectedSubjects((prev) => [...prev, id]);
      setSubjectTeacherMap((prev) => ({ ...prev, [id]: "" }));
      // Pre-fetch eligible teachers
      await loadTeachersForSubject(id);
    }
  }

  async function handleTeacherSelect(subjectId: number, value: string) {
    const teacherId = value === "" ? "" : Number(value);
    setSubjectTeacherMap((prev) => ({ ...prev, [subjectId]: teacherId }));
    // Ensure options are loaded
    if (!teacherOptionsCache[subjectId]) {
      await loadTeachersForSubject(subjectId);
    }
  }

  async function handleSave() {
    if (!managing) return;
    setSaving(true);
    try {
      const mappings: SubjectTeacherMapping[] = selectedSubjects
        .filter((sid) => subjectTeacherMap[sid] !== "" && subjectTeacherMap[sid] !== undefined)
        .map((sid) => ({ subject_id: sid, teacher_id: subjectTeacherMap[sid] as number }));

      const updated = await adminManageClass(
        managing.id,
        selectedTeacher === "" ? null : Number(selectedTeacher),
        selectedSubjects,
        mappings,
      );
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setManaging(null);
    } catch {
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Classes &amp; Subjects</h1>
            <p className="text-gray-600">Manage class structure and subject assignments</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-medium shadow-lg flex items-center gap-2"
          >
            <Plus size={20} /> Add Class
          </motion.button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Class cards */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls, index) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{cls.name}</h3>
                    <p className="text-sm text-gray-500">
                      {cls.head_teacher_name ?? "No head teacher"}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <BookOpen size={24} className="text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <span>{cls.student_count} students</span>
                  </div>
                  <div>{cls.subject_count} subjects</div>
                </div>
                <button
                  onClick={() => openManage(cls)}
                  className="w-full py-2 border border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50 transition-colors text-sm font-medium"
                >
                  Manage Class
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create class modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create New Class</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. Grade 6-A"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none mb-4"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newClassName.trim()}
                className="w-full py-3 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-semibold disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create Class"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manage class modal */}
      <AnimatePresence>
        {managing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={(e) => e.target === e.currentTarget && setManaging(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Manage — {managing.name}</h2>
                <button onClick={() => setManaging(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              {/* Head teacher */}
              <label className="block text-sm font-semibold text-gray-700 mb-2">Head Teacher</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none mb-6"
              >
                <option value="">— None —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>

              {/* Subjects + Teacher Assignment */}
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Assign Subjects &amp; Teachers
              </label>

              {modalLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Loading assignments…</span>
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {subjects.map((s) => {
                    const isOn = selectedSubjects.includes(s.id);
                    const teacherVal = subjectTeacherMap[s.id] ?? "";
                    const options = teacherOptionsCache[s.id] ?? [];

                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${
                          isOn
                            ? "border-orange-400 bg-orange-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        {/* Subject toggle */}
                        <button
                          onClick={() => toggleSubject(s.id)}
                          className={`flex items-center gap-2 flex-1 text-sm font-medium text-left ${
                            isOn ? "text-orange-700" : "text-gray-600"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            isOn ? "bg-orange-500 border-orange-500" : "border-gray-300"
                          }`}>
                            {isOn && <Check size={12} className="text-white" />}
                          </div>
                          {s.name}
                        </button>

                        {/* Teacher dropdown — only when subject is selected */}
                        {isOn && (
                          <select
                            value={teacherVal}
                            onFocus={() => loadTeachersForSubject(s.id)}
                            onChange={(e) => handleTeacherSelect(s.id, e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-orange-400 min-w-[160px]"
                          >
                            <option value="">— No Teacher —</option>
                            {options.map((t) => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || modalLoading}
                className="w-full py-3 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-semibold disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
