import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

export interface BookmarkedMessage {
  id: string;
  content: string;
  question?: string;
  ts: string;
  tutorId: number;
  subjectName: string;
}

interface Props {
  messageId: string;
  content: string;
  question?: string;
  tutorId: number;
  subjectName: string;
}

function getKey(tutorId: number) {
  return `ai_tutor_bookmarks_${tutorId}`;
}

export function getBookmarks(tutorId: number): BookmarkedMessage[] {
  try {
    return JSON.parse(localStorage.getItem(getKey(tutorId)) || "[]");
  } catch {
    return [];
  }
}

export default function BookmarkButton({ messageId, content, question, tutorId, subjectName }: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const bookmarks = getBookmarks(tutorId);
    setSaved(bookmarks.some(b => b.id === messageId));
  }, [messageId, tutorId]);

  function toggle() {
    const key = getKey(tutorId);
    const bookmarks = getBookmarks(tutorId);
    if (saved) {
      const updated = bookmarks.filter(b => b.id !== messageId);
      localStorage.setItem(key, JSON.stringify(updated));
      setSaved(false);
    } else {
      const entry: BookmarkedMessage = {
        id: messageId,
        content,
        question,
        ts: new Date().toISOString(),
        tutorId,
        subjectName,
      };
      localStorage.setItem(key, JSON.stringify([...bookmarks, entry]));
      setSaved(true);
    }
  }

  return (
    <button
      onClick={toggle}
      title={saved ? "Remove bookmark" : "Bookmark this answer"}
      className={`p-1 rounded transition-colors ${saved ? "text-amber-500 hover:text-amber-600" : "text-gray-300 hover:text-gray-500"}`}
    >
      {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
    </button>
  );
}
