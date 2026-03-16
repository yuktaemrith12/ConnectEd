import { AlertTriangle } from "lucide-react";

type Confidence = "high" | "medium" | "low" | null;

interface Props {
  confidence: Confidence;
  sourceCount: number;
}

const CONFIG = {
  high:   { bars: 4, total: 4, color: "bg-green-500",  label: "High",   text: "text-green-700",  bg: "bg-green-50" },
  medium: { bars: 2, total: 4, color: "bg-amber-400",  label: "Medium", text: "text-amber-700",  bg: "bg-amber-50" },
  low:    { bars: 1, total: 4, color: "bg-red-400",    label: "Low",    text: "text-red-700",    bg: "bg-red-50" },
};

export default function ConfidenceIndicator({ confidence, sourceCount }: Props) {
  if (!confidence) return null;
  const cfg = CONFIG[confidence];

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Confidence:</span>
        <div className="flex gap-0.5">
          {Array.from({ length: cfg.total }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-1.5 rounded-full ${i < cfg.bars ? cfg.color : "bg-gray-200"}`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        <span className="text-xs text-gray-400">· {sourceCount} source{sourceCount !== 1 ? "s" : ""}</span>
      </div>

      {confidence === "low" && (
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>This answer may go beyond your class materials. Verify with your teacher.</span>
        </div>
      )}
    </div>
  );
}
