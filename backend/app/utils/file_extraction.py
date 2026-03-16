"""Utilities for extracting plain text from uploaded submission files."""
import logging

logger = logging.getLogger("connected")

MAX_CHARS_PER_FILE = 10_000  # Truncation limit to stay within token budgets


def extract_text_from_file(file_path: str) -> str:
    """Return up to MAX_CHARS_PER_FILE characters of plain text from *file_path*.

    Supports .txt, .docx, and .pdf.  Any other extension (images, zip, etc.)
    returns a short notice so the AI knows the file exists but is unreadable.
    """
    try:
        lower = file_path.lower()

        if lower.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8", errors="replace") as fh:
                text = fh.read()

        elif lower.endswith(".docx"):
            from docx import Document  # python-docx
            doc = Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        elif lower.endswith(".pdf"):
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            pages = []
            for page in doc:
                pages.append(page.get_text())
            doc.close()
            text = "\n".join(pages)

        else:
            return f"[Binary or unsupported file type — cannot extract text from '{file_path}']"

        text = text.strip()
        if len(text) > MAX_CHARS_PER_FILE:
            text = text[:MAX_CHARS_PER_FILE] + "\n… [content truncated]"
        return text if text else "[File is empty or contains no readable text]"

    except Exception as exc:
        logger.warning("Could not extract text from '%s': %s", file_path, exc)
        return f"[Could not read file '{file_path}': {exc}]"
