"""
Infographic Service — DALL-E 3 image generation with concept-level caching.

Workflow
--------
1.  Receive a `visual_intent` description from the RAG engine.
2.  Normalise the concept text and compute SHA-256(tutor_id + concept).
3.  Check DB for an existing infographic with the same hash → reuse if found.
4.  Otherwise call DALL-E 3, download the PNG and save it under:
        uploads/ai_tutor/infographics/<tutor_id>/<infographic_id>.png
5.  Insert a row into `ai_tutor_infographics` and return the ORM object.

Style guardrail appended to every prompt
-----------------------------------------
"Style: Academic textbook illustration, professional, clean, minimalist
vector art, white background, high contrast, labeled with sans-serif font,
no decorative backgrounds, no unrelated objects, no photographs of people."
"""

import hashlib
import logging
import os
import uuid

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_STYLE_GUARDRAIL = (
    "Style: Academic textbook illustration, professional, clean, "
    "minimalist vector art, white background, high contrast, "
    "labeled with a clear sans-serif font, no decorative backgrounds, "
    "no unrelated objects, no photographs of real people."
)

# Absolute base for all infographic PNGs
_BASE_DIR = os.path.normpath(
    os.path.join(
        os.path.dirname(  # services/ai_tutor/
            os.path.dirname(  # services/
                os.path.dirname(  # app/
                    os.path.abspath(__file__)
                )
            )
        ),
        "..", "uploads", "ai_tutor", "infographics",
    )
)


def _infographic_dir(tutor_id: int) -> str:
    path = os.path.join(_BASE_DIR, str(tutor_id))
    os.makedirs(path, exist_ok=True)
    return path


def _compute_hash(tutor_id: int, normalized_concept: str) -> str:
    raw = f"{tutor_id}::{normalized_concept.lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _normalize_concept(visual_intent: str) -> str:
    """Return a short (<= 120 chars) normalised concept key."""
    return visual_intent.strip()[:120]


def _call_dalle(prompt: str) -> bytes:
    """Call DALL-E 3, return raw PNG bytes."""
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set in .env.")
    import openai
    client = openai.OpenAI(api_key=api_key)
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        n=1,
        size="1024x1024",
        response_format="url",
    )
    image_url = response.data[0].url
    img_resp = requests.get(image_url, timeout=30)
    img_resp.raise_for_status()
    return img_resp.content


def generate_or_reuse(
    tutor_id: int,
    message_id: int,
    visual_intent: str,
    db,
) -> "AiTutorInfographic | None":  # noqa: F821
    """
    Main entry point.  Returns an AiTutorInfographic ORM row (committed),
    or None if generation fails (caller should fall back to text-only).
    """
    from app.models.ai_tutor import AiTutorInfographic

    normalized = _normalize_concept(visual_intent)
    concept_hash = _compute_hash(tutor_id, normalized)

    # 1. Cache hit: find an existing infographic for this concept
    existing = (
        db.query(AiTutorInfographic)
        .filter(
            AiTutorInfographic.tutor_id     == tutor_id,
            AiTutorInfographic.concept_hash == concept_hash,
            AiTutorInfographic.storage_path.isnot(None),
        )
        .first()
    )
    if existing and os.path.isfile(existing.storage_path):
        logger.info(
            "Infographic cache hit: tutor=%s concept_hash=%s → id=%s",
            tutor_id, concept_hash, existing.id,
        )
        # Create a new row pointing at the same file for the new message
        cached = AiTutorInfographic(
            tutor_id           = tutor_id,
            message_id         = message_id,
            prompt_used        = existing.prompt_used,
            normalized_concept = normalized,
            concept_hash       = concept_hash,
            storage_path       = existing.storage_path,
            accessibility_alt  = existing.accessibility_alt,
        )
        db.add(cached)
        db.commit()
        db.refresh(cached)
        return cached

    # 2. Cache miss: generate a new image
    full_prompt = f"{visual_intent.strip()}. {_STYLE_GUARDRAIL}"
    accessibility_alt = f"Academic diagram: {normalized}"

    try:
        png_bytes = _call_dalle(full_prompt)
    except Exception as exc:
        logger.warning("DALL-E 3 generation failed: %s", exc)
        return None

    # 3. Persist placeholder row first to obtain an id
    row = AiTutorInfographic(
        tutor_id           = tutor_id,
        message_id         = message_id,
        prompt_used        = full_prompt,
        normalized_concept = normalized,
        concept_hash       = concept_hash,
        accessibility_alt  = accessibility_alt,
    )
    db.add(row)
    db.flush()  # get row.id without committing

    # 4. Save PNG
    folder = _infographic_dir(tutor_id)
    filename = f"{row.id}_{uuid.uuid4().hex[:8]}.png"
    path = os.path.join(folder, filename)
    with open(path, "wb") as f:
        f.write(png_bytes)

    row.storage_path = path
    db.commit()
    db.refresh(row)
    logger.info("Infographic generated: id=%s path=%s", row.id, path)
    return row
