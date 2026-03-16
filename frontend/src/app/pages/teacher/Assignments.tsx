import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Search, GraduationCap, Monitor, School,
  Clock, X, Upload, Trash2, Eye,
  AlertCircle, Loader2, Bot, Star, Send, Users, FileText,
  Download, CheckCircle, MapPin,
} from "lucide-react";
import {
  teacherGetAssignmentClasses,
  teacherGetAssignments,
  teacherCreateAssignment,
  teacherDeleteAssignment,
  teacherPublishAssignment,
  teacherCloseAssignment,
  teacherGetSubmissions,
  teacherGetLocations,
  teacherGetOnsiteRoster,
  gradingManual,
  gradingOnsite,
  gradingAIReview,
  gradingPublish,
  AssignmentRead,
  SubmissionRead,
  TeacherClassSubjects,
  LocationRead,
  OnsiteRosterEntry,
  StructuredFeedback,
} from "@/app/utils/api";
import { BookOpenCheck } from "lucide-react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { RichTextEditor } from "@/app/components/ui/RichTextEditor";
import { isHTMLContent, markdownToHTML } from "@/app/components/FeedbackRenderer";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "No deadline";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function dueSoon(iso: string | null) {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 48 * 3600 * 1000;
}

function isOverdue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-gray-100 text-gray-600",
  ACTIVE:   "bg-blue-100 text-blue-700",
  CLOSED:   "bg-amber-100 text-amber-700",
  RELEASED: "bg-green-100 text-green-700",
};

const CARD_BORDER: Record<string, string> = {
  DRAFT:    "border-l-gray-300",
  ACTIVE:   "border-l-blue-500",
  CLOSED:   "border-l-amber-500",
  RELEASED: "border-l-green-500",
};

const SUB_STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-gray-100 text-gray-500",
  SUBMITTED: "bg-blue-100 text-blue-700",
  GRADED:    "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-green-100 text-green-700",
};

// ── Convert structured AI feedback → editor HTML (removes JSON watermarks) ────

function structuredFeedbackToHTML(sf: StructuredFeedback, grade: number | null, maxScore: number): string {
  const md = (t: string) =>
    t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
     .replace(/\*(.*?)\*/g, "<em>$1</em>")
     .replace(/__(.+?)__/g, "<u>$1</u>");

  const parts: string[] = [];

  if (grade !== null) {
    parts.push(`<h1>Grade: ${grade} / ${maxScore}</h1>`);
  }
  if (sf.grade_summary) {
    parts.push(`<p><em>${md(sf.grade_summary)}</em></p>`);
  }
  if (sf.breakdown) {
    parts.push("<h2>Detailed Breakdown</h2>");
    sf.breakdown.split(/\\n|\n/).filter(l => l.trim()).forEach(line => {
      parts.push(`<p>${md(line)}</p>`);
    });
  }
  if (sf.strengths.length > 0) {
    parts.push("<h2>Strengths</h2><ul>");
    sf.strengths.forEach(s => parts.push(`<li>${md(s)}</li>`));
    parts.push("</ul>");
  }
  if (sf.areas_to_improve.length > 0) {
    parts.push("<h2>Areas to Improve</h2><ul>");
    sf.areas_to_improve.forEach(a => parts.push(`<li>${md(a)}</li>`));
    parts.push("</ul>");
  }
  if (sf.key_corrections.length > 0) {
    parts.push("<h2>Key Corrections</h2>");
    sf.key_corrections.forEach(kc => {
      parts.push(`<p>${kc.misconception} → <strong>${md(kc.correction)}</strong></p>`);
    });
  }
  if (sf.next_steps.length > 0) {
    parts.push("<h2>Next Steps</h2><ol>");
    sf.next_steps.forEach(s => parts.push(`<li>${md(s)}</li>`));
    parts.push("</ol>");
  }
  if (sf.summary_paragraph) {
    parts.push("<h2>Mentor's Note</h2>");
    sf.summary_paragraph.split(/\\n|\n/).filter(l => l.trim()).forEach(line => {
      parts.push(`<p>${md(line)}</p>`);
    });
  }
  return parts.join("\n");
}

