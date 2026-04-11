/**
 * FeedbackRenderer — unified component for rendering teacher feedback.
 * Handles both HTML (from TipTap rich-text editor) and legacy plain-text /
 * markdown format, ensuring consistent display across student and parent portals.
 */

import React from "react";
import DOMPurify from "dompurify";

// Helpers

/** Returns true when the content string begins with an HTML tag. */
export function isHTMLContent(text: string): boolean {
  return text.trimStart().startsWith("<");
}

/**
 * Converts simple markdown (legacy format) to HTML so it can be loaded
 * into the TipTap editor without losing formatting.
 * Handles: **bold**, *italic*, __underline__, \n newlines.
 */
export function markdownToHTML(text: string): string {
  if (!text.trim()) return "";
  if (isHTMLContent(text)) return text;

  return text
    .split(/\\n|\n/)
    .map(line => {
      if (!line.trim()) return "<p></p>";
      const html = line
        .trim()
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/__(.+?)__/g, "<u>$1</u>");
      return `<p>${html}</p>`;
    })
    .join("");
}

// Markdown renderer (for legacy plain-text feedback)

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
      result.push(
        <strong key={key} className="font-semibold text-gray-900">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith("__")) {
      result.push(
        <span key={key} className="underline decoration-2">
          {raw.slice(2, -2)}
        </span>
      );
    } else if (raw.startsWith("*")) {
      result.push(
        <em key={key} className="italic text-gray-600">
          {raw.slice(1, -1)}
        </em>
      );
    } else {
      const [a, b] = raw.split("/").map(Number);
      const cls =
        a === 0
          ? "bg-red-100 text-red-700 border border-red-200"
          : a === b
          ? "bg-green-100 text-green-700 border border-green-200"
          : "bg-amber-100 text-amber-700 border border-amber-200";
      result.push(
        <span
          key={key}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-bold text-xs mx-0.5 ${cls}`}
        >
          {raw}
        </span>
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

function MarkdownContent({ text, className = "" }: { text: string; className?: string }) {
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

// Public component

/**
 * Renders teacher feedback regardless of format:
 * - HTML strings (produced by TipTap editor) → rendered via dangerouslySetInnerHTML
 *   with `.feedback-html` CSS class for consistent typography.
 * - Plain text / markdown → rendered via MarkdownContent helper.
 */
export function FeedbackRenderer({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;

  if (isHTMLContent(content)) {
    return (
      <div
        className={`feedback-html text-sm text-gray-700 leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content, {
          ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "del", "h1", "h2", "h3", "ul", "ol", "li", "span", "mark"],
          ALLOWED_ATTR: ["class", "style"],
        }) }}
      />
    );
  }

  return <MarkdownContent text={content} className={className} />;
}
