import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Clock, CheckCircle, Calendar,
  X, Filter, AlertCircle, Loader2,
  BarChart3, Users, ChevronRight, Bot, Star,
  Lightbulb, BookOpen, ArrowRight, ThumbsUp,
  List, ListOrdered, Eye, Edit3, Wand2,
} from "lucide-react";
import {
  teacherGetAssignmentClasses,
  teacherGetAssignments,
  teacherGetSubmissions,
  gradingManual,
  AssignmentRead,
  SubmissionRead,
  AIReviewRead,
  TeacherClassSubjects,
  StructuredFeedback,
} from "@/app/utils/api";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { FeedbackRenderer, isHTMLContent, markdownToHTML } from "@/app/components/FeedbackRenderer";

// ── Inline markdown renderer ──────────────────────────────────────────────────

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
      result.push(<span key={key} className="underline decoration-purple-400 decoration-2">{raw.slice(2, -2)}</span>);
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
        const isSectionHeader = /^\s*\*\*/.test(line) && line.includes("**");
        return (
          <p
            key={i}
            className={[
              "leading-relaxed",
              isSectionHeader
                ? "mt-3 first:mt-0 text-sm text-gray-800"
                : "mt-1 text-sm text-gray-700",
            ].join(" ")}
          >
            {renderInline(line.trim())}
          </p>
        );
      })}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-gray-100 text-gray-600",
  ACTIVE:   "bg-blue-100 text-blue-700",
  CLOSED:   "bg-amber-100 text-amber-700",
  RELEASED: "bg-green-100 text-green-700",
};

const SUB_STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-gray-100 text-gray-500",
  SUBMITTED: "bg-blue-100 text-blue-700",
  GRADED:    "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-green-100 text-green-700",
};

const CONF_COLORS: Record<string, string> = {
  high:   "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-gray-100 text-gray-500",
};

// ── Convert structured AI feedback → HTML for loading into editor ─────────────

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

// ── RTE Toolbar ───────────────────────────────────────────────────────────────

function ToolbarBtn({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={[
        "flex items-center justify-center w-7 h-7 rounded text-sm transition-colors",
        active
          ? "bg-purple-100 text-purple-700"
          : "text-gray-600 hover:bg-gray-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function RTEToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
      {/* Bold / Italic / Underline */}
      <ToolbarBtn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <span className="font-bold text-sm">B</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <span className="italic text-sm">I</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <span className="underline text-sm">U</span>
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Headings */}
      <ToolbarBtn
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <span className="text-xs font-bold">H1</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <span className="text-xs font-bold">H2</span>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <span className="text-xs font-bold">H3</span>
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Lists */}
      <ToolbarBtn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <ListOrdered size={14} />
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Highlight */}
      <ToolbarBtn
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
      >
        <span className="text-xs font-bold" style={{ background: "linear-gradient(transparent 40%, #fde68a 40%)" }}>H</span>
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Clear formatting */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear Formatting"
      >
        <span className="text-xs text-gray-400 font-mono">Tx</span>
      </ToolbarBtn>
    </div>
  );
}

// ── Supportive Feedback Component ────────────────────────────────────────────

