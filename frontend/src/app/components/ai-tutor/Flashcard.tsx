import { useState } from "react";
import { motion } from "motion/react";
import { RotateCcw, ThumbsUp, RefreshCw } from "lucide-react";

export interface FlashcardData {
  question: string;
  answer: string;
  explanation?: string;
}

interface Props {
  card: FlashcardData;
  subjectTag?: string;
  onKnow?: () => void;
  onStudyAgain?: () => void;
}

export default function Flashcard({ card, subjectTag, onKnow, onStudyAgain }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="relative w-full" style={{ perspective: "1000px", height: "240px" }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d", position: "relative", width: "100%", height: "100%" }}
      >
        {/* Front */}
        <div
          onClick={() => setFlipped(true)}
          style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
          className="bg-white border-2 border-blue-100 rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
        >
          <div>
            {subjectTag && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {subjectTag}
              </span>
            )}
            <p className="mt-3 text-gray-800 font-medium text-base leading-relaxed">{card.question}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <RotateCcw size={11} /> Click to reveal answer
          </div>
        </div>

        {/* Back */}
        <div
          onClick={() => setFlipped(false)}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 flex flex-col justify-between cursor-pointer shadow-sm"
        >
          <div>
            <p className="text-sm font-semibold text-blue-700 mb-1">Answer</p>
            <p className="text-gray-800 font-medium leading-relaxed">{card.answer}</p>
            {card.explanation && (
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{card.explanation}</p>
            )}
          </div>
          {(onKnow || onStudyAgain) && (
            <div className="flex gap-2 mt-3">
              {onKnow && (
                <button
                  onClick={e => { e.stopPropagation(); onKnow(); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium hover:bg-green-200 transition-colors"
                >
                  <ThumbsUp size={12} /> I know this
                </button>
              )}
              {onStudyAgain && (
                <button
                  onClick={e => { e.stopPropagation(); onStudyAgain(); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full font-medium hover:bg-amber-200 transition-colors"
                >
                  <RefreshCw size={12} /> Study again
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
