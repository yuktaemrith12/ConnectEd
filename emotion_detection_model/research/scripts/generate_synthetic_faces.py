"""
Bulk Synthetic Face Generator using Gemini API
================================================
Generates synthetic face images for emotion detection training.
Creates diverse confused, engaged, and disengaged face images.

Usage:
  python scripts/generate_synthetic_faces.py --api-key YOUR_GEMINI_API_KEY
  python scripts/generate_synthetic_faces.py --api-key YOUR_GEMINI_API_KEY --count 100 --emotion confused
"""

import argparse
import base64
import json
import os
import random
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system("pip install requests")
    import requests

from PIL import Image
from io import BytesIO

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "synthetic_data"

# ============================================================
# PROMPT TEMPLATES — diverse prompts for each emotion
# ============================================================

CONFUSED_PROMPTS = [
    "Close-up portrait photo of a {ethnicity} {age} {gender} with a confused expression, furrowed eyebrows, tilted head, looking puzzled, realistic photo, plain background",
    "Realistic face photo of a {ethnicity} {age} {gender} looking bewildered and uncertain, squinting eyes, slight frown, natural lighting, clean background",
    "Portrait of a confused {ethnicity} {age} {gender} student scratching their head, perplexed look, eyebrows raised unevenly, realistic photo quality",
    "Close-up of a {ethnicity} {age} {gender} with a worried confused expression, biting lower lip, uncertain gaze, studio lighting, neutral background",
    "Realistic photo of a {ethnicity} {age} {gender} looking lost and confused, wide eyes, open mouth slightly, head tilted, soft focus background",
    "Face portrait of a puzzled {ethnicity} {age} {gender}, eyebrows knitted together, looking at something with confusion, natural light, plain backdrop",
    "Photo of a {ethnicity} {age} {gender} with a quizzical confused look, one eyebrow raised, mouth pursed, realistic portrait style",
    "Close-up realistic photo of a {ethnicity} {age} {gender} deep in confused thought, hand on chin, furrowed brow, uncertain expression",
]

ENGAGED_PROMPTS = [
    "Close-up portrait photo of a {ethnicity} {age} {gender} looking attentive and focused, bright eyes, slight smile, alert expression, realistic photo, plain background",
    "Realistic face photo of a {ethnicity} {age} {gender} actively listening with interest, eyes wide open, engaged expression, natural lighting",
    "Portrait of a {ethnicity} {age} {gender} student focused and engaged in learning, looking forward attentively, slight nod, realistic photo quality",
    "Close-up of a happy {ethnicity} {age} {gender} smiling warmly, bright engaged expression, positive energy, studio lighting, neutral background",
    "Realistic photo of an excited {ethnicity} {age} {gender} with enthusiastic expression, wide smile, bright eyes, animated face",
    "Face portrait of a {ethnicity} {age} {gender} deeply concentrated while studying, focused eyes, slight smile, natural light, plain backdrop",
    "Photo of a {ethnicity} {age} {gender} nodding with understanding, warm engaged expression, attentive eyes, realistic portrait style",
    "Close-up realistic photo of a {ethnicity} {age} {gender} with a thoughtful engaged expression, looking interested and focused",
]

DISENGAGED_PROMPTS = [
    "Close-up portrait photo of a {ethnicity} {age} {gender} looking bored and disengaged, droopy eyes, expressionless face, realistic photo, plain background",
    "Realistic face photo of a {ethnicity} {age} {gender} looking sad and withdrawn, downcast eyes, frowning, natural lighting",
    "Portrait of an angry {ethnicity} {age} {gender} with frustrated expression, clenched jaw, furrowed brows, realistic photo quality",
    "Close-up of a {ethnicity} {age} {gender} yawning with boredom, tired eyes, disinterested expression, studio lighting, neutral background",
    "Realistic photo of a {ethnicity} {age} {gender} looking disgusted, nose wrinkled, upper lip raised, disapproving expression",
    "Face portrait of a {ethnicity} {age} {gender} looking distracted and checked out, blank stare, emotionally distant, natural light",
    "Photo of a {ethnicity} {age} {gender} with an unhappy frustrated expression, looking away, disengaged from surroundings, realistic portrait",
    "Close-up realistic photo of a {ethnicity} {age} {gender} looking sleepy and uninterested, half-closed eyes, blank expression",
]

