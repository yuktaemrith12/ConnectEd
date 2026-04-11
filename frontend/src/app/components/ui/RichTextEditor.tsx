/**
 * RichTextEditor — reusable TipTap-based rich text editor.
 * Accepts controlled `content` (HTML string) and `onChange` callback.
 * Syncs external content changes (AI draft load, student switch) via useEffect.
 */

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { List, ListOrdered } from "lucide-react";

// Toolbar Button

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
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

// Toolbar

function RTEToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
      {/* Bold / Italic / Underline / Strikethrough */}
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
        <span
          className="text-xs font-bold"
          style={{ background: "linear-gradient(transparent 40%, #fde68a 40%)" }}
        >
          H
        </span>
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

// Public component

export interface RichTextEditorProps {
  /** HTML string controlled externally */
  content: string;
  /** Called on every editor change with the current HTML */
  onChange: (html: string) => void;
  className?: string;
}

export function RichTextEditor({ content, onChange, className = "" }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Highlight.configure({ multicolor: true })],
    content: content || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[120px] px-3 py-2.5 text-sm text-gray-700 leading-relaxed",
      },
    },
  });

  // Sync external content changes into the editor (student switch, AI draft load).
  // { emitUpdate: false } prevents the onChange loop.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = content || "";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div
      className={`border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-300 ${className}`}
    >
      <RTEToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}