import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Download, Check, Clock, AlertCircle,
  User, Calendar, CheckCircle, ChevronDown, ChevronUp,
  Search, Loader2, X,
} from "lucide-react";
import {
  HomeworkRead, studentGetHomework, studentToggleHomework,
} from "@/app/utils/api";

const BASE = "http://127.0.0.1:8000";

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "bg-blue-500",
  English: "bg-purple-500",
  Physics: "bg-teal-500",
  Chemistry: "bg-green-500",
  History: "bg-amber-500",
  Science: "bg-cyan-500",
  Biology: "bg-emerald-500",
  Geography: "bg-orange-500",
};

function getSubjectColor(name: string | null): string {
  if (!name) return "bg-gray-500";
  return SUBJECT_COLORS[name] || "bg-indigo-500";
}

type DueStatus = "overdue" | "due-soon" | "upcoming" | "no-deadline" | "done";

function getDueStatus(hw: HomeworkRead): DueStatus {
  if (hw.is_done) return "done";
  if (!hw.due_at) return "no-deadline";
  const now = new Date();
  const due = new Date(hw.due_at);
  if (due < now) return "overdue";
  const diff = due.getTime() - now.getTime();
  if (diff < 24 * 60 * 60 * 1000) return "due-soon";
  return "upcoming";
}

