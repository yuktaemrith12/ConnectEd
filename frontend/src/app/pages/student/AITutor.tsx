import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Send,
  ChevronLeft,
  Loader2,
  BookOpen,
  Pencil,
  Layers,
  GraduationCap,
  Video,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { StudentTutorRead, AiTutorSourceCitation, AiTutorInfographicRead } from "@/app/utils/api";
import { aiGetStudentTutors, aiStudentChat } from "@/app/utils/api";
import MarkdownRenderer from "@/app/components/ai-tutor/MarkdownRenderer";
import InfographicDisplay from "@/app/components/ai-tutor/InfographicDisplay";
import ConfidenceIndicator from "@/app/components/ai-tutor/ConfidenceIndicator";
import ActionButtons from "@/app/components/ai-tutor/ActionButtons";
import BookmarkButton from "@/app/components/ai-tutor/BookmarkButton";
import ExportPanel from "@/app/components/ai-tutor/ExportPanel";
import InlineQuiz, { parseQuizFromContent } from "@/app/components/ai-tutor/InlineQuiz";
import FlashcardDeck, { parseFlashcardsFromContent } from "@/app/components/ai-tutor/FlashcardDeck";
import { TutorIcon } from "@/app/components/ai-tutor/TutorIconPicker";

type Mode = "learn" | "revision" | "flashcards" | "exam_prep" | "recap";

const MODES: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "learn",      label: "Learn",       icon: BookOpen,      desc: "Explain concepts clearly with examples" },
  { id: "revision",   label: "Revision",    icon: Pencil,        desc: "Summaries, key points, revision notes" },
  { id: "flashcards", label: "Flashcards",  icon: Layers,        desc: "Generate interactive flashcards from your class material" },
  { id: "exam_prep",  label: "Exam Prep",   icon: GraduationCap, desc: "Exam-style questions and revision plans" },
  { id: "recap",      label: "Class Recap", icon: Video,         desc: "Summarise recent class sessions" },
];

const MODE_QUICK_PROMPTS: Record<Mode, string[]> = {
  learn:      ["Explain this concept step by step", "Give me a worked example", "What is the definition of…"],
  revision:   ["Summarise the key points of Chapter 1", "List the important formulas", "What are the must-know facts?"],
  flashcards: ["Generate flashcards for Chapter 1", "Make flashcards on key definitions", "Create 10 flashcards on this topic"],
  exam_prep:  ["Generate an exam-style question on…", "What are the most likely exam topics?", "Mark my answer: …"],
  recap:      ["What did we cover in the last class?", "Summarise the session on…", "What were the key takeaways?"],
};

const MODE_ACTIVE_CLASS: Record<Mode, string> = {
  learn:      "bg-blue-600 text-white shadow-md shadow-blue-200",
  revision:   "bg-purple-600 text-white shadow-md shadow-purple-200",
  flashcards: "bg-indigo-600 text-white shadow-md shadow-indigo-200",
  exam_prep:  "bg-rose-600 text-white shadow-md shadow-rose-200",
  recap:      "bg-amber-500 text-white shadow-md shadow-amber-200",
};

const MODE_BORDER_CLASS: Record<Mode, string> = {
  learn:      "border-l-blue-400",
  revision:   "border-l-purple-400",
  flashcards: "border-l-indigo-400",
  exam_prep:  "border-l-rose-400",
  recap:      "border-l-amber-400",
};

const MODE_GRADIENT: Record<Mode, string> = {
  learn:      "from-blue-500 to-blue-600",
  revision:   "from-purple-500 to-purple-600",
  flashcards: "from-indigo-500 to-indigo-600",
  exam_prep:  "from-rose-500 to-rose-600",
  recap:      "from-amber-500 to-amber-600",
};

const MODE_ICON_COLOR: Record<Mode, string> = {
  learn:      "text-blue-600",
  revision:   "text-purple-600",
  flashcards: "text-indigo-600",
  exam_prep:  "text-rose-600",
  recap:      "text-amber-500",
};

const MODE_BG_SUBTLE: Record<Mode, string> = {
  learn:      "bg-blue-50",
  revision:   "bg-purple-50",
  flashcards: "bg-indigo-50",
  exam_prep:  "bg-rose-50",
  recap:      "bg-amber-50",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  pdf:        "PDF",
  transcript: "Transcript",
  pptx:       "Slides",
  docx:       "Document",
};

// Rotating gradients for tutor cards on the selection screen
const CARD_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

