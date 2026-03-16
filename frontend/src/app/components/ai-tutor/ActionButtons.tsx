import { motion } from "motion/react";

type Mode = "learn" | "revision" | "flashcards" | "exam_prep" | "recap";

interface Props {
  mode: Mode;
  onAction: (text: string) => void;
  disabled?: boolean;
}

const ACTION_PROMPTS: Record<Mode, string[]> = {
  learn:     ["Explain simpler", "Another example", "Test me on this"],
  revision:  ["Quick quiz", "Most important point?", "Summarise in 3 bullets"],
  flashcards:["More flashcards", "Harder cards", "Cards for next chapter"],
  exam_prep: ["Another exam question", "Show marking criteria", "What marks would I get?"],
  recap:     ["Key concepts only", "What should I study?", "Quiz me on this"],
};

export default function ActionButtons({ mode, onAction, disabled }: Props) {
  const prompts = ACTION_PROMPTS[mode];

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {prompts.map((p, i) => (
        <motion.button
          key={i}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onAction(p)}
          disabled={disabled}
          className="text-xs px-2.5 py-1 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-700 text-gray-600 rounded-full transition-colors disabled:opacity-40"
        >
          {p}
        </motion.button>
      ))}
    </div>
  );
}