# Diversity parameters
ETHNICITIES = ["Asian", "African American", "Caucasian", "Hispanic", "Middle Eastern", "South Asian", "mixed race"]
AGES = ["young", "teenage", "young adult", "middle-aged"]
GENDERS = ["man", "woman", "person"]

EMOTION_CONFIG = {
    "confused": {"prompts": CONFUSED_PROMPTS, "class_id": 1},
    "engaged": {"prompts": ENGAGED_PROMPTS, "class_id": 0},
    "disengaged": {"prompts": DISENGAGED_PROMPTS, "class_id": 2},
}


def generate_prompt(emotion):
    """Generate a randomized prompt for the given emotion."""
    config = EMOTION_CONFIG[emotion]
    template = random.choice(config["prompts"])
    return template.format(
        ethnicity=random.choice(ETHNICITIES),
        age=random.choice(AGES),
        gender=random.choice(GENDERS),
    )


def generate_image_gemini(api_key, prompt, model="gemini-2.0-flash-exp-image-generation"):
    """Generate an image using Gemini API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
        }
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(url, headers=headers, json=payload, timeout=120)

    if response.status_code == 429:
        # Rate limited — wait and retry
        return None, "RATE_LIMITED"

    if response.status_code != 200:
        return None, f"HTTP {response.status_code}: {response.text[:200]}"

    result = response.json()

    # Extract image from response
    try:
        candidates = result.get("candidates", [])
        if not candidates:
            return None, "No candidates in response"

        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            if "inlineData" in part:
                img_data = base64.b64decode(part["inlineData"]["data"])
                mime_type = part["inlineData"].get("mimeType", "image/png")
                return img_data, mime_type
        
        return None, "No image in response parts"
    except Exception as e:
        return None, f"Parse error: {str(e)}"


def save_image_with_label(img_data, emotion, index, output_dir):
    """Save image and create YOLO label file."""
    class_id = EMOTION_CONFIG[emotion]["class_id"]

    img_dir = output_dir / "images"
    lbl_dir = output_dir / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    filename = f"synth_{emotion}_{index:04d}"
    img_path = img_dir / f"{filename}.png"
    lbl_path = lbl_dir / f"{filename}.txt"

    # Save image
    with open(img_path, "wb") as f:
        f.write(img_data)

    # Save YOLO label (full-image bounding box since these are face portraits)
    with open(lbl_path, "w") as f:
        f.write(f"{class_id} 0.500000 0.500000 0.900000 0.900000\n")

    return img_path


def run_generation(api_key, emotions, count_per_emotion, output_dir):
    """Main generation loop."""
    output_dir = Path(output_dir)

    total_generated = 0
    total_failed = 0
    rate_limit_wait = 5  # seconds

    for emotion in emotions:
        print(f"\n{'='*60}")
        print(f"  Generating {count_per_emotion} {emotion.upper()} images")
        print(f"{'='*60}")

        generated = 0
        failed = 0
        i = 0

        while generated < count_per_emotion and failed < count_per_emotion * 2:
            prompt = generate_prompt(emotion)

            # Show progress
            print(f"  [{generated+1}/{count_per_emotion}] Generating {emotion}...", end=" ", flush=True)

            img_data, result = generate_image_gemini(api_key, prompt)

            if img_data:
                save_path = save_image_with_label(img_data, emotion, generated, output_dir)
                print(f"✓ Saved")
                generated += 1
                total_generated += 1
                rate_limit_wait = 5  # Reset wait time on success
            elif result == "RATE_LIMITED":
                print(f"⏳ Rate limited, waiting {rate_limit_wait}s...")
                time.sleep(rate_limit_wait)
                rate_limit_wait = min(rate_limit_wait * 1.5, 60)  # Exponential backoff
                continue  # Don't count as failed
            else:
                print(f"✗ {result}")
                failed += 1
                total_failed += 1
                time.sleep(2)

            # Small delay between requests to avoid rate limiting
            time.sleep(1.5)

            i += 1

        print(f"\n  {emotion}: Generated {generated}, Failed {failed}")

    print(f"\n{'='*60}")
    print(f"  GENERATION COMPLETE")
    print(f"  Total generated: {total_generated}")
    print(f"  Total failed: {total_failed}")
    print(f"  Output: {output_dir}")
    print(f"{'='*60}")

    return total_generated


def merge_to_dataset(synthetic_dir, dataset_dir):
    """Merge synthetic images into main train/valid/test splits."""
    import shutil

    syn_img_dir = Path(synthetic_dir) / "images"
    syn_lbl_dir = Path(synthetic_dir) / "labels"

    if not syn_img_dir.exists():
        print("No synthetic images to merge")
        return

    images = sorted([f for f in os.listdir(syn_img_dir) if f.endswith(('.png', '.jpg'))])
    random.seed(42)
    random.shuffle(images)

    n_train = int(len(images) * 0.80)
    n_valid = int(len(images) * 0.10)

    splits = {
        'train': images[:n_train],
        'valid': images[n_train:n_train + n_valid],
        'test': images[n_train + n_valid:],
    }

    total = 0
    for split_name, files in splits.items():
        dst_img = Path(dataset_dir) / split_name / "images"
        dst_lbl = Path(dataset_dir) / split_name / "labels"

        for f in files:
            name = Path(f).stem
            ext = Path(f).suffix
            lbl_file = f"{name}.txt"

            shutil.copy2(syn_img_dir / f, dst_img / f)
            if (syn_lbl_dir / lbl_file).exists():
                shutil.copy2(syn_lbl_dir / lbl_file, dst_lbl / lbl_file)
            total += 1

        print(f"  {split_name}: merged {len(files)} synthetic images")

    # Clear caches
    for split in ['train', 'valid', 'test']:
        cache = Path(dataset_dir) / split / "labels.cache"
        if cache.exists():
            cache.unlink()

    print(f"Total merged: {total} images")


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic face images using Gemini API")
    parser.add_argument("--api-key", required=True, help="Gemini API key")
    parser.add_argument("--count", type=int, default=50, help="Images per emotion class (default: 50)")
    parser.add_argument("--emotion", type=str, default="all",
                        choices=["all", "confused", "engaged", "disengaged"],
                        help="Which emotion to generate (default: all)")
    parser.add_argument("--output", type=str, default=str(OUTPUT_DIR),
                        help="Output directory for synthetic images")
    parser.add_argument("--merge", action="store_true",
                        help="Merge generated images into the main dataset after generation")
    args = parser.parse_args()

    emotions = list(EMOTION_CONFIG.keys()) if args.emotion == "all" else [args.emotion]

    print(f"{'='*60}")
    print(f"  SYNTHETIC FACE GENERATOR — Gemini API")
    print(f"{'='*60}")
    print(f"  Emotions: {', '.join(emotions)}")
    print(f"  Count per emotion: {args.count}")
    print(f"  Total images: {len(emotions) * args.count}")
    print(f"  Output: {args.output}")

    total = run_generation(args.api_key, emotions, args.count, args.output)

    if args.merge and total > 0:
        print(f"\n  Merging into main dataset...")
        merge_to_dataset(args.output, BASE_DIR)

    print(f"\nDone! Generated {total} synthetic images.")
    if not args.merge:
        print(f"Run with --merge to add them to the main dataset.")


if __name__ == "__main__":
    main()
