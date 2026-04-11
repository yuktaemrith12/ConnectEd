import json
import re
from typing import Optional
import anthropic
from app.core.config import settings
from app.utils.file_extraction import extract_text_from_file


def _fix_json_strings(text: str) -> str:
    """Escape unescaped control characters inside JSON string values to prevent parse errors."""
    out = []
    in_str = False
    i = 0
    while i < len(text):
        c = text[i]
        # Preserve existing backslash escapes inside strings
        if c == "\\" and in_str and i + 1 < len(text):
            out.append(c)
            out.append(text[i + 1])
            i += 2
            continue
        if c == '"':
            in_str = not in_str
        elif in_str and c == "\n":
            out.append("\\n")
            i += 1
            continue
        elif in_str and c == "\r":
            out.append("\\r")
            i += 1
            continue
        elif in_str and c == "\t":
            out.append("\\t")
            i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _extract_json(text: str) -> dict:
    text = _fix_json_strings(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def run_ai_review(
    assignment,
    submission,
    answer_sheet_path: Optional[str] = None,
) -> dict:
    api_key = settings.ANTHROPIC_API_KEY.strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is missing from environment variables.")

    client = anthropic.Anthropic(api_key=api_key)

    # Rubric section
    rubric_text = ""
    if getattr(assignment, "rubric", None):
        for r in assignment.rubric:
            rubric_text += f"- {r.get('criterion', 'Unnamed criterion')} ({r.get('max_points', 0)} pts)"
            if r.get("description"):
                rubric_text += f": {r['description']}"
            rubric_text += "\n"

    # Answer sheet / mark scheme
    answer_key_text = ""
    if answer_sheet_path:
        answer_key_text = extract_text_from_file(answer_sheet_path)

    # Student submission content
    file_sections = []
    if getattr(submission, "sub_attachments", None):
        for att in submission.sub_attachments:
            file_path = getattr(att, "file_path", None)
            file_name = getattr(att, "file_name", "unknown")
            content = extract_text_from_file(file_path) if file_path else "[File path not available]"
            file_sections.append(f"--- File: {file_name} ---\n{content}")

    submission_content = (
        "\n\n".join(file_sections) if file_sections else "No files submitted."
    )

    # Grading instruction depends on what context is available
    _bad_markers = ("[Could not", "[Binary", "empty", "[File path")
    has_answer_key = bool(
        answer_key_text
        and not any(m in answer_key_text for m in _bad_markers)
    )

    if has_answer_key:
        grading_instruction = (
            "You have been provided an Answer Key / Mark Scheme below. "
            "Use it as a flexible guide — award marks wherever the student's response "
            "aligns with the intent of the expected answers. Accept equivalent approaches, "
            "synonyms, and varied sentence structures that demonstrate the same understanding. "
            "Award partial marks generously for answers that show the correct idea even if "
            "expressed incompletely."
        )
    elif rubric_text:
        grading_instruction = (
            "Grade against the rubric criteria below. Award partial marks for answers "
            "that show the correct concept, relevant terminology, or logical reasoning "
            "even if the response is incomplete or uses different wording."
        )
    else:
        grading_instruction = (
            "No rubric or answer key was provided. Act as a Subject Matter Expert (SME): "
            "evaluate the response based on logical consistency, relevance to the assignment "
            "topic, depth of explanation, and accuracy. Award partial credit for any answer "
            "that demonstrates meaningful engagement with the topic."
        )

    prompt = f"""You are a supportive, patient, and highly experienced academic mentor. \
Your role is to evaluate student work and provide encouraging, growth-oriented feedback \
that helps students improve. You focus on student progress, not just errors.

{grading_instruction}

IMPORTANT LANGUAGE RULES:
- NEVER use: "completely wrong", "no understanding", "very poor", "incorrect explanation", \
"0 marks", "failed to", "totally incorrect", "makes no sense"
- ALWAYS prefer: "needs improvement", "there may be some confusion about", \
"this concept could be revised further", "good attempt", "on the right track", \
"with a bit more practice", "a stronger explanation would include"

PARTIAL CREDIT RULES:
- Award partial marks for answers that show the correct "spark" or idea but are incomplete
- Award partial marks for answers using different terminology that shows logical understanding
- Award partial marks for attempted reasoning even if the conclusion is flawed
- Never award 0 unless absolutely no relevant content was submitted
- Support float grades (e.g. 14.5, 7.5)

Assignment: {assignment.title}
Max score: {assignment.max_score}
Instructions: {assignment.description or 'None provided'}

Rubric:
{rubric_text or 'No rubric provided'}

Answer Key / Mark Scheme:
{answer_key_text or 'Not provided'}

Student Submission:
{submission_content}

Return VALID JSON only — no markdown fences, no explanation outside the JSON.
Respond with EXACTLY this JSON structure (no extra keys):
{{
  "grade": <float between 0 and {assignment.max_score}, supports decimals like 14.5>,
  "grade_summary": "<1-2 sentence encouraging overview of the overall submission — start positively>",
  "strengths": [
    "<specific thing the student did well>",
    "<another strength — reference correct terminology or concepts used>"
  ],
  "areas_to_improve": [
    "<concept or topic name that needs more work — NOT a question number>",
    "<another concept topic>"
  ],
  "key_corrections": [
    {{"misconception": "<what the student seemed to think>", "correction": "<the correct concept explained simply and kindly>"}},
    {{"misconception": "<another misconception>", "correction": "<kind correction>"}}
  ],
  "next_steps": [
    "<actionable revision suggestion, e.g. 'Review Chapter 3 on network layers'>",
    "<another concrete next step>"
  ],
  "breakdown": "<Per-section and per-question mark commentary with rich formatting. \
Put each SECTION on its own line starting with **Section Name (score/max)**. \
Put each question result on its own line as **Q1** (Topic — score/max): brief encouraging comment. \
Show every score inline as number/number (e.g. 10/10, 0/3, 4/16). \
Use \\n between lines. Keep an encouraging, supportive tone throughout.>",
  "summary_paragraph": "<A cohesive 150-250 word paragraph. Use **bold** for key concepts. \
Use *italic* for encouraging phrases. Use __underline__ to highlight important takeaways. \
Break into short focused lines using \\n between distinct points — do NOT write one continuous block. \
Mentor-like tone, synthesise strengths and growth areas into flowing prose.>",
  "rubric_alignment": {{"<criterion or aspect>": "<brief encouraging mark comment>"}},
  "annotations": [],
  "confidence": "low|medium|high"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    data = _extract_json(message.content[0].text)

    # Build structured feedback dict (stored as JSON string in DB)
    structured = {
        "grade_summary": data.get("grade_summary", ""),
        "strengths": data.get("strengths", []),
        "areas_to_improve": data.get("areas_to_improve", []),
        "key_corrections": data.get("key_corrections", []),
        "next_steps": data.get("next_steps", []),
        "breakdown": data.get("breakdown", ""),
        "summary_paragraph": data.get("summary_paragraph", ""),
    }

    return {
        "suggested_grade": float(data.get("grade", data.get("suggested_grade", 0))),
        "suggested_feedback": json.dumps(structured),
        "rubric_alignment": data.get("rubric_alignment", {}),
        "annotations": data.get("annotations", []),
        "confidence_score": data.get("confidence", "medium"),
        "model_info": {"model_id": "claude-sonnet-4-6"},
    }
