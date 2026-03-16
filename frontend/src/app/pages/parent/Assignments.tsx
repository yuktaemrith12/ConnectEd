import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  GraduationCap, Search, Monitor, School, Clock, ChevronDown,
  Loader2, AlertCircle, Star, Download, FileText, CheckCircle,
  ThumbsUp, Lightbulb, ArrowRight,
} from "lucide-react";
import { parentGetAssignments, AssignmentRead, StructuredFeedback } from "@/app/utils/api";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { FeedbackRenderer } from "@/app/components/FeedbackRenderer";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "No deadline";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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

function statusPill(a: AssignmentRead): { label: string; cls: string } {
  const sub = a.submission;
  if (!sub || sub.status === "PENDING") {
    if (isOverdue(a.due_at)) return { label: "Overdue",   cls: "bg-red-100 text-red-700" };
    if (dueSoon(a.due_at))   return { label: "Due Soon",  cls: "bg-amber-100 text-amber-700" };
    return                          { label: "Upcoming",  cls: "bg-blue-100 text-blue-700" };
  }
  if (sub.status === "SUBMITTED") return { label: "Submitted", cls: "bg-cyan-100 text-cyan-700" };
  if (sub.status === "GRADED")    return { label: "Graded",    cls: "bg-purple-100 text-purple-700" };
  if (sub.status === "PUBLISHED") return { label: "Graded",    cls: "bg-green-100 text-green-700" };
  return { label: sub.status, cls: "bg-gray-100 text-gray-600" };
}

const CARD_BORDER: Record<string, string> = {
  Upcoming:  "border-l-blue-500",
  "Due Soon":"border-l-amber-500",
  Overdue:   "border-l-red-500",
  Submitted: "border-l-cyan-500",
  Graded:    "border-l-green-500",
};

// ── Shared markdown renderer (identical to student portal) ───────────────────

function renderInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|__[^_\n]+__|\b\d+\/\d+\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    const raw = m[0];
    const key = `${m.index}`;
    if (raw.startsWith("**")) {
      result.push(<strong key={key} className="font-semibold text-gray-900">{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("__")) {
      result.push(<span key={key} className="underline decoration-green-400 decoration-2">{raw.slice(2, -2)}</span>);
    } else if (raw.startsWith("*")) {
      result.push(<em key={key} className="italic text-gray-600">{raw.slice(1, -1)}</em>);
    } else {
      const [a, b] = raw.split("/").map(Number);
      const cls = a === 0
        ? "bg-red-100 text-red-700 border border-red-200"
        : a === b
        ? "bg-green-100 text-green-700 border border-green-200"
        : "bg-amber-100 text-amber-700 border border-amber-200";
      result.push(
        <span key={key} className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-bold text-xs mx-0.5 ${cls}`}>
          {raw}
        </span>
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  const lines = text.split(/\\n|\n/);
  return (
    <div className={className}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const isSectionHeader = /^\s*\*\*/.test(line);
        return (
          <p key={i} className={["leading-relaxed", isSectionHeader ? "mt-3 first:mt-0 text-sm text-gray-800" : "mt-1 text-sm text-gray-700"].join(" ")}>
            {renderInline(line.trim())}
          </p>
        );
      })}
    </div>
  );
}

function SupportiveFeedbackCard({ sf, grade, maxScore }: { sf: StructuredFeedback; grade: number; maxScore: number }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-extrabold text-green-700 tracking-tight">{grade}</span>
        <span className="text-base text-green-500 font-medium">/ {maxScore} pts</span>
      </div>
      {sf.grade_summary && (
        <div className="pl-3 border-l-4 border-green-300">
          <p className="text-sm text-gray-700 italic leading-relaxed font-medium">{sf.grade_summary}</p>
        </div>
      )}

      {sf.breakdown && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Detailed Breakdown</span>
          </div>
          <div className="px-4 py-3"><MarkdownText text={sf.breakdown} /></div>
        </div>
      )}

      {sf.strengths.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 border-b border-green-200">
            <ThumbsUp size={13} className="text-green-600" />
            <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Strengths</span>
          </div>
          <ul className="px-4 py-3 space-y-2">
            {sf.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-green-900 leading-snug">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sf.areas_to_improve.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border-b border-amber-200">
            <Lightbulb size={13} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Topics to Revisit</span>
          </div>
          <ul className="px-4 py-3 space-y-2">
            {sf.areas_to_improve.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-1.5" />
                <span className="text-sm text-amber-900 leading-snug font-medium">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sf.key_corrections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Concept Clarifications</p>
          {sf.key_corrections.map((kc, i) => (
            <div key={i} className="rounded-xl border border-blue-200 overflow-hidden">
              <div className="bg-blue-50 px-4 py-2">
                <p className="text-xs text-blue-500">{kc.misconception}</p>
              </div>
              <div className="bg-white px-4 py-2.5 flex items-start gap-2">
                <ArrowRight size={13} className="flex-shrink-0 mt-0.5 text-blue-500" />
                <p className="text-sm text-blue-900 font-medium leading-snug">{kc.correction}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {sf.next_steps.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
            <ArrowRight size={13} className="text-green-500" />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Path Forward</span>
          </div>
          <ol className="px-4 py-3 space-y-2.5">
            {sf.next_steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{i + 1}</span>
                <span className="text-sm text-gray-700 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {sf.summary_paragraph && (
        <div className="rounded-xl border border-green-100 overflow-hidden">
          <div className="px-4 py-2 bg-green-50 border-b border-green-100">
            <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Teacher's Note</span>
          </div>
          <div className="bg-white px-4 py-3"><MarkdownText text={sf.summary_paragraph} /></div>
        </div>
      )}
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ParentAssignments() {
  const { childId } = useParams<{ childId: string }>();
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!childId || childId === "0") { setLoading(false); return; }
    parentGetAssignments(Number(childId))
      .then(setAssignments)
      .catch(() => setError("Failed to load assignments."))
      .finally(() => setLoading(false));
  }, [childId]);

  const filtered = assignments.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.subject_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "ALL" || a.type === filterType;
    if (filterStatus === "ALL") return matchSearch && matchType;
    const { label } = statusPill(a);
    if (filterStatus === "PENDING")   return matchSearch && matchType && label === "Upcoming";
    if (filterStatus === "SUBMITTED") return matchSearch && matchType && label === "Submitted";
    if (filterStatus === "GRADED")    return matchSearch && matchType && label === "Graded";
    if (filterStatus === "OVERDUE")   return matchSearch && matchType && label === "Overdue";
    return matchSearch && matchType;
  });

  if (loading) return (
    <DashboardLayout role="parent">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    </DashboardLayout>
  );

  if (!childId || childId === "0") return (
    <DashboardLayout role="parent">
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No child selected.</p>
      </div>
    </DashboardLayout>
  );

  const totalCount     = assignments.length;
  const pendingCount   = assignments.filter(a => { const { label } = statusPill(a); return label === "Upcoming" || label === "Due Soon"; }).length;
  const submittedCount = assignments.filter(a => statusPill(a).label === "Submitted").length;
  const gradedCount    = assignments.filter(a => statusPill(a).label === "Graded").length;
  const overdueCount   = assignments.filter(a => statusPill(a).label === "Overdue").length;

  return (
    <DashboardLayout role="parent">
      <div>
        {/* ── Hero header ───────────────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-green-800 via-green-300 to-emerald-400 p-6 text-white relative">
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
            />
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  Assignments
                </h1>
                
                <p className="text-green-200 text-xs mt-1">Read-only view of your child's assignments</p>
              </div>
            </div>

            {/* Quick stats chips */}
            <div className="mt-6 w-full flex justify-center">
              <div className="flex flex-wrap justify-center gap-4">
                {[
                  { label: "Upcoming",  val: pendingCount },
                  { label: "Submitted", val: submittedCount },
                  { label: "Graded",    val: gradedCount },
                  { label: "Overdue",   val: overdueCount },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    onClick={() => setFilterStatus(
                      label === "Upcoming"  ? "PENDING"   :
                      label === "Submitted" ? "SUBMITTED" :
                      label === "Graded"    ? "GRADED"    :
                      label === "Overdue"   ? "OVERDUE"   : "ALL"
                    )}
                    className={[
                      "min-w-[130px] rounded-2xl px-5 py-3 cursor-pointer",
                      "backdrop-blur-md border shadow-sm",
                      "text-center transition-transform duration-200",
                      "hover:-translate-y-0.5 hover:bg-white/20",
                      "bg-white/15 border-white/20",
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

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                placeholder="Search assignments…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="ONLINE">Online</option>
              <option value="ON_SITE">On-site</option>
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Upcoming</option>
              <option value="OVERDUE">Overdue</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="GRADED">Graded</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* ── List ──────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No assignments found</p>
            </div>
          ) : (
            filtered.map(a => {
              const { label, cls } = statusPill(a);
              const sub = a.submission;
              const isOpen = expanded === a.id;
              const hasGrade = sub?.status === "PUBLISHED";
              const borderCls = CARD_BORDER[label] ?? "border-l-gray-300";

              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderCls} overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
                >
                  {/* Card header */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    className="w-full text-left p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {a.type === "ONLINE"
                            ? <Monitor size={14} className="text-blue-500 flex-shrink-0" />
                            : <School size={14} className="text-orange-500 flex-shrink-0" />}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
                          <span className="text-xs text-gray-400">{a.subject_name}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{a.title}</h3>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {isOverdue(a.due_at)
                              ? <span className="text-red-500">Overdue · {formatDate(a.due_at)}</span>
                              : dueSoon(a.due_at)
                              ? <span className="text-amber-600">Due soon · {formatDate(a.due_at)}</span>
                              : formatDate(a.due_at)}
                          </span>
                          <span>Max: {a.max_score} pts</span>
                          {a.type === "ON_SITE" && a.location && (
                            <span>Location: {a.location}</span>
                          )}
                          {a.type === "ON_SITE" && a.duration && (
                            <span>Duration: {a.duration}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasGrade && sub && (
                          <span className="text-sm font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-lg border border-green-200">
                            {sub.grade} / {a.max_score}
                          </span>
                        )}
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded panel */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-gray-100"
                      >
                        <div className="p-5 space-y-4">
                          {/* Description */}
                          {a.description && (
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Instructions</p>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{a.description}</p>
                            </div>
                          )}

                          {/* On-site info */}
                          {a.type === "ON_SITE" && (
                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
                              <p className="font-semibold text-orange-700 mb-1 flex items-center gap-1.5">
                                <School size={14} /> On-site Assignment
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-orange-700 text-xs">
                                {a.location && <span>Location: <strong>{a.location}</strong></span>}
                                {a.duration && <span>Duration: <strong>{a.duration}</strong></span>}
                              </div>
                            </div>
                          )}

                          {/* Rubric */}
                          {a.rubric && Array.isArray(a.rubric) && a.rubric.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Rubric</p>
                              <div className="space-y-1.5">
                                {(a.rubric as { criterion: string; max_points: number; description?: string }[]).map((r, i) => (
                                  <div key={i} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                                    <div>
                                      <p className="font-medium text-gray-800">{r.criterion}</p>
                                      {r.description && <p className="text-gray-500 text-xs mt-0.5">{r.description}</p>}
                                    </div>
                                    <span className="text-xs text-green-600 font-semibold ml-4 flex-shrink-0">{r.max_points} pts</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Teacher attachments */}
                          {a.attachments.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Resources</p>
                              <div className="flex flex-wrap gap-2">
                                {a.attachments.map(att => (
                                  <a
                                    key={att.id}
                                    href={`http://127.0.0.1:8000${att.file_url}`}
                                    target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700"
                                  >
                                    <Download size={12} /> {att.file_name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Child's submitted files (read-only) */}
                          {sub && sub.sub_attachments.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Submitted Files</p>
                              <div className="flex flex-wrap gap-2">
                                {sub.sub_attachments.map(att => (
                                  <span key={att.id} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-50 rounded-lg text-xs text-cyan-700 border border-cyan-200">
                                    <FileText size={12} /> {att.file_name}
                                  </span>
                                ))}
                              </div>
                              {sub.submitted_at && (
                                <p className="text-xs text-gray-400 mt-1">Submitted {formatDate(sub.submitted_at)}</p>
                              )}
                            </div>
                          )}

                          {/* Published grade + feedback */}
                          {hasGrade && sub && (() => {
                            const latestReview = sub.ai_reviews.length > 0
                              ? sub.ai_reviews[sub.ai_reviews.length - 1]
                              : null;
                            const sf = latestReview?.structured_feedback ?? null;
                            return (
                              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                  <Star size={16} className="text-green-600" />
                                  <span className="font-semibold text-green-700">Grade Released</span>
                                </div>
                                {sub.feedback ? (
                                  <>
                                    <span className="text-lg font-bold text-green-700">
                                      {sub.grade} <span className="text-sm font-normal text-green-600">/ {a.max_score}</span>
                                    </span>
                                    <div className="mt-2">
                                      <p className="text-xs text-green-600 uppercase tracking-wide mb-1">Teacher Feedback</p>
                                      <FeedbackRenderer content={sub.feedback} />
                                    </div>
                                  </>
                                ) : sf ? (
                                  <SupportiveFeedbackCard sf={sf} grade={sub.grade!} maxScore={a.max_score} />
                                ) : (
                                  <span className="text-lg font-bold text-green-700">
                                    {sub.grade} <span className="text-sm font-normal text-green-600">/ {a.max_score}</span>
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          {/* Submitted, awaiting review */}
                          {sub?.status === "SUBMITTED" && !hasGrade && (
                            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-sm text-cyan-700 flex items-center gap-2">
                              <CheckCircle size={15} />
                              Submitted on {formatDate(sub.submitted_at)}. Awaiting teacher review.
                            </div>
                          )}

                          {/* Overdue with no submission */}
                          {isOverdue(a.due_at) && (!sub || sub.status === "PENDING") && a.type === "ONLINE" && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                              <AlertCircle size={15} />
                              Deadline has passed. No submission was made.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
