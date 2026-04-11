import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, FileText, Calendar, CheckCircle, Clock, Upload,
  X, Download, Trash2, Send, Loader2, AlertCircle,
} from "lucide-react";
import {
  HomeworkRead, TeacherClassSubjects,
  teacherGetHomework, teacherGetHomeworkClasses,
  teacherCreateHomework, teacherDeleteHomework,
  teacherPublishHomework, teacherDeleteAttachment,
} from "@/app/utils/api";

const BASE = "http://127.0.0.1:8000";

export default function TeacherHomework() {
  const [homework, setHomework] = useState<HomeworkRead[]>([]);
  const [classes, setClasses] = useState<TeacherClassSubjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HomeworkRead | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<"ALL" | "DRAFT" | "PUBLISHED">("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formClassId, setFormClassId] = useState<number | "">("");
  const [formSubjectId, setFormSubjectId] = useState<number | "">("");
  const [formTitle, setFormTitle] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formDueTime, setFormDueTime] = useState("");
  const [formFiles, setFormFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hw, cls] = await Promise.all([
        teacherGetHomework(tab === "ALL" ? undefined : { status: tab }),
        teacherGetHomeworkClasses(),
      ]);
      setHomework(hw);
      setClasses(cls);
    } catch { setError("Failed to load homework."); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const selectedClass = classes.find((c) => c.id === formClassId);

  const resetForm = () => {
    setFormClassId("");
    setFormSubjectId("");
    setFormTitle("");
    setFormInstructions("");
    setFormDueDate("");
    setFormDueTime("");
    setFormFiles([]);
    setError("");
  };

  const handleCreate = async (publish: boolean) => {
    if (!formClassId || !formSubjectId || !formTitle.trim()) {
      setError("Class, Subject and Title are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const params: Record<string, string> = {
        class_id: String(formClassId),
        subject_id: String(formSubjectId),
        title: formTitle,
      };
      if (formInstructions) params.instructions = formInstructions;
      if (formDueDate) params.due_date = formDueDate;
      if (formDueTime) params.due_time = formDueTime;
      if (publish) params.publish = "true";

      const formData = new FormData();
      formFiles.forEach((f) => formData.append("files", f));

      await teacherCreateHomework(params, formData);

      setShowCreate(false);
      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create homework.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this homework?")) return;
    try {
      await teacherDeleteHomework(id);
      if (selected?.id === id) setSelected(null);
      await load();
    } catch { setError("Failed to delete."); }
  };

  const handlePublish = async (id: number) => {
    try {
      await teacherPublishHomework(id);
      await load();
    } catch { setError("Failed to publish."); }
  };

  const handleDeleteAttachment = async (attId: number) => {
    try {
      await teacherDeleteAttachment(attId);
      await load();
      if (selected) {
        setSelected({
          ...selected,
          attachments: selected.attachments.filter((a) => a.id !== attId),
        });
      }
    } catch { setError("Failed to delete attachment."); }
  };

  const filtered = tab === "ALL" ? homework : homework.filter((h) => h.status === tab);

  const formatDate = (iso: string | null) => {
    if (!iso) return "No deadline";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Homework Management</h1>
            <p className="text-gray-600">Create and manage homework for your classes</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2"
          >
            <Plus size={20} />
            Create Homework
          </motion.button>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
            >
              <AlertCircle size={20} className="text-red-500" />
              <span className="text-red-700 text-sm flex-1">{error}</span>
              <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(["ALL", "DRAFT", "PUBLISHED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t
                ? "bg-purple-500 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300"
                }`}
            >
              {t === "ALL" ? "All" : t === "DRAFT" ? "Drafts" : "Published"}
              {" "}({(t === "ALL" ? homework : homework.filter((h) => h.status === t)).length})
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-purple-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-340px)]">
            {/* LEFT — List */}
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Homework ({filtered.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FileText size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No homework found</p>
                  </div>
                ) : (
                  filtered.map((hw, i) => (
                    <motion.div
                      key={hw.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelected(hw)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${selected?.id === hw.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-200"
                        }`}
                    >
                      <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                        {hw.title}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2">
                        {hw.class_name} — {hw.subject_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <Calendar size={12} />
                        <span>{formatDate(hw.due_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${hw.status === "PUBLISHED"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                          }`}>
                          {hw.status === "PUBLISHED" ? "Published" : "Draft"}
                        </span>
                        {hw.attachments.length > 0 && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {hw.attachments.length} file{hw.attachments.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT — Details */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              {selected ? (
                <>
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{selected.title}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <FileText size={16} />
                            <span>{selected.class_name} — {selected.subject_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={16} />
                            <span>{formatDate(selected.due_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-4 py-2 rounded-xl text-sm font-semibold ${selected.status === "PUBLISHED"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                          }`}>
                          {selected.status === "PUBLISHED" ? "Published" : "Draft"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Instructions */}
                    {selected.instructions && (
                      <div className="bg-gray-50 rounded-xl p-5">
                        <h3 className="font-semibold text-gray-900 mb-3">Instructions</h3>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {selected.instructions}
                        </p>
                      </div>
                    )}

                    {/* Attachments */}
                    {selected.attachments.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Attached Files</h3>
                        <div className="space-y-2">
                          {selected.attachments.map((att) => (
                            <motion.div
                              key={att.id}
                              whileHover={{ x: 4 }}
                              className="flex items-center justify-between p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                  <FileText className="text-purple-600" size={20} />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{att.file_name}</p>
                                  <p className="text-xs text-gray-500">{formatSize(att.file_size)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={`${BASE}${att.file_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                                >
                                  <Download size={18} className="text-purple-600" />
                                </a>
                                <button
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={18} className="text-red-400" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Due Date Info */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
                      <Clock className="text-blue-600 flex-shrink-0" size={20} />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Due Date & Time</h4>
                        <p className="text-sm text-blue-800">
                          {selected.due_at
                            ? `This homework is due on ${formatDate(selected.due_at)}`
                            : "No fixed deadline set for this homework."}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      {selected.status === "DRAFT" && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handlePublish(selected.id)}
                          className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2"
                        >
                          <Send size={18} />
                          Publish
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleDelete(selected.id)}
                        className="px-5 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={18} />
                        Delete
                      </motion.button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-32 h-32 bg-purple-50 rounded-full flex items-center justify-center mb-6"
                  >
                    <FileText size={48} className="text-purple-500" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Select a homework to view details
                  </h3>
                  <p className="text-gray-500 max-w-sm">
                    Choose a homework from the list to see its details,
                    attachments, and management options
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Homework Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Create Homework</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a new homework for your students
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Class */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Class</label>
                  <select
                    value={formClassId}
                    onChange={(e) => {
                      const v = e.target.value ? parseInt(e.target.value) : "";
                      setFormClassId(v);
                      setFormSubjectId("");
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Subject</label>
                  <select
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={!selectedClass}
                  >
                    <option value="">Select a subject</option>
                    {selectedClass?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Homework Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Quadratic Equations Practice"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Instructions</label>
                  <textarea
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    placeholder="Provide detailed instructions for the homework..."
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* File Attachments */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">File Attachments</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.gif"
                      onChange={(e) => {
                        if (e.target.files) {
                          setFormFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                    <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500">PDF, DOCX, or images (Max 10MB)</p>
                  </div>
                  {formFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-purple-500" />
                            <span className="text-sm text-gray-700">{f.name}</span>
                            <span className="text-xs text-gray-400">{formatSize(f.size)}</span>
                          </div>
                          <button
                            onClick={() => setFormFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Due Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Due Date</label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Due Time</label>
                    <input
                      type="time"
                      value={formDueTime}
                      onChange={(e) => setFormDueTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => handleCreate(false)}
                  className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => handleCreate(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  Create Homework
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
