"""
Illustration service — analyzes study notes with GPT-4o to identify key teachable
concepts, then generates one educational diagram per concept in parallel.

Primary image model:  GPT-4o Image (gpt-image-1)  — best for diagrams with text labels.
Fallback image model: DALL-E 3

Stores results as a JSON array:
  [{"concept": "...", "image": "<data-uri or URL>"}, ...]

The JSON string is written to ai_study_materials.illustration_url so that
old single-image jobs (plain data URI / URL strings) remain backward compatible.
"""
import asyncio
import json

from openai import OpenAI
from app.core.config import settings


# ── Step 1: Concept planning ──────────────────────────────────────────────────

def _plan_visuals_sync(notes: str) -> list[dict]:
    """
    Ask GPT-4o to analyse the study notes and produce 2-4 concept/prompt pairs.
    Returns [{"concept": str, "prompt": str}, ...]
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    system_prompt = (
        "You are an expert educational illustrator and instructional designer. "
        "Analyse the provided study notes and identify the key concepts that "
        "would genuinely benefit from a visual diagram.\n\n"
        "Rules:\n"
        "- Decide how many visuals are needed (minimum 2, maximum 4). "
        "  Only include a concept when a diagram meaningfully aids understanding.\n"
        "- For each concept write a HIGHLY SPECIFIC image-generation prompt that includes:\n"
        "  * The exact concept name\n"
        "  * The diagram type (e.g. numbered flowchart, labeled diagram, Venn diagram, timeline)\n"
        "  * Specific visual elements, arrows, and label text to include\n"
        "  * End with: 'Educational infographic style, white background, clean vector art, "
        "textbook quality, no decorative borders.'\n\n"
        "Return ONLY a raw JSON array — no markdown fences, no explanation:\n"
        '[{"concept": "concept name", "prompt": "detailed image prompt"}, ...]'
    )

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": f"Study Notes:\n{notes[:6000]}"},
        ],
        temperature=0.4,
    )

    raw = resp.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```", 1)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rsplit("```", 1)[0].strip()

    data = json.loads(raw)

    # Response should be a bare array; handle wrapped object as fallback
    if isinstance(data, list):
        return data
    for key in ("visuals", "concepts", "illustrations", "items", "diagrams"):
        if key in data and isinstance(data[key], list):
            return data[key]
    # Last resort: first list value found
    for v in data.values():
        if isinstance(v, list):
            return v
    return []


# ── Step 2: Single-image generation ──────────────────────────────────────────

def _generate_one_image_sync(prompt: str) -> str:
    """
    Generate one educational image for the given prompt.
    Returns a base64 data URI (gpt-image-1) or a URL (DALL-E 3 fallback).
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # Primary: gpt-image-1
    try:
        img_resp = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="1536x1024",
            quality="high",
            n=1,
        )
        b64 = img_resp.data[0].b64_json
        print(f"[Illustration] gpt-image-1 ✓  prompt: {prompt[:70]}…")
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        print(f"[Illustration] gpt-image-1 failed: {e}  → falling back to DALL-E 3")

    # Fallback: DALL-E 3
    img_resp = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    print(f"[Illustration] DALL-E 3 ✓  prompt: {prompt[:70]}…")
    return img_resp.data[0].url


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_multi_illustrations(notes: str) -> list[dict]:
    """
    Analyse study notes and generate one educational diagram per key concept.

    Steps:
      1. GPT-4o plans 2-4 concepts and crafts specific image prompts.
      2. All images are generated in parallel via asyncio.gather.

    Returns [{"concept": str, "image": data_uri_or_url}, ...]
    """
    # Step 1: plan (sync GPT-4o call offloaded to a thread)
    concepts = await asyncio.to_thread(_plan_visuals_sync, notes)
    if not concepts:
        print("[Illustration] No concepts identified — skipping image generation.")
        return []

    print(f"[Illustration] Generating {len(concepts)} visual(s): {[c['concept'] for c in concepts]}")

    # Step 2: generate all images in parallel
    tasks = [
        asyncio.to_thread(_generate_one_image_sync, c["prompt"])
        for c in concepts
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    output = []
    for concept, result in zip(concepts, results):
        if isinstance(result, Exception):
            print(f"[Illustration] Failed for '{concept['concept']}': {result}")
            continue
        output.append({"concept": concept["concept"], "image": result})

    return output