/** Safely load any feedback string into the RTE — handles HTML, markdown, and legacy JSON. */
function feedbackToHTML(raw: string | null, grade: number | null, maxScore: number): string {
  if (!raw) return "";
  if (isHTMLContent(raw)) return raw;
  // Try legacy raw JSON watermark
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.grade_summary != null || Array.isArray(parsed.strengths))) {
      return structuredFeedbackToHTML(parsed as StructuredFeedback, grade, maxScore);
    }
  } catch { /* not JSON */ }
  return markdownToHTML(raw);
}

// ── main component ──────────────────���─────────────────────────────────────────

export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [classes, setClasses] = useState<TeacherClassSubjects[]>([]);
  const [locations, setLocations] = useState<LocationRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterClass, setFilterClass] = useState<number | null>(null);
  const [selected, setSelected] = useState<AssignmentRead | null>(null);

  // Grading Hub state
  const [gradingHub, setGradingHub] = useState(false);
  // Online submissions
  const [submissions, setSubmissions] = useState<SubmissionRead[]>([]);
  const [gradingSub, setGradingSub] = useState<SubmissionRead | null>(null);
  // On-site roster
  const [roster, setRoster] = useState<OnsiteRosterEntry[]>([]);
  const [gradingRosterEntry, setGradingRosterEntry] = useState<OnsiteRosterEntry | null>(null);

  const [subLoading, setSubLoading] = useState(false);
  const [gradeInput, setGradeInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [publishingGrades, setPublishingGrades] = useState(false);
  const [hubMsg, setHubMsg] = useState("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    class_id: "", subject_id: "", type: "ONLINE", title: "",
    description: "", due_at: "", max_score: "100",
    location: "", duration: "", publish: false,
    rubric: [{ criterion: "", max_points: "10" }] as { criterion: string; max_points: string }[],
  });
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const answerSheetRef = useRef<HTMLInputElement>(null);
  const [createError, setCreateError] = useState("");

  // load data
  useEffect(() => {
    Promise.all([teacherGetAssignmentClasses(), teacherGetAssignments(), teacherGetLocations()])
      .then(([cls, asgns, locs]) => { setClasses(cls); setAssignments(asgns); setLocations(locs); })
      .catch(() => setError("Failed to load assignments."))
      .finally(() => setLoading(false));
  }, []);

  function reload() {
    teacherGetAssignments().then(setAssignments).catch(() => {});
  }

  // filtering
  const filtered = assignments.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.subject_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || a.status === filterStatus;
    const matchType   = filterType === "ALL" || a.type === filterType;
    const matchClass  = filterClass === null || a.class_id === filterClass;
    return matchSearch && matchStatus && matchType && matchClass;
  });

  // open grading hub
  async function openGradingHub(a: AssignmentRead) {
    setSelected(a);
    setGradingHub(true);
    setGradingSub(null);
    setGradingRosterEntry(null);
    setGradeInput("");
    setFeedbackInput("");
    setHubMsg("");
    setSubLoading(true);
    try {
      if (a.type === "ON_SITE") {
        const r = await teacherGetOnsiteRoster(a.id);
        setRoster(r);
        setSubmissions([]);
      } else {
        const subs = await teacherGetSubmissions(a.id);
        setSubmissions(subs);
        setRoster([]);
      }
    } catch {
      setHubMsg("Failed to load student list.");
    } finally {
      setSubLoading(false);
    }
  }

  function selectSub(sub: SubmissionRead) {
    setGradingSub(sub);
    setGradingRosterEntry(null);
    setGradeInput(sub.grade !== null ? String(sub.grade) : "");
    const maxScore = selected?.max_score ?? 100;
    if (sub.grade === null && sub.ai_reviews.length > 0) {
      const latest = sub.ai_reviews[sub.ai_reviews.length - 1];
      if (latest.suggested_grade !== null) setGradeInput(String(latest.suggested_grade));
      // Convert structured AI feedback to HTML (removes JSON watermarks)
      if (latest.structured_feedback) {
        setFeedbackInput(structuredFeedbackToHTML(latest.structured_feedback, latest.suggested_grade, maxScore));
      } else {
        setFeedbackInput(feedbackToHTML(latest.suggested_feedback, latest.suggested_grade, maxScore));
      }
    } else {
      setFeedbackInput(feedbackToHTML(sub.feedback, sub.grade, maxScore));
    }
  }

  function selectRosterEntry(entry: OnsiteRosterEntry) {
    setGradingRosterEntry(entry);
    setGradingSub(null);
    setGradeInput(entry.grade !== null ? String(entry.grade) : "");
    setFeedbackInput(feedbackToHTML(entry.feedback, entry.grade, selected?.max_score ?? 100));
  }

  async function saveGrade() {
    if (!selected) return;
    const g = parseFloat(gradeInput);
    if (isNaN(g)) { setHubMsg("Enter a valid grade."); return; }
    setSavingGrade(true);
    setHubMsg("");
    try {
      if (selected.type === "ON_SITE" && gradingRosterEntry) {
        if (gradingRosterEntry.submission_id !== null) {
          await gradingManual(gradingRosterEntry.submission_id, g, feedbackInput || undefined);
        } else {
          await gradingOnsite(selected.id, gradingRosterEntry.student_id, g, feedbackInput || undefined);
        }
        const r = await teacherGetOnsiteRoster(selected.id);
        setRoster(r);
        const updated = r.find(e => e.student_id === gradingRosterEntry.student_id);
        if (updated) setGradingRosterEntry(updated);
      } else if (gradingSub) {
        await gradingManual(gradingSub.id, g, feedbackInput || undefined);
        const subs = await teacherGetSubmissions(selected.id);
        setSubmissions(subs);
        setGradingSub(subs.find(s => s.id === gradingSub.id) ?? null);
      }
      reload();
      setHubMsg("Grade saved.");
    } catch {
      setHubMsg("Failed to save grade.");
    } finally {
      setSavingGrade(false);
    }
  }

  async function runAIReview() {
    if (!selected) return;
    setAiRunning(true);
    setHubMsg("");
    try {
      const res = await gradingAIReview(selected.id);
      setHubMsg(`AI reviewed ${res.reviewed} submission(s). Check AI Draft badges.`);
      const subs = await teacherGetSubmissions(selected.id);
      setSubmissions(subs);
      if (gradingSub) {
        const updated = subs.find(s => s.id === gradingSub.id);
        if (updated) {
          setGradingSub(updated);
          if (updated.grade === null && updated.ai_reviews.length > 0) {
            const latest = updated.ai_reviews[updated.ai_reviews.length - 1];
            const maxScore = selected?.max_score ?? 100;
            if (latest.suggested_grade !== null) setGradeInput(String(latest.suggested_grade));
            if (latest.structured_feedback) {
              setFeedbackInput(structuredFeedbackToHTML(latest.structured_feedback, latest.suggested_grade, maxScore));
            } else {
              setFeedbackInput(feedbackToHTML(latest.suggested_feedback, latest.suggested_grade, maxScore));
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "AI review failed.";
      setHubMsg(msg);
    } finally {
      setAiRunning(false);
    }
  }

  async function publishGrades() {
    if (!selected) return;
    setPublishingGrades(true);
    setHubMsg("");
    try {
      const res = await gradingPublish(selected.id);
      setHubMsg(`Published ${res.published} grade(s).`);
      reload();
      if (selected.type === "ON_SITE") {
        const r = await teacherGetOnsiteRoster(selected.id);
        setRoster(r);
      } else {
        const subs = await teacherGetSubmissions(selected.id);
        setSubmissions(subs);
      }
      teacherGetAssignments().then(a => {
        setAssignments(a);
        const updated = a.find(x => x.id === selected.id);
        if (updated) setSelected(updated);
      });
    } catch {
      setHubMsg("Publish failed.");
    } finally {
      setPublishingGrades(false);
    }
  }

  // create assignment
  const currentSubjects = classes.find(c => c.id === Number(form.class_id))?.subjects ?? [];

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.class_id || !form.subject_id || !form.title.trim()) {
      setCreateError("Class, subject, and title are required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    const fd = new FormData();
    createFiles.forEach(f => fd.append("files", f));
    if (answerSheet) fd.append("answer_sheet", answerSheet);
    try {
      const rubricData = form.rubric.filter(r => r.criterion.trim()).map(r => ({
        criterion: r.criterion,
        max_points: parseFloat(r.max_points) || 10,
      }));
      const params: Record<string, string | number | boolean> = {
        class_id: Number(form.class_id),
        subject_id: Number(form.subject_id),
        type: form.type,
        title: form.title,
        description: form.description,
        max_score: parseFloat(form.max_score) || 100,
        publish: form.publish,
      };
      if (form.due_at) params.due_at = form.due_at;
      if (form.location) params.location = form.location;
      if (form.duration) params.duration = form.duration;
      if (rubricData.length > 0) params.rubric = JSON.stringify(rubricData);
      await teacherCreateAssignment(params, fd);
      reload();
      setShowCreate(false);
      setForm({
        class_id: "", subject_id: "", type: "ONLINE", title: "",
        description: "", due_at: "", max_score: "100",
        location: "", duration: "", publish: false,
        rubric: [{ criterion: "", max_points: "10" }],
      });
      setCreateFiles([]);
      setAnswerSheet(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Create failed.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(a: AssignmentRead) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    try {
      await teacherDeleteAssignment(a.id);
      if (selected?.id === a.id) setSelected(null);
      reload();
    } catch {
      setError("Delete failed.");
    }
  }

  async function handlePublish(a: AssignmentRead) {
    try {
      await teacherPublishAssignment(a.id);
      reload();
    } catch {
      setError("Publish failed.");
    }
  }

  async function handleClose(a: AssignmentRead) {
    try {
      await teacherCloseAssignment(a.id);
      reload();
    } catch {
      setError("Close failed.");
    }
  }

  // hub stats — branch by assignment type
  const pendingCount    = selected?.type === "ON_SITE"
    ? roster.filter(r => r.submission_status === "PENDING").length
    : submissions.filter(s => s.status === "PENDING").length;
  const submittedCount  = selected?.type === "ON_SITE"
    ? 0
    : submissions.filter(s => s.status === "SUBMITTED").length;
  const gradedCount     = selected?.type === "ON_SITE"
    ? roster.filter(r => r.submission_status === "GRADED").length
    : submissions.filter(s => s.status === "GRADED").length;
  const publishedCount  = selected?.type === "ON_SITE"
    ? roster.filter(r => r.submission_status === "PUBLISHED").length
    : submissions.filter(s => s.status === "PUBLISHED").length;
  const aiReviewedCount = submissions.filter(s => s.ai_reviewed).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-purple-500" size={32} />
    </div>
  );

  return (
    <DashboardLayout role="teacher">
      <div>

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-br from-purple-900 via-purple-400 to-indigo-300 p-6 text-white relative">
          {/* subtle dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              
              <h1 className="text-3xl font-bold mb-2">Assignments</h1>

              
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-50 transition-colors shadow-md mt-1 flex-shrink-0"
            >
              <Plus size={16} /> New Assignment
            </button>
          </div>

          {/* Quick stats chips */}
          <div className="mt-6 w-full flex justify-center">
            <div className="flex flex-wrap justify-center gap-4">
              {[
                {
                  label: "Active",
                  val: assignments.filter(a => a.status === "ACTIVE").length,
                  pill: "bg-white/15 border-white/20",
                },
                {
                  label: "Needs Grading",
                  val: assignments.filter(a => a.status !== "DRAFT" && a.submission_count > a.graded_count).length,
                  pill: "bg-white/15 border-white/20",
                },
                {
                  label: "Released",
                  val: assignments.filter(a => a.status === "RELEASED").length,
                  pill: "bg-white/15 border-white/20",
                },
              ].map(({ label, val, pill }) => (
                <div
                  key={label}
                  className={[
                    "min-w-[140px] rounded-2xl px-5 py-3",
                    "backdrop-blur-md border shadow-sm",
                    "text-center transition-transform duration-200",
                    "hover:-translate-y-0.5 hover:bg-white/20",
                    pill,
                  ].join(" ")}
                >
                  <p className="text-3xl font-semibold tracking-tight text-white">{val}</p>
                  <p className="text-xs font-medium text-white/80 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Class filter chips */}
        {classes.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setFilterClass(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterClass === null ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              All Classes
            </button>
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterClass(filterClass === c.id ? null : c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterClass === c.id ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Search + Status + Type */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
              placeholder="Search assignments…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
          >
            {["ALL","DRAFT","ACTIVE","CLOSED","RELEASED"].map(s => (
              <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
          >
            <option value="ALL">All Types</option>
            <option value="ONLINE">Online</option>
            <option value="ON_SITE">On-site</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Assignment list ──────────────────────────────────────────────────── */}
      <div>
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No assignments yet</p>
            <p className="text-sm mt-1">Click "New Assignment" to create one.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(a => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl border border-gray-200 border-l-4 ${CARD_BORDER[a.status]} p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {a.type === "ONLINE"
                        ? <Monitor size={15} className="text-blue-500 flex-shrink-0" />
                        : <School size={15} className="text-orange-500 flex-shrink-0" />}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status]}`}>
                        {a.status}
                      </span>
                      <span className="text-xs text-gray-400">{a.subject_name} · {a.class_name}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {isOverdue(a.due_at)
                          ? <span className="text-red-500">Overdue · {formatDate(a.due_at)}</span>
                          : dueSoon(a.due_at)
                          ? <span className="text-amber-600">Due soon · {formatDate(a.due_at)}</span>
                          : formatDate(a.due_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {a.submission_count} submitted · {a.graded_count} graded
                      </span>
                      <span>Max: {a.max_score} pts</span>
                    </div>
                    {/* Grading progress bar */}
                    {a.submission_count > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (a.graded_count / a.submission_count) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{Math.round((a.graded_count / a.submission_count) * 100)}% graded</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(a.status === "ACTIVE" || a.status === "CLOSED") && (
                      <button
                        onClick={() => openGradingHub(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
                      >
                        <Star size={13} /> Grading Hub
                      </button>
                    )}
                    {a.status === "RELEASED" && (
                      <button
                        onClick={() => openGradingHub(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                      >
                        <Eye size={13} /> View Grades
                      </button>
                    )}
                    {a.status === "DRAFT" && (
                      <button
                        onClick={() => handlePublish(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                      >
                        <Send size={13} /> Publish
                      </button>
                    )}
                    {a.status === "ACTIVE" && (
                      <button
                        onClick={() => handleClose(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors"
                      >
                        Close
                      </button>
                    )}
                    <button
                      onClick={() => setSelected(selected?.id === a.id && !gradingHub ? null : a)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Inline detail panel */}
                <AnimatePresence>
                  {selected?.id === a.id && !gradingHub && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
                        {a.description && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
                            <p className="text-gray-700 whitespace-pre-line">{a.description}</p>
                          </div>
                        )}
                        {a.type === "ON_SITE" && a.location && (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Location</p>
                            <p className="text-gray-700 flex items-center gap-1"><MapPin size={13} className="text-orange-400" />{a.location}</p>
                          </div>
                        )}
                        {a.type === "ON_SITE" && a.duration && (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Duration</p>
                            <p className="text-gray-700">{a.duration}</p>
                          </div>
                        )}
                        {a.rubric && Array.isArray(a.rubric) && a.rubric.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Rubric</p>
                            <div className="space-y-1.5">
                              {(a.rubric as { criterion: string; max_points: number; description?: string }[]).map((r, i) => (
                                <div key={i} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <div>
                                    <p className="font-medium text-gray-800">{r.criterion}</p>
                                    {r.description && <p className="text-gray-500 text-xs mt-0.5">{r.description}</p>}
                                  </div>
                                  <span className="text-xs text-purple-600 font-semibold ml-4 flex-shrink-0">{r.max_points} pts</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {a.answer_sheet_url && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Answer Key / Mark Scheme</p>
                            <a
                              href={`http://127.0.0.1:8000${a.answer_sheet_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs text-amber-700 border border-amber-200"
                            >
                              <BookOpenCheck size={12} /> View Answer Key
                            </a>
                          </div>
                        )}
                        {a.attachments.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Attachments</p>
                            <div className="flex flex-wrap gap-2">
                              {a.attachments.map(att => (
                                <a
                                  key={att.id}
                                  href={`http://127.0.0.1:8000${att.file_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700"
                                >
                                  <Download size={12} /> {att.file_name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Grading Hub modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {gradingHub && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-stretch justify-end"
            onClick={e => { if (e.target === e.currentTarget) setGradingHub(false); }}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-5xl bg-white flex flex-col h-full shadow-2xl"
            >
              {/* Hub header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-800 px-6 py-4 text-white flex items-start justify-between flex-shrink-0">
                <div>
                  <p className="text-purple-200 text-xs uppercase tracking-widest">
                    {selected.type === "ON_SITE" ? "On-site Grading Hub" : "Grading Hub"}
                  </p>
                  <h2 className="text-lg font-bold mt-0.5">{selected.title}</h2>
                  <p className="text-purple-200 text-sm mt-0.5">
                    {selected.subject_name} · {selected.class_name} · Max {selected.max_score} pts
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {selected.answer_sheet_url && (
                    <a
                      href={`http://127.0.0.1:8000${selected.answer_sheet_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white font-medium transition-colors"
                    >
                      <BookOpenCheck size={13} /> Answer Key
                    </a>
                  )}
                  <button onClick={() => setGradingHub(false)} className="text-white/70 hover:text-white">
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-6 px-6 py-3 bg-purple-50 border-b border-purple-100 text-sm flex-shrink-0 flex-wrap">
                <span className="text-gray-600">
                  {selected.type === "ON_SITE" ? "Not graded" : "Pending"}: <strong>{pendingCount}</strong>
                </span>
                {selected.type === "ONLINE" && (
                  <span className="text-blue-600">Submitted: <strong>{submittedCount}</strong></span>
                )}
                <span className="text-amber-600">Graded: <strong>{gradedCount}</strong></span>
                <span className="text-green-600">Published: <strong>{publishedCount}</strong></span>
                {selected.type === "ONLINE" && (
                  <span className="text-purple-600">AI Reviewed: <strong>{aiReviewedCount}</strong></span>
                )}
                <div className="ml-auto flex gap-2">
                  {selected.type === "ONLINE" && (
                    <button
                      onClick={runAIReview}
                      disabled={aiRunning || submittedCount === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {aiRunning ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                      Run AI Review
                    </button>
                  )}
                  <button
                    onClick={publishGrades}
                    disabled={publishingGrades || gradedCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {publishingGrades ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Publish Grades
                  </button>
                </div>
              </div>

              {hubMsg && (
                <div className="mx-6 mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2 flex-shrink-0">
                  <AlertCircle size={14} /> {hubMsg}
                  <button onClick={() => setHubMsg("")} className="ml-auto"><X size={12} /></button>
                </div>
              )}

              {/* Two-column body */}
              <div className="flex-1 overflow-hidden flex min-h-0">

                {/* Left: student list */}
                <div className="w-72 border-r border-gray-200 flex flex-col flex-shrink-0">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {selected.type === "ON_SITE" ? "Class Roster" : "Students"}
                    </p>
                    {selected.type === "ON_SITE" && (
                      <span className="text-xs text-gray-400">{roster.length} students</span>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {subLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin text-purple-400" size={24} />
                      </div>
                    ) : selected.type === "ON_SITE" ? (
                      roster.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">No students enrolled.</div>
                      ) : (
                        roster.map(entry => (
                          <button
                            key={entry.student_id}
                            onClick={() => selectRosterEntry(entry)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${gradingRosterEntry?.student_id === entry.student_id ? "bg-purple-50 border-l-2 border-l-purple-500" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{entry.student_name ?? `Student #${entry.student_id}`}</p>
                                {entry.student_code && <p className="text-xs text-gray-400">{entry.student_code}</p>}
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${SUB_STATUS_COLORS[entry.submission_status]}`}>
                                {entry.submission_status}
                              </span>
                            </div>
                            {entry.grade !== null && (
                              <p className="text-xs text-green-600 font-semibold mt-0.5">{entry.grade} / {selected.max_score}</p>
                            )}
                          </button>
                        ))
                      )
                    ) : (
                      submissions.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">No submissions yet.</div>
                      ) : (
                        submissions.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => selectSub(sub)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${gradingSub?.id === sub.id ? "bg-purple-50 border-l-2 border-l-purple-500" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{sub.student_name ?? `Student #${sub.student_id}`}</p>
                                {sub.student_code && <p className="text-xs text-gray-400">{sub.student_code}</p>}
                              </div>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {sub.ai_reviewed && (
                                  <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Bot size={10} /> AI
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${SUB_STATUS_COLORS[sub.status]}`}>
                                  {sub.status}
                                </span>
                              </div>
                            </div>
                            {sub.grade !== null && (
                              <p className="text-xs text-green-600 font-semibold mt-0.5">{sub.grade} / {selected.max_score}</p>
                            )}
                          </button>
                        ))
                      )
                    )}
                  </div>
                </div>

                {/* Right: grading form */}
                <div className="flex-1 overflow-y-auto p-6">
                  {selected.type === "ON_SITE" ? (
                    !gradingRosterEntry ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <School size={40} className="mb-3 opacity-30" />
                        <p className="text-lg font-medium">Select a student to grade</p>
                        <p className="text-sm mt-1">All enrolled students are listed on the left.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{gradingRosterEntry.student_name}</h3>
                            <p className="text-sm text-gray-500">{gradingRosterEntry.student_code}</p>
                          </div>
                          <span className={`text-sm px-3 py-1 rounded-full ${SUB_STATUS_COLORS[gradingRosterEntry.submission_status]}`}>
                            {gradingRosterEntry.submission_status}
                          </span>
                        </div>

                        {/* On-site badge */}
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2">
                          <School size={14} className="text-orange-500 flex-shrink-0" />
                          <span className="text-xs text-orange-700">On-site assessment — enter the grade directly below. No file upload required.</span>
                        </div>

                        {/* Grading form */}
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                              Grade (max {selected.max_score})
                            </label>
                            <input
                              type="number"
                              min={0} max={Number(selected.max_score)} step={0.5}
                              value={gradeInput}
                              onChange={e => setGradeInput(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                              placeholder={`0 – ${selected.max_score}`}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">Feedback</label>
                            <RichTextEditor
                              content={feedbackInput}
                              onChange={setFeedbackInput}
                            />
                          </div>
                          <button
                            onClick={saveGrade}
                            disabled={savingGrade}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          >
                            {savingGrade ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            Save Grade
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    !gradingSub ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Star size={40} className="mb-3 opacity-30" />
                        <p className="text-lg font-medium">Select a student to grade</p>
                        <p className="text-sm mt-1">Click a name from the list on the left.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{gradingSub.student_name}</h3>
                            <p className="text-sm text-gray-500">{gradingSub.student_code}</p>
                          </div>
                          <span className={`text-sm px-3 py-1 rounded-full ${SUB_STATUS_COLORS[gradingSub.status]}`}>
                            {gradingSub.status}
                          </span>
                        </div>

                        {/* AI Draft banner */}
                        {gradingSub.ai_reviewed && gradingSub.ai_reviews.length > 0 && (
                          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <Bot size={15} className="text-purple-600" />
                              <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">AI Draft</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                gradingSub.ai_reviews[gradingSub.ai_reviews.length - 1].confidence_score === "high"
                                  ? "bg-green-100 text-green-700"
                                  : gradingSub.ai_reviews[gradingSub.ai_reviews.length - 1].confidence_score === "medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}>
                                {gradingSub.ai_reviews[gradingSub.ai_reviews.length - 1].confidence_score} confidence
                              </span>
                            </div>
                            {gradingSub.ai_reviews[gradingSub.ai_reviews.length - 1].suggested_grade !== null && (
                              <p className="text-sm text-purple-800">
                                Suggested: <strong>{gradingSub.ai_reviews[gradingSub.ai_reviews.length - 1].suggested_grade} pts</strong>
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              Fields below pre-filled. Review and save to accept.
                            </p>
                          </div>
                        )}

                        {/* Submitted files */}
                        {gradingSub.sub_attachments.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Submitted Files</p>
                            <div className="flex flex-wrap gap-2">
                              {gradingSub.sub_attachments.map(att => (
                                <a
                                  key={att.id}
                                  href={`http://127.0.0.1:8000${att.file_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs text-blue-700 border border-blue-200"
                                >
                                  <FileText size={12} /> {att.file_name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Grading form */}
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                              Grade (max {selected.max_score})
                            </label>
                            <input
                              type="number"
                              min={0} max={Number(selected.max_score)} step={0.5}
                              value={gradeInput}
                              onChange={e => setGradeInput(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                              placeholder={`0 – ${selected.max_score}`}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">Feedback</label>
                            <RichTextEditor
                              content={feedbackInput}
                              onChange={setFeedbackInput}
                            />
                          </div>
                          <button
                            onClick={saveGrade}
                            disabled={savingGrade}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          >
                            {savingGrade ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            Save Grade
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Assignment modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Plus size={20} className="text-purple-500" /> New Assignment
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={15} /> {createError}
                  </div>
                )}

                {/* Type selector */}
                <div className="grid grid-cols-2 gap-3">
                  {(["ONLINE", "ON_SITE"] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        form.type === t ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {t === "ONLINE"
                        ? <Monitor size={20} className="text-blue-500" />
                        : <School size={20} className="text-orange-500" />}
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-800">{t === "ONLINE" ? "Online" : "On-site"}</p>
                        <p className="text-xs text-gray-400">{t === "ONLINE" ? "File/link submission" : "In-class work"}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Class + Subject */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Class *</label>
                    <select
                      required value={form.class_id}
                      onChange={e => setForm(f => ({ ...f, class_id: e.target.value, subject_id: "" }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      <option value="">Select class…</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Subject *</label>
                    <select
                      required value={form.subject_id}
                      onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                      disabled={!form.class_id}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                    >
                      <option value="">Select subject…</option>
                      {currentSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Title *</label>
                  <input
                    required value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    placeholder="Assignment title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Description / Instructions</label>
                  <textarea
                    rows={3} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                    placeholder="Describe the assignment…"
                  />
                </div>

                {/* Due date + max score */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Due Date & Time</label>
                    <input
                      type="datetime-local" value={form.due_at}
                      onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Max Score</label>
                    <input
                      type="number" min={1} value={form.max_score}
                      onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                </div>

                {/* On-site fields */}
                {form.type === "ON_SITE" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1.5">
                        <MapPin size={13} className="text-orange-400" /> Location / Room
                      </label>
                      {locations.length > 0 ? (
                        <select
                          value={form.location}
                          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        >
                          <option value="">Select location…</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.name}>
                              {loc.name}{loc.capacity ? ` (cap. ${loc.capacity})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={form.location}
                          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                          placeholder="e.g. Lab B, Room 204"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Duration</label>
                      <input
                        value={form.duration}
                        onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        placeholder="e.g. 90 minutes"
                      />
                    </div>
                  </div>
                )}

                {/* Rubric */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Rubric Criteria (optional)</label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, rubric: [...f.rubric, { criterion: "", max_points: "10" }] }))}
                      className="text-xs text-purple-600 hover:text-purple-800"
                    >
                      + Add criterion
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.rubric.map((r, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={r.criterion}
                          onChange={e => {
                            const updated = [...form.rubric];
                            updated[i] = { ...updated[i], criterion: e.target.value };
                            setForm(f => ({ ...f, rubric: updated }));
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                          placeholder="Criterion name"
                        />
                        <input
                          type="number" min={0}
                          value={r.max_points}
                          onChange={e => {
                            const updated = [...form.rubric];
                            updated[i] = { ...updated[i], max_points: e.target.value };
                            setForm(f => ({ ...f, rubric: updated }));
                          }}
                          className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                          placeholder="pts"
                        />
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, rubric: f.rubric.filter((_, j) => j !== i) }))}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Attachments</label>
                  <input
                    ref={fileRef} type="file" multiple className="hidden"
                    accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.zip,.txt"
                    onChange={e => setCreateFiles(Array.from(e.target.files ?? []))}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
                  >
                    <Upload size={15} />
                    {createFiles.length > 0 ? `${createFiles.length} file(s) selected` : "Attach files"}
                  </button>
                  {createFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {createFiles.map((f, i) => (
                        <span key={i} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-xs text-gray-600">
                          {f.name}
                          <button type="button" onClick={() => setCreateFiles(files => files.filter((_, j) => j !== i))}>
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Answer Sheet / Mark Scheme */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1.5">
                    <BookOpenCheck size={15} className="text-amber-500" />
                    Answer Key / Mark Scheme
                    <span className="text-xs text-gray-400 font-normal">(optional — used by AI for grading)</span>
                  </label>
                  <input
                    ref={answerSheetRef} type="file" className="hidden"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={e => setAnswerSheet(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => answerSheetRef.current?.click()}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                      answerSheet
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-dashed border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600"
                    }`}
                  >
                    <Upload size={15} />
                    {answerSheet ? answerSheet.name : "Upload answer key (PDF / DOCX / TXT)"}
                  </button>
                  {answerSheet && (
                    <button
                      type="button"
                      onClick={() => setAnswerSheet(null)}
                      className="mt-1 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    >
                      <X size={11} /> Remove
                    </button>
                  )}
                </div>

                {/* Publish toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, publish: !f.publish }))}
                    className={`w-10 h-6 rounded-full transition-colors ${form.publish ? "bg-purple-600" : "bg-gray-300"} relative`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.publish ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                  <span className="text-sm text-gray-700">Publish immediately</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    {form.publish ? "Create & Publish" : "Save as Draft"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}