const statusConfig: Record<DueStatus, { label: string; color: string; bgColor: string }> = {
  done: { label: "Done", color: "text-green-700", bgColor: "bg-green-100" },
  overdue: { label: "Overdue", color: "text-red-700", bgColor: "bg-red-100" },
  "due-soon": { label: "Due Soon", color: "text-amber-700", bgColor: "bg-amber-100" },
  upcoming: { label: "Upcoming", color: "text-blue-700", bgColor: "bg-blue-100" },
  "no-deadline": { label: "No Deadline", color: "text-gray-600", bgColor: "bg-gray-100" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentHomework() {
  const [homework, setHomework] = useState<HomeworkRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [drawerItem, setDrawerItem] = useState<HomeworkRead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "done" | "overdue">("all");
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await studentGetHomework();
      setHomework(data);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggle = async (hw: HomeworkRead) => {
    setTogglingIds((prev) => new Set(prev).add(hw.id));
    try {
      const result = await studentToggleHomework(hw.id);
      setHomework((prev) =>
        prev.map((h) =>
          h.id === hw.id
            ? { ...h, is_done: result.is_done, done_at: result.done_at }
            : h
        )
      );
      if (drawerItem?.id === hw.id) {
        setDrawerItem({ ...drawerItem, is_done: result.is_done, done_at: result.done_at });
      }
    } catch { }
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(hw.id);
      return next;
    });
  };

  // Filter and search
  const filtered = homework.filter((hw) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!hw.title.toLowerCase().includes(q) && !hw.subject_name?.toLowerCase().includes(q)) return false;
    }
    if (filterStatus === "done") return hw.is_done;
    if (filterStatus === "pending") return !hw.is_done;
    if (filterStatus === "overdue") return getDueStatus(hw) === "overdue";
    return true;
  });

  // Group by subject
  const grouped = filtered.reduce<Record<string, HomeworkRead[]>>((acc, hw) => {
    const key = hw.subject_name || "Other";
    (acc[key] ||= []).push(hw);
    return acc;
  }, {});

  // Stats
  const totalPending = homework.filter((h) => !h.is_done).length;
  const totalDone = homework.filter((h) => h.is_done).length;
  const totalOverdue = homework.filter((h) => getDueStatus(h) === "overdue").length;
  const dueSoon = homework.filter((h) => getDueStatus(h) === "due-soon").length;

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 size={40} className="text-blue-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Homework Checklist</h1>
          <p className="text-gray-600">Track and complete your homework tasks</p>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-5 border border-blue-200"
          >
            <p className="text-sm font-medium text-blue-700 mb-1">Pending</p>
            <p className="text-3xl font-bold text-blue-900">{totalPending}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-5 border border-green-200"
          >
            <p className="text-sm font-medium text-green-700 mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-900">{totalDone}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-5 border border-amber-200"
          >
            <p className="text-sm font-medium text-amber-700 mb-1">Due Soon</p>
            <p className="text-3xl font-bold text-amber-900">{dueSoon}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl p-5 border border-red-200"
          >
            <p className="text-sm font-medium text-red-700 mb-1">Overdue</p>
            <p className="text-3xl font-bold text-red-900">{totalOverdue}</p>
          </motion.div>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            {(["all", "pending", "done", "overdue"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filterStatus === f
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
                  }`}
              >
                {f === "all" ? "All" : f === "pending" ? "Pending" : f === "done" ? "Done" : "Overdue"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search homework..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Info Line */}
        <p className="text-sm text-gray-500 mb-4">
          Showing: <span className="font-medium text-gray-700">{filtered.length} tasks</span>
          {Object.keys(grouped).length > 0 && (
            <> across <span className="font-medium text-gray-700">{Object.keys(grouped).length} subjects</span></>
          )}
        </p>

        {/* Main Checklist */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-200 p-12 text-center"
          >
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || filterStatus !== "all"
                ? "No tasks match your filter"
                : "No homework assigned yet!"}
            </h3>
            <p className="text-gray-600">
              {searchQuery ? "Try adjusting your search or filters" : "Check back later for new tasks."}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([subject, items], groupIndex) => (
              <div key={subject}>
                {/* Subject Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`${getSubjectColor(subject)} text-white px-4 py-1.5 rounded-lg text-sm font-semibold`}>
                    {subject}
                  </div>
                  <span className="text-sm text-gray-500">{items.length} task{items.length > 1 ? "s" : ""}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {items.map((hw, index) => {
                    const dueStatus = getDueStatus(hw);
                    const cfg = statusConfig[dueStatus];
                    const isExpanded = expandedItems.has(hw.id);
                    const isToggling = togglingIds.has(hw.id);

                    return (
                      <motion.div
                        key={hw.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: groupIndex * 0.05 + index * 0.03 }}
                        className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${hw.is_done ? "border-green-200 bg-green-50/30" : "border-gray-200"
                          }`}
                      >
                        {/* Main Row */}
                        <div className="flex items-center gap-4 p-4">
                          {/* Checkbox */}
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleToggle(hw)}
                            disabled={isToggling}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${hw.is_done
                                ? "bg-green-500 border-green-500"
                                : "border-gray-300 hover:border-blue-400"
                              } ${isToggling ? "opacity-50" : ""}`}
                          >
                            {isToggling ? (
                              <Loader2 size={14} className="animate-spin text-white" />
                            ) : hw.is_done ? (
                              <Check className="text-white" size={16} />
                            ) : null}
                          </motion.button>

                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-semibold text-sm ${hw.is_done ? "line-through text-gray-400" : "text-gray-900"
                              }`}>
                              {hw.title}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {hw.teacher_name} · {hw.class_name}
                            </p>
                          </div>

                          {/* Due Time */}
                          {hw.due_at && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 flex-shrink-0">
                              <Clock size={14} />
                              <span>
                                {new Date(hw.due_at).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric",
                                })}
                              </span>
                            </div>
                          )}

                          {/* Status Chip */}
                          <div className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${cfg.bgColor} ${cfg.color}`}>
                            {cfg.label}
                          </div>

                          {/* Attachment Indicator */}
                          {hw.attachments.length > 0 && (
                            <div className="flex items-center gap-1 text-gray-400 flex-shrink-0">
                              <FileText size={14} />
                              <span className="text-xs">{hw.attachments.length}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setDrawerItem(hw)}
                              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => toggleExpand(hw.id)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              {isExpanded
                                ? <ChevronUp size={18} className="text-gray-600" />
                                : <ChevronDown size={18} className="text-gray-600" />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-gray-200 bg-gray-50"
                            >
                              <div className="p-4 space-y-3">
                                {hw.instructions && (
                                  <p className="text-sm text-gray-700 line-clamp-3">{hw.instructions}</p>
                                )}
                                {hw.attachments.length > 0 && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {hw.attachments.map((att) => (
                                      <a
                                        key={att.id}
                                        href={`${BASE}${att.file_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs hover:border-blue-300 transition-colors"
                                      >
                                        <FileText size={14} className="text-blue-500" />
                                        <span className="text-gray-700">{att.file_name}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Drawer */}
      <AnimatePresence>
        {drawerItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerItem(null)}
              className="fixed inset-0 bg-black/30 z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 z-10 shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className={`${getSubjectColor(drawerItem.subject_name)} text-white inline-block px-3 py-1 rounded-lg text-sm font-medium mb-3`}>
                      {drawerItem.subject_name}
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{drawerItem.title}</h2>
                    <div className="flex items-center gap-4 text-sm text-blue-100">
                      <div className="flex items-center gap-1">
                        <User size={16} />
                        <span>{drawerItem.teacher_name}</span>
                      </div>
                      {drawerItem.due_at && (
                        <div className="flex items-center gap-1">
                          <Calendar size={16} />
                          <span>
                            Due: {new Date(drawerItem.due_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric",
                            })} at {new Date(drawerItem.due_at).toLocaleTimeString("en-US", {
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerItem(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-block ${statusConfig[getDueStatus(drawerItem)].bgColor} ${statusConfig[getDueStatus(drawerItem)].color}`}>
                  {statusConfig[getDueStatus(drawerItem)].label}
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6">
                {/* Instructions */}
                {drawerItem.instructions && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Instructions</h3>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{drawerItem.instructions}</p>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {drawerItem.attachments.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Teacher Attachments</h3>
                    <div className="space-y-2">
                      {drawerItem.attachments.map((att) => (
                        <motion.a
                          key={att.id}
                          href={`${BASE}${att.file_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ x: 4 }}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors block"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="text-blue-600" size={20} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{att.file_name}</p>
                              <p className="text-xs text-gray-500">{formatSize(att.file_size)}</p>
                            </div>
                          </div>
                          <Download size={18} className="text-blue-600" />
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mark as Done */}
                <div className="pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleToggle(drawerItem)}
                    disabled={togglingIds.has(drawerItem.id)}
                    className={`w-full py-4 rounded-xl font-medium text-lg shadow-md transition-all flex items-center justify-center gap-3 ${drawerItem.is_done
                        ? "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
                        : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg"
                      }`}
                  >
                    {togglingIds.has(drawerItem.id) ? (
                      <Loader2 size={22} className="animate-spin" />
                    ) : drawerItem.is_done ? (
                      <>
                        <CheckCircle size={22} />
                        Mark as Not Done
                      </>
                    ) : (
                      <>
                        <Check size={22} />
                        Mark as Done
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