function SupportiveFeedback({ review, maxScore }: { review: AIReviewRead; maxScore: number }) {
  const sf = review.structured_feedback;

  return (
    <div className="space-y-4">

      {/* ── Grade header card ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-purple-600" />
            <span className="text-xs font-bold text-purple-700 uppercase tracking-widest">AI Review</span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CONF_COLORS[review.confidence_score]}`}>
            {review.confidence_score} confidence
          </span>
        </div>

        {review.suggested_grade !== null && (
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-extrabold text-purple-700 tracking-tight">
              {review.suggested_grade}
            </span>
            <span className="text-base text-purple-400 font-medium">/ {maxScore} pts</span>
            <span className="text-xs text-purple-400 ml-1">suggested</span>
          </div>
        )}

        {sf?.grade_summary && (
          <div className="mt-1 pl-3 border-l-4 border-purple-300">
            <p className="text-sm text-gray-700 italic leading-relaxed font-medium">
              {sf.grade_summary}
            </p>
          </div>
        )}

        {!sf && review.suggested_feedback && (
          <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-purple-200 whitespace-pre-line mt-2">
            {review.suggested_feedback}
          </p>
        )}
      </div>

      {sf && (
        <>
          {sf.breakdown && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <BookOpen size={14} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Detailed Breakdown</span>
              </div>
              <div className="px-4 py-3">
                <MarkdownText text={sf.breakdown} />
              </div>
            </div>
          )}

          {sf.strengths.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-100 border-b border-green-200">
                <ThumbsUp size={14} className="text-green-600" />
                <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Strengths</span>
              </div>
              <ul className="px-4 py-3 space-y-2">
                {sf.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-green-900 leading-snug">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sf.areas_to_improve.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 border-b border-amber-200">
                <Lightbulb size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Growth Areas</span>
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
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Concept Corrections</p>
              {sf.key_corrections.map((kc, i) => (
                <div key={i} className="rounded-xl border border-blue-200 overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 flex items-center gap-2">
                    <p className="text-xs text-blue-500 line-through">{kc.misconception}</p>
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
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <ArrowRight size={14} className="text-purple-500" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Path to Improvement</span>
              </div>
              <ol className="px-4 py-3 space-y-2.5">
                {sf.next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {sf.summary_paragraph && (
            <div className="rounded-xl border border-purple-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border-b border-purple-100">
                <Bot size={14} className="text-purple-500" />
                <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">Mentor's Note</span>
              </div>
              <div className="bg-white px-4 py-3">
                <MarkdownText text={sf.summary_paragraph} />
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-purple-400 flex items-center gap-1.5 pt-1">
        <AlertCircle size={11} />
        AI suggestions require teacher verification before publishing.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeacherGrading() {
  const [classes, setClasses]         = useState<TeacherClassSubjects[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  const [selectedClassId, setSelectedClassId]       = useState<number | null>(null);
  const [filterType, setFilterType]                 = useState<"all" | "ONLINE" | "ON_SITE">("all");
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRead | null>(null);

  const [drillSubs, setDrillSubs]       = useState<SubmissionRead[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillStudent, setDrillStudent] = useState<SubmissionRead | null>(null);

  useEffect(() => {
    Promise.all([teacherGetAssignmentClasses(), teacherGetAssignments()])
      .then(([cls, asgns]) => {
        setClasses(cls);
        setAssignments(asgns);
        if (cls.length > 0) setSelectedClassId(cls[0].id);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  const classAssignments = assignments.filter(a => {
    const matchClass = selectedClassId === null || a.class_id === selectedClassId;
    const matchType  = filterType === "all" || a.type === filterType;
    return matchClass && matchType;
  });

  const totalSubmissions = classAssignments.reduce((s, a) => s + a.submission_count, 0);
  const totalGraded      = classAssignments.reduce((s, a) => s + a.graded_count, 0);
  const completionPct    = totalSubmissions > 0 ? Math.round((totalGraded / totalSubmissions) * 100) : 0;

  async function openDrillDown(asgn: AssignmentRead) {
    setSelectedAssignment(asgn);
    setDrillStudent(null);
    setDrillLoading(true);
    try {
      const subs = await teacherGetSubmissions(asgn.id);
      setDrillSubs(subs);
    } catch {
      setError("Failed to load submissions.");
    } finally {
      setDrillLoading(false);
    }
  }

  function closeDrill() {
    setSelectedAssignment(null);
    setDrillSubs([]);
    setDrillStudent(null);
  }

  const latestReview = drillStudent && drillStudent.ai_reviews.length > 0
    ? drillStudent.ai_reviews[drillStudent.ai_reviews.length - 1]
    : null;

  // ── Grading form state ────────────────────────────────────────────────────
  const [gradingGrade, setGradingGrade]     = useState<string>("");
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingSuccess, setGradingSuccess] = useState(false);
  const [feedbackTab, setFeedbackTab]       = useState<"editor" | "preview">("editor");

  // ── TipTap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [StarterKit, Underline, Highlight.configure({ multicolor: true })],
    content: "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setGradingFeedback(html === "<p></p>" ? "" : html);
    },
  });

  // Sync editor content when selected student changes
  useEffect(() => {
    if (drillStudent) {
      const fb = drillStudent.feedback ?? "";
      setGradingGrade(drillStudent.grade !== null ? String(drillStudent.grade) : "");
      setGradingFeedback(fb);
      setGradingSuccess(false);
      setFeedbackTab("editor");
      if (editor && !editor.isDestroyed) {
        const html = isHTMLContent(fb) ? fb : markdownToHTML(fb);
        editor.commands.setContent(html || "", { emitUpdate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillStudent?.id, editor]);

  // Load AI draft into editor
  const editorRef = useRef(editor);
  editorRef.current = editor;

  function loadAIDraftIntoEditor() {
    const sf = latestReview?.structured_feedback;
    if (!sf || !selectedAssignment) return;
    const html = structuredFeedbackToHTML(sf, latestReview?.suggested_grade ?? null, selectedAssignment.max_score);
    const ed = editorRef.current;
    if (ed && !ed.isDestroyed) {
      ed.commands.setContent(html, { emitUpdate: false });
    }
    setGradingFeedback(html);
    setFeedbackTab("editor");
  }

  async function saveGrade() {
    if (!drillStudent || !selectedAssignment) return;
    const g = parseFloat(gradingGrade);
    if (isNaN(g) || g < 0 || g > selectedAssignment.max_score) return;
    setGradingLoading(true);
    setGradingSuccess(false);
    const feedbackToSave = gradingFeedback.trim() === "" || gradingFeedback === "<p></p>"
      ? undefined
      : gradingFeedback;
    try {
      await gradingManual(drillStudent.id, g, feedbackToSave);
      const updated: SubmissionRead = {
        ...drillStudent,
        grade: g,
        feedback: feedbackToSave ?? null,
        status: "GRADED",
      };
      setDrillSubs(prev => prev.map(s => s.id === drillStudent.id ? updated : s));
      setDrillStudent(updated);
      setGradingSuccess(true);
    } catch {
      setError("Failed to save grade.");
    } finally {
      setGradingLoading(false);
    }
  }

  if (loading) return (
    <DashboardLayout role="teacher">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Grading Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">Class-level overview · drill down into any assignment</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
              <span className="text-sm font-semibold text-purple-700">{classAssignments.length} assignments</span>
            </div>
            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <span className="text-sm font-semibold text-green-700">{totalGraded}/{totalSubmissions} graded</span>
            </div>
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
              <span className="text-sm font-semibold text-blue-700">{completionPct}% complete</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={15} /> {error}
            <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Class selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Select Class</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedClassId(null)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedClassId === null
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Classes
            </button>
            {classes.map(cls => (
              <motion.button
                key={cls.id}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  selectedClassId === cls.id
                    ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cls.name}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Type:</span>
          {(["all", "ONLINE", "ON_SITE"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === t ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "All" : t === "ONLINE" ? "Online" : "On-site"}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {totalSubmissions > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BarChart3 size={16} className="text-purple-500" /> Grading Progress
              </span>
              <span className="text-sm font-bold text-purple-700">{completionPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{totalGraded} of {totalSubmissions} submissions graded</p>
          </div>
        )}

        {/* Assignment cards grid */}
        {classAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={32} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No assignments found</h3>
            <p className="text-sm text-gray-500">Select a different class or create assignments from the Assignments page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classAssignments.map(asgn => {
              const pendingCount = asgn.submission_count - asgn.graded_count;
              return (
                <motion.div
                  key={asgn.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(139,92,246,0.2)" }}
                  className="relative bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all overflow-hidden cursor-pointer"
                  onClick={() => openDrillDown(asgn)}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${asgn.type === "ONLINE" ? "bg-blue-500" : "bg-purple-500"}`} />
                  <div className="p-5 ml-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate mb-0.5">{asgn.title}</h3>
                        <p className="text-xs text-gray-500">{asgn.subject_name} · {asgn.class_name}</p>
                      </div>
                      <span className={`ml-2 flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[asgn.status]}`}>
                        {asgn.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                      <Calendar size={11} />
                      <span>Due: {fmtDate(asgn.due_at)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                          <p className="text-lg font-bold text-gray-900">{asgn.submission_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 mb-0.5">Pending</p>
                          <p className="text-lg font-bold text-purple-600">{pendingCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-green-600 mb-0.5">Graded</p>
                          <p className="text-lg font-bold text-green-600">{asgn.graded_count}</p>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      View Submissions <ChevronRight size={15} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Drill-down panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedAssignment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-stretch justify-end"
            onClick={e => { if (e.target === e.currentTarget) closeDrill(); }}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-5xl bg-white flex flex-col h-full shadow-2xl"
            >
              {/* Panel header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-4 text-white flex items-start justify-between flex-shrink-0">
                <div>
                  <p className="text-purple-200 text-xs uppercase tracking-widest">Submission Review</p>
                  <h2 className="text-lg font-bold mt-0.5">{selectedAssignment.title}</h2>
                  <p className="text-purple-200 text-sm mt-0.5">
                    {selectedAssignment.subject_name} · {selectedAssignment.class_name} · Max {selectedAssignment.max_score} pts
                  </p>
                </div>
                <button onClick={closeDrill} className="text-white/70 hover:text-white mt-1">
                  <X size={22} />
                </button>
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-6 px-6 py-3 bg-purple-50 border-b border-purple-100 text-sm flex-shrink-0 flex-wrap">
                <span className="text-gray-600">Submitted: <strong>{drillSubs.length}</strong></span>
                <span className="text-amber-600">Graded: <strong>{drillSubs.filter(s => s.status === "GRADED" || s.status === "PUBLISHED").length}</strong></span>
                <span className="text-purple-600">AI Reviewed: <strong>{drillSubs.filter(s => s.ai_reviewed).length}</strong></span>
                {drillSubs.filter(s => s.grade !== null).length > 0 && (
                  <span className="text-green-600">
                    Avg: <strong>
                      {(drillSubs.reduce((s, x) => s + (x.grade ?? 0), 0) / drillSubs.filter(s => s.grade !== null).length).toFixed(1)} pts
                    </strong>
                  </span>
                )}
              </div>

              {/* Two-column body */}
              <div className="flex-1 overflow-hidden flex min-h-0">
                {/* Student list */}
                <div className="w-72 border-r border-gray-200 flex flex-col flex-shrink-0">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Users size={13} /> Students ({drillSubs.length})
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {drillLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin text-purple-400" size={24} />
                      </div>
                    ) : drillSubs.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">No submissions yet.</div>
                    ) : (
                      drillSubs.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setDrillStudent(sub)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${drillStudent?.id === sub.id ? "bg-purple-50 border-l-2 border-l-purple-500" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{sub.student_name ?? `Student #${sub.student_id}`}</p>
                              {sub.student_code && <p className="text-xs text-gray-400">{sub.student_code}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1">
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
                            <p className="text-xs text-green-600 font-semibold mt-0.5">
                              {sub.grade} / {selectedAssignment.max_score} pts
                            </p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Student detail panel */}
                <div className="flex-1 overflow-y-auto p-6">
                  {!drillStudent ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <Star size={40} className="mb-3 opacity-30" />
                      <p className="text-lg font-medium">Select a student</p>
                      <p className="text-sm mt-1">Click a name from the list to view details.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Student header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{drillStudent.student_name}</h3>
                          <p className="text-sm text-gray-500">{drillStudent.student_code}</p>
                        </div>
                        <span className={`text-sm px-3 py-1 rounded-full font-medium ${SUB_STATUS_COLORS[drillStudent.status]}`}>
                          {drillStudent.status}
                        </span>
                      </div>

                      {/* Grade summary */}
                      {drillStudent.grade !== null && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="text-green-600" size={20} />
                            <span className="font-semibold text-green-800">Grade Assigned</span>
                          </div>
                          <span className="text-2xl font-bold text-green-700">
                            {drillStudent.grade} / {selectedAssignment.max_score}
                          </span>
                        </div>
                      )}

                      {/* Submitted files */}
                      {drillStudent.sub_attachments.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-semibold">Submitted Files</p>
                          <div className="flex flex-wrap gap-2">
                            {drillStudent.sub_attachments.map(att => (
                              <a
                                key={att.id}
                                href={`http://127.0.0.1:8000${att.file_url}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs text-blue-700 border border-blue-200"
                              >
                                <FileText size={12} /> {att.file_name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Section 1: AI Draft ──────────────────────────────── */}
                      {latestReview && (
                        <div className="rounded-xl border border-purple-200 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-purple-50 border-b border-purple-200">
                            <div className="flex items-center gap-2">
                              <Bot size={14} className="text-purple-600" />
                              <span className="text-xs font-bold text-purple-700 uppercase tracking-widest">AI Draft (Reference)</span>
                            </div>
                            <button
                              onClick={loadAIDraftIntoEditor}
                              disabled={!latestReview.structured_feedback}
                              className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                              title="Load AI suggestions into the editor below"
                            >
                              <Wand2 size={12} /> Load into Editor
                            </button>
                          </div>
                          <div className="p-4">
                            <SupportiveFeedback review={latestReview} maxScore={selectedAssignment.max_score} />
                          </div>
                        </div>
                      )}

                      {/* ── Section 2: Grade & Feedback Editor ──────────────── */}
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                            <Edit3 size={13} className="text-gray-500" /> Grade & Feedback
                          </span>
                          <div className="flex items-center gap-2">
                            {gradingSuccess && (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                                <CheckCircle size={12} /> Saved
                              </span>
                            )}
                            {/* Editor / Preview tab toggle */}
                            <div className="flex bg-gray-200 rounded-lg p-0.5 gap-0.5">
                              <button
                                onClick={() => setFeedbackTab("editor")}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                  feedbackTab === "editor"
                                    ? "bg-white text-gray-800 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                              >
                                <Edit3 size={11} /> Editor
                              </button>
                              <button
                                onClick={() => setFeedbackTab("preview")}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                  feedbackTab === "preview"
                                    ? "bg-white text-gray-800 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                              >
                                <Eye size={11} /> Preview
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          {/* Score input */}
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                              Score (max {selectedAssignment.max_score})
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={selectedAssignment.max_score}
                                step={0.5}
                                value={gradingGrade}
                                onChange={e => setGradingGrade(e.target.value)}
                                className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                                placeholder="0"
                              />
                              <span className="text-sm text-gray-400">/ {selectedAssignment.max_score} pts</span>
                            </div>
                          </div>

                          {/* Feedback — Editor or Preview */}
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                              Feedback
                            </label>

                            {feedbackTab === "editor" ? (
                              /* ── Rich Text Editor (document-like) ── */
                              <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-300">
                                <RTEToolbar editor={editor} />
                                <div
                                  className="bg-gray-100 p-3 cursor-text"
                                  onClick={() => editor?.commands.focus()}
                                >
                                  <div className="bg-white rounded shadow-sm mx-auto px-6 py-5 min-h-[250px]">
                                    <EditorContent editor={editor} />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* ── Live Preview ── */
                              <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
                                  <Eye size={12} className="text-gray-400" />
                                  <span className="text-xs text-gray-400">Student will see this</span>
                                </div>
                                <div className="p-4 bg-white min-h-[120px]">
                                  {gradingFeedback && gradingFeedback !== "<p></p>" ? (
                                    <FeedbackRenderer content={gradingFeedback} />
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">No feedback written yet.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={saveGrade}
                            disabled={gradingLoading || !gradingGrade}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {gradingLoading
                              ? <Loader2 size={14} className="animate-spin" />
                              : <CheckCircle size={14} />}
                            Save Grade
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} />
                        Submitted: {drillStudent.submitted_at ? fmtDate(drillStudent.submitted_at) : "Not yet"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
