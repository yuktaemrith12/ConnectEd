import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  content: string;
  className?: string;
}

// ── Code block with copy button ────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-700 text-left">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">{language || "code"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="bg-gray-900 p-4 overflow-x-auto">
        <code className="text-[13px] text-gray-100 font-mono leading-relaxed whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

// ── Inline text renderer (bold, italic, inline code) ──────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-[12px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

// ── Table renderer ─────────────────────────────────────────────────────────────

function renderTable(lines: string[]): React.ReactNode {
  const rows = lines
    .filter(l => l.trim().startsWith("|") && !l.match(/^\|[\s\-|]+\|$/))
    .map(l => l.trim().slice(1, -1).split("|").map(c => c.trim()));
  if (rows.length === 0) return null;
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {header.map((cell, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-700 border border-gray-200">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────────

export default function MarkdownRenderer({ content, className = "" }: Props) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(<CodeBlock key={`code-${i}`} code={codeLines.join("\n")} language={lang} />);
      continue;
    }

    // Horizontal rule
    if (/^[-*]{3,}$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-gray-200" />);
      i++;
      continue;
    }

    // Heading ##
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="font-bold text-gray-900 text-base mt-4 mb-1.5 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full inline-block flex-shrink-0" />
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Heading ###
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="font-semibold text-gray-800 text-[15px] mt-3 mb-1">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-blue-400 bg-blue-50 rounded-r-lg px-4 py-2 my-2 text-blue-900 text-sm">
          {quoteLines.map((ql, qi) => <p key={qi}>{renderInline(ql)}</p>)}
        </blockquote>
      );
      continue;
    }

    // Table (line contains |)
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<div key={`tbl-${i}`}>{renderTable(tableLines)}</div>);
      continue;
    }

    // Unordered list
    if (/^[-*+] /.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
        const text = lines[i].trim().slice(2);
        listItems.push(
          <li key={i} className="flex items-start gap-2 py-0.5">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
            <span>{renderInline(text)}</span>
          </li>
        );
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="my-2 space-y-0.5 text-gray-700">{listItems}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+\. /, "");
        listItems.push(
          <li key={i} className="flex items-start gap-2 py-0.5">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {num}
            </span>
            <span>{renderInline(text)}</span>
          </li>
        );
        i++;
        num++;
      }
      elements.push(<ol key={`ol-${i}`} className="my-2 space-y-0.5 text-gray-700">{listItems}</ol>);
      continue;
    }

    // Empty line
    if (trimmed === "") {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="text-[15px] leading-[1.75] text-gray-800 my-1">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div className={`markdown-content ${className}`}>
      {elements}
    </div>
  );
}
