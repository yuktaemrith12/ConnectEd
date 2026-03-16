import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Flashcard from "./Flashcard";
import type { FlashcardData } from "./Flashcard";

export type { FlashcardData };

export function parseFlashcardsFromContent(content: string): {
  flashcards: FlashcardData[] | null;
  text: string;
} {
  const match = content.match(/```flashcards\s*([\s\S]*?)```/);
  if (!match) return { flashcards: null, text: content };
  try {
    const cards = JSON.parse(match[1].trim());
    if (Array.isArray(cards) && cards.length > 0) {
      const text = content.replace(/```flashcards[\s\S]*?```/, "").trim();
      return { flashcards: cards as FlashcardData[], text };
    }
  } catch {
    // malformed JSON — treat as plain text
  }
  return { flashcards: null, text: content };
}

interface Props {
  cards: FlashcardData[];
  subjectTag?: string;
}

export default function FlashcardDeck({ cards, subjectTag }: Props) {
  const [index, setIndex]         = useState(0);
  const [known, setKnown]         = useState<Set<number>>(new Set());
  const [studyAgain, setStudyAgain] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState(0);

  const total = cards.length;
  const card  = cards[index];

  function go(dir: number) {
    const next = index + dir;
    if (next < 0 || next >= total) return;
    setDirection(dir);
    setIndex(next);
  }

  function markKnow() {
    setKnown(prev => new Set([...prev, index]));
    setStudyAgain(prev => { const s = new Set(prev); s.delete(index); return s; });
    if (index < total - 1) go(1);
  }

  function markStudyAgain() {
    setStudyAgain(prev => new Set([...prev, index]));
    setKnown(prev => { const s = new Set(prev); s.delete(index); return s; });
    if (index < total - 1) go(1);
  }

  function restart() {
    setIndex(0);
    setKnown(new Set());
    setStudyAgain(new Set());
  }

  const knownCount = known.size;
  const progress   = Math.round(((index + 1) / total) * 100);

  return (
    <div className="my-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium">{index + 1} of {total} cards</span>
        <div className="flex items-center gap-3">
          {knownCount > 0 && (
            <span className="text-green-600 font-medium">✓ {knownCount} known</span>
          )}
          <button
            onClick={restart}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw size={11} /> Restart
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Animated card */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          initial={{ x: direction > 0 ? 80 : -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction > 0 ? -80 : 80, opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <Flashcard
            card={card}
            subjectTag={subjectTag}
            onKnow={markKnow}
            onStudyAgain={markStudyAgain}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5 max-w-[200px] flex-wrap justify-center">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? "bg-blue-500 w-4"
                  : known.has(i)
                    ? "bg-green-400 w-2"
                    : studyAgain.has(i)
                      ? "bg-amber-400 w-2"
                      : "bg-gray-300 w-2"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={index === total - 1}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Completion state */}
      {knownCount === total && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-3 bg-green-50 rounded-xl border border-green-100"
        >
          <p className="text-green-700 font-semibold text-sm">🎉 You know all {total} cards!</p>
          <button onClick={restart} className="mt-1 text-xs text-green-600 hover:underline">
            Review again
          </button>
        </motion.div>
      )}
    </div>
  );
}
