import { useState } from "react";
import { Download, Copy, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: Date;
}

interface Props {
  messages: Message[];
  tutorName: string;
  subjectName: string;
}

export default function ExportPanel({ messages, tutorName, subjectName }: Props) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

  function buildMarkdown() {
    const header = `# ${tutorName} — ${subjectName}\nExported: ${new Date().toLocaleString()}\n\n---\n\n`;
    const body = messages
      .filter(m => m.role !== "assistant" || !m.content.startsWith("Switched to"))
      .map(m => {
        const prefix = m.role === "user" ? "**You:**" : "**AI Tutor:**";
        return `${prefix}\n${m.content}`;
      })
      .join("\n\n---\n\n");
    return header + body;
  }

  function copyMarkdown() {
    navigator.clipboard.writeText(buildMarkdown());
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    const text = buildMarkdown();
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${subjectName.replace(/\s+/g, "_")}_session.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Export session notes"
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {copied ? <Check size={13} className="text-green-500" /> : <Download size={13} />}
        Export
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-1 min-w-[180px]"
            >
              <button
                onClick={copyMarkdown}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                <Copy size={14} /> Copy as Markdown
              </button>
              <button
                onClick={downloadTxt}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                <Download size={14} /> Download as .txt
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
