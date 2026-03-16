import { useState } from "react";
import { CheckCircle, XCircle, HelpCircle, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  hint: string;
  explanation: string;
}

interface Props {
  questions: QuizQuestion[];
}

function QuizItem({ q, idx }: { q: QuizQuestion; idx: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [checked, setChecked]   = useState(false);

  const isCorrect = selected === q.correct;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-white">
      <p className="font-medium text-gray-800 text-sm">
        <span className="text-blue-600 font-bold mr-1">Q{idx + 1}.</span> {q.question}
      </p>

      <div className="space-y-2">
        {q.options.map((opt, oi) => {
          let style = "border-gray-200 bg-white text-gray-700 hover:border-blue-300";
          if (checked) {
            if (oi === q.correct) style = "border-green-400 bg-green-50 text-green-800";
            else if (oi === selected) style = "border-red-400 bg-red-50 text-red-800";
          } else if (oi === selected) {
            style = "border-blue-400 bg-blue-50 text-blue-800";
          }
          return (
            <button
              key={oi}
              onClick={() => !checked && setSelected(oi)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${style}`}
            >
              <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)})</span>
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowHint(v => !v)}
          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
        >
          <HelpCircle size={13} /> {showHint ? "Hide hint" : "Show hint"}
        </button>

        {!checked && selected !== null && (
          <button
            onClick={() => setChecked(true)}
            className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            <ChevronRight size={13} /> Check Answer
          </button>
        )}

        {checked && (
          <span className={`flex items-center gap-1 text-xs font-medium ${isCorrect ? "text-green-700" : "text-red-700"}`}>
            {isCorrect ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {isCorrect ? "Correct!" : "Not quite"}
          </span>
        )}
      </div>

      <AnimatePresence>
        {showHint && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">Hint: </span>{q.hint}
            </div>
          </motion.div>
        )}
        {checked && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
            <div className={`rounded-lg px-3 py-2 text-xs ${isCorrect ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"}`}>
              <span className="font-semibold">Explanation: </span>{q.explanation}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function InlineQuiz({ questions }: Props) {
  const [score, setScore] = useState<number | null>(null);

  return (
    <div className="my-3 bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🧪</span>
        <h3 className="font-bold text-purple-800 text-sm">Quick Quiz</h3>
        <span className="text-xs text-purple-500 ml-auto">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => <QuizItem key={i} q={q} idx={i} />)}
      </div>
    </div>
  );
}

// ── Parser helper ──────────────────────────────────────────────────────────────

export function parseQuizFromContent(content: string): { quiz: { questions: QuizQuestion[] } | null; text: string } {
  const match = content.match(/```quiz\s*([\s\S]*?)```/);
  if (!match) return { quiz: null, text: content };

  try {
    const quiz = JSON.parse(match[1].trim());
    const text = content.replace(/```quiz[\s\S]*?```/, "").trim();
    return { quiz, text };
  } catch {
    return { quiz: null, text: content };
  }
}