interface LocalMessage {
  id:             string;
  role:           "user" | "assistant";
  content:        string;
  sources:        AiTutorSourceCitation[];
  ts:             Date;
  confidence?:    "high" | "medium" | "low";
  response_type?: string;
  infographic?:   AiTutorInfographicRead | null;
}

function isSystemMsg(msg: LocalMessage) {
  return msg.id === "welcome" || msg.id.startsWith("mode-switch-");
}

// ── Source citations ──────────────────────────────────────────────────────────

function SourceCards({ sources }: { sources: AiTutorSourceCitation[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <FileText size={12} />
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {sources.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText size={10} className="text-blue-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {s.filename || "Class material"}
                    </span>
                    {s.doc_type && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium flex-shrink-0">
                        {DOC_TYPE_LABEL[s.doc_type] ?? s.doc_type.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{s.chunk_text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StudentAITutor() {
  const [tutors,     setTutors]     = useState<StudentTutorRead[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<StudentTutorRead | null>(null);
  const [mode,       setMode]       = useState<Mode>("learn");
  const [sessionId,  setSessionId]  = useState<number | null>(null);
  const [messages,   setMessages]   = useState<LocalMessage[]>([]);
  const [input,      setInput]      = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [flashTopic, setFlashTopic] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiGetStudentTutors().then(setTutors).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  function selectTutor(t: StudentTutorRead) {
    setSelected(t);
    setMode("learn");
    setSessionId(null);
    setMessages([{
      id:      "welcome",
      role:    "assistant",
      content: `Hello! I'm your **${t.subject_name}** tutor for ${t.class_name}. I have access to ${t.doc_count} document${t.doc_count !== 1 ? "s" : ""} and ${t.chapter_count} chapter${t.chapter_count !== 1 ? "s" : ""}. How can I help you today?`,
      sources: [],
      ts:      new Date(),
    }]);
  }

  function switchMode(m: Mode) {
    setMode(m);
    const modeInfo = MODES.find(x => x.id === m)!;
    setMessages(prev => [...prev, {
      id:      `mode-switch-${Date.now()}`,
      role:    "assistant",
      content: `Switched to **${modeInfo.label}** mode. ${modeInfo.desc}.`,
      sources: [],
      ts:      new Date(),
    }]);
  }

  async function handleSend(text?: string) {
    const content = (text || input).trim();
    if (!content || !selected || isThinking) return;

    setInput("");
    const userMsg: LocalMessage = {
      id:      Date.now().toString(),
      role:    "user",
      content,
      sources: [],
      ts:      new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const resp = await aiStudentChat({
        tutor_id:   selected.id,
        session_id: sessionId || undefined,
        mode,
        message:    content,
      });
      if (!sessionId) setSessionId(resp.session_id);
      const aiMsg: LocalMessage = {
        id:            resp.message_id.toString(),
        role:          "assistant",
        content:       resp.content,
        sources:       resp.sources,
        ts:            new Date(),
        confidence:    resp.confidence ?? undefined,
        response_type: resp.response_type ?? undefined,
        infographic:   resp.infographic ?? null,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    "assistant",
        content: "Sorry, I couldn't process your request. Please try again.",
        sources: [],
        ts:      new Date(),
      }]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleGenerateFlashcards() {
    const topic = flashTopic.trim() || "all available class material";
    handleSend(`Generate 10 flashcards for ${topic}`);
    setFlashTopic("");
  }

  // ── Tutor selection screen ──────────────────────────────────────────────────

  if (!selected) {
    return (
      <DashboardLayout role="student">
        <div className="space-y-6">
          {/* Hero banner */}
          <motion.div
            whileHover={{ scale: 1.006 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative overflow-hidden bg-gradient-to-br from-sky-400 via-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-lg shadow-blue-400/30 cursor-default"
          >
            <div className="relative z-10 flex items-center gap-5">
              <motion.div
                whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.12 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 ring-2 ring-white/25 shadow-inner"
              >
                <Brain size={30} className="text-white drop-shadow" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">AI Tutor</h1>
                <p className="text-blue-100 mt-1 text-sm">Your personalised study companion — grounded in your class materials</p>
              </div>
            </div>

            {/* Animated orb — top right */}
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.06, 0.12, 0.06] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-10 -top-10 w-52 h-52 bg-white rounded-full pointer-events-none"
            />
            {/* Animated orb — bottom right */}
            <motion.div
              animate={{ scale: [1, 1.18, 1], opacity: [0.05, 0.09, 0.05] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="absolute right-16 -bottom-16 w-72 h-72 bg-sky-300 rounded-full pointer-events-none"
            />
            {/* Shimmer sweep */}
            <motion.div
              animate={{ x: ["-110%", "220%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.5, repeatDelay: 3 }}
              className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none -skew-x-12"
            />
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : tutors.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Brain size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-600 font-semibold">No tutors available yet</p>
              <p className="text-gray-400 text-sm mt-1">Your teacher hasn't activated any AI tutors for your class.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tutors.map((t, idx) => {
                const grad = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    onClick={() => selectTutor(t)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-xl hover:border-transparent transition-all overflow-hidden group"
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
                    <div className="p-6">
                      <div className={`w-12 h-12 bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-200`}>
                        <TutorIcon iconId={t.icon_emoji} size={22} className="text-white" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">{t.subject_name}</h3>
                      {t.display_name && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.display_name}</p>}
                      <p className="text-sm text-gray-500 mt-1 mb-4">{t.class_name}</p>
                      <div className="flex gap-4 text-xs text-gray-400 mb-5">
                        <span className="flex items-center gap-1"><FileText size={12} /> {t.doc_count} topics</span>
                        <span className="flex items-center gap-1"><BookOpen size={12} /> {t.chapter_count} chapters</span>
                      </div>
                      <div className={`w-full py-2.5 bg-gradient-to-r ${grad} text-white text-center rounded-xl text-sm font-semibold group-hover:opacity-90 transition-all shadow-sm`}>
                        Start Studying →
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── Chat interface ──────────────────────────────────────────────────────────

  const currentMode = MODES.find(m => m.id === mode)!;

  return (
    <DashboardLayout role="student">
      <div className="flex flex-col h-[calc(100vh-148px)]">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-2 px-1">
          <button
            onClick={() => setSelected(null)}
            className="p-1.5 hover:bg-white rounded-lg flex-shrink-0 transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>

          <div className={`w-9 h-9 bg-gradient-to-br ${MODE_GRADIENT[mode]} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
            <TutorIcon iconId={selected.icon_emoji} size={17} className="text-white" />
          </div>

          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 text-base leading-tight truncate">
              {selected.display_name || `${selected.subject_name} Tutor`}
            </h1>
            <p className="text-xs text-gray-400">{selected.class_name}</p>
          </div>

          <div className="ml-auto flex-shrink-0">
            <ExportPanel
              messages={messages}
              tutorName={selected.display_name || `${selected.subject_name} Tutor`}
              subjectName={selected.subject_name}
            />
          </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* ── Quick prompts sidebar ── */}
          <div className="hidden lg:flex flex-col w-52 flex-shrink-0 gap-2">
            {mode === "flashcards" ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-indigo-600" />
                  <p className="text-xs font-semibold text-indigo-700">Generate Flashcards</p>
                </div>
                <input
                  type="text"
                  value={flashTopic}
                  onChange={e => setFlashTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerateFlashcards()}
                  placeholder="Chapter or topic name…"
                  className="w-full px-2.5 py-1.5 text-xs border border-indigo-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-transparent bg-white"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleGenerateFlashcards}
                  disabled={isThinking}
                  className="w-full py-1.5 bg-indigo-600 text-white text-xs rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Generate
                </motion.button>
                <p className="text-xs font-semibold text-gray-400 uppercase pt-1">Or try:</p>
                {MODE_QUICK_PROMPTS.flashcards.map((p, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ x: 2 }}
                    onClick={() => handleSend(p)}
                    disabled={isThinking}
                    className="w-full text-left px-2.5 py-2 bg-white border border-indigo-100 hover:border-indigo-300 rounded-xl text-xs text-gray-600 hover:text-indigo-700 transition-all disabled:opacity-50"
                  >
                    {p}
                  </motion.button>
                ))}
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase px-1 mb-1">Try asking:</p>
                {MODE_QUICK_PROMPTS[mode].map((p, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ x: 2 }}
                    onClick={() => handleSend(p)}
                    disabled={isThinking}
                    className="w-full text-left px-3 py-2.5 bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 rounded-xl text-xs text-gray-600 hover:text-blue-700 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {p}
                  </motion.button>
                ))}
              </>
            )}
          </div>

          {/* ── Chat area ── */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* ── Mode tabs — centered inside chat card ── */}
            <div className={`flex justify-center gap-2 px-5 py-3.5 border-b border-gray-100 flex-wrap ${MODE_BG_SUBTLE[mode]} transition-colors duration-300`}>
              {MODES.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => mode !== m.id && switchMode(m.id)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      mode === m.id
                        ? MODE_ACTIVE_CLASS[m.id]
                        : "bg-white/70 text-gray-500 hover:bg-white hover:text-gray-800 border border-transparent hover:border-gray-200"
                    }`}
                  >
                    <Icon size={15} /> {m.label}
                  </button>
                );
              })}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map(msg => {
                  if (msg.role === "user") {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className={`max-w-[75%] bg-gradient-to-br ${MODE_GRADIENT[mode]} text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs mt-1.5 text-white/60">
                            {msg.ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  }

                  // System message (welcome / mode switch) — simple pill
                  if (isSystemMsg(msg)) {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="bg-gray-50 border border-gray-100 rounded-xl rounded-bl-md px-4 py-2.5 max-w-[85%]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Brain size={13} className={MODE_ICON_COLOR[mode]} />
                            <span className={`text-xs font-semibold ${MODE_ICON_COLOR[mode]}`}>AI Tutor</span>
                          </div>
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      </motion.div>
                    );
                  }

                  // Full AI message card
                  const { quiz, text: quizText } = parseQuizFromContent(msg.content);
                  const { flashcards, text: fcText } = parseFlashcardsFromContent(quizText);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full"
                    >
                      <div className={`bg-white border border-gray-100 border-l-4 ${MODE_BORDER_CLASS[mode]} rounded-xl rounded-bl-sm px-4 py-3 shadow-sm`}>
                        {/* Card header */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <Brain size={14} className={MODE_ICON_COLOR[mode]} />
                          <span className={`text-xs font-semibold ${MODE_ICON_COLOR[mode]}`}>AI Tutor</span>
                          {msg.response_type && (
                            <span className="text-xs text-gray-400 ml-1">· {msg.response_type}</span>
                          )}
                          <div className="ml-auto">
                            <BookmarkButton
                              messageId={msg.id}
                              content={msg.content}
                              question={messages.find(m => m.role === "user" && messages.indexOf(m) < messages.indexOf(msg))?.content}
                              tutorId={selected.id}
                              subjectName={selected.subject_name}
                            />
                          </div>
                        </div>

                        {/* Message body */}
                        {fcText && <MarkdownRenderer content={fcText} />}

                        {/* AI-generated infographic */}
                        {msg.infographic && (
                          <InfographicDisplay infographic={msg.infographic} />
                        )}

                        {/* Flashcard deck (inline) */}
                        {flashcards && (
                          <FlashcardDeck
                            cards={flashcards}
                            subjectTag={selected.subject_name}
                          />
                        )}

                        {/* Inline quiz */}
                        {quiz && <InlineQuiz questions={quiz.questions} />}

                        {/* Confidence */}
                        <ConfidenceIndicator
                          confidence={msg.confidence ?? null}
                          sourceCount={msg.sources.length}
                        />

                        {/* Source citations */}
                        <SourceCards sources={msg.sources} />

                        {/* Action buttons */}
                        <ActionButtons
                          mode={mode}
                          onAction={handleSend}
                          disabled={isThinking}
                        />

                        {/* Timestamp */}
                        <p className="text-xs text-gray-400 mt-2">
                          {msg.ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Thinking indicator */}
              {isThinking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className={`border border-gray-100 border-l-4 ${MODE_BORDER_CLASS[mode]} bg-white rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm`}>
                    <Loader2 className={`animate-spin ${MODE_ICON_COLOR[mode]}`} size={15} />
                    <span className="text-sm text-gray-500">
                      {mode === "flashcards" ? "Generating flashcards from your materials..." : "Searching your class materials..."}
                    </span>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ── */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-1 focus-within:border-gray-300 focus-within:shadow-sm transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={
                    mode === "flashcards"
                      ? "Ask for flashcards or use the panel on the left…"
                      : `Ask a ${currentMode.label.toLowerCase()} question...`
                  }
                  disabled={isThinking}
                  className="flex-1 py-3 text-sm bg-transparent focus:outline-none disabled:opacity-50 placeholder-gray-400"
                />
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isThinking}
                  className={`px-4 py-2 bg-gradient-to-r ${MODE_GRADIENT[mode]} text-white rounded-xl font-medium disabled:opacity-40 flex items-center gap-1.5 text-sm flex-shrink-0 shadow-sm`}
                >
                  <Send size={14} /> Send
                </motion.button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Answers are grounded in your class materials only
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
