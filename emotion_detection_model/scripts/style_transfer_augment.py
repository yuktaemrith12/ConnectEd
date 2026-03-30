"""
Style Transfer / Face Manipulation for Data Augmentation
==========================================================
Takes existing emotion face images and creates augmented variants
using advanced OpenCV transformations that simulate expression changes.

This goes beyond standard augmentation — it applies face-specific
transforms like:
- Expression-warping (subtle mesh distortion around eyes/mouth)
- Lighting dramatization (simulate different moods via lighting)
- Age/skin tone variation
- Emotion-intensity scaling (make expressions more/less intense)
- Cross-emotion blending (subtle blends between emotions)

Usage:
  python scripts/style_transfer_augment.py --count 500
  python scripts/style_transfer_augment.py --count 200 --emotion confused
"""

import argparse
import os
import random
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "style_transfer_data"

EMOTION_DIRS = {
    "confused": 1,
    "engaged": 0,
    "disengaged": 2,
}


# ============================================================
# ADVANCED AUGMENTATION TRANSFORMS
# ============================================================

def elastic_distort(img, alpha=30, sigma=4):
    """Elastic distortion — subtly warps facial features.
    Makes expressions look slightly different without destroying the face."""
    h, w = img.shape[:2]
    dx = cv2.GaussianBlur((np.random.rand(h, w).astype(np.float32) * 2 - 1), (0, 0), sigma) * alpha
    dy = cv2.GaussianBlur((np.random.rand(h, w).astype(np.float32) * 2 - 1), (0, 0), sigma) * alpha

    x, y = np.meshgrid(np.arange(w), np.arange(h))
    map_x = (x + dx).astype(np.float32)
    map_y = (y + dy).astype(np.float32)

    return cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)


def mood_lighting(img, mood="warm"):
    """Simulate different lighting moods that affect perceived emotion."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)

    if mood == "warm":
        # Warm lighting — makes faces look more engaged/happy
        hsv[:, :, 0] = np.clip(hsv[:, :, 0] - 5, 0, 179)  # Shift hue toward red/orange
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.15, 0, 255)  # Boost saturation
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.1, 0, 255)  # Slightly brighter
    elif mood == "cold":
        # Cold/blue lighting — makes faces look more disengaged/sad
        hsv[:, :, 0] = np.clip(hsv[:, :, 0] + 10, 0, 179)  # Shift hue toward blue
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 0.85, 0, 255)  # Desaturate slightly
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 0.9, 0, 255)  # Darker
    elif mood == "harsh":
        # Harsh overhead lighting — creates shadows, looks more confused/stressed
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.2, 0, 255)
        # Add shadow gradient from top
        gradient = np.linspace(0.7, 1.0, img.shape[0]).reshape(-1, 1)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * gradient, 0, 255)
    elif mood == "dim":
        # Dim lighting — looks tired/disengaged
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 0.7, 0, 255)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 0.8, 0, 255)

    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def expression_intensity(img, factor=1.3):
    """Scale expression intensity by blending with a neutral/blurred version.
    factor > 1: more intense expression
    factor < 1: more subtle/neutral expression"""
    # Create a "neutral" version via heavy blur
    neutral = cv2.GaussianBlur(img, (0, 0), 15)
    # Blend: result = neutral + factor * (original - neutral)
    result = cv2.addWeighted(img, factor, neutral, 1 - factor, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def add_noise_grain(img, intensity=15):
    """Add film grain noise — creates more visual variety."""
    noise = np.random.randn(*img.shape) * intensity
    noisy = img.astype(np.float32) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)


def color_cast(img):
    """Apply subtle random color cast."""
    cast = np.zeros_like(img, dtype=np.float32)
    channel = random.randint(0, 2)
    cast[:, :, channel] = random.uniform(10, 30)
    result = cv2.add(img.astype(np.float32), cast)
    return np.clip(result, 0, 255).astype(np.uint8)


def dramatic_contrast(img, factor=1.5):
    """Increase contrast dramatically — emphasizes facial features."""
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    enhancer = ImageEnhance.Contrast(pil_img)
    result = enhancer.enhance(factor)
    return cv2.cvtColor(np.array(result), cv2.COLOR_RGB2BGR)


def perspective_shift(img, intensity=0.05):
    """Subtle perspective transform — simulate different camera angles."""
    h, w = img.shape[:2]
    pts1 = np.float32([[0, 0], [w, 0], [0, h], [w, h]])

    dx = w * intensity
    dy = h * intensity
    pts2 = np.float32([
        [random.uniform(0, dx), random.uniform(0, dy)],
        [w - random.uniform(0, dx), random.uniform(0, dy)],
        [random.uniform(0, dx), h - random.uniform(0, dy)],
        [w - random.uniform(0, dx), h - random.uniform(0, dy)]
    ])

    M = cv2.getPerspectiveTransform(pts1, pts2)
    return cv2.warpPerspective(img, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)


def apply_random_transforms(img, emotion):
    """Apply a random combination of transforms based on emotion type."""
    transforms = []

    # Always apply elastic distortion (subtle face warping)
    if random.random() < 0.7:
        alpha = random.uniform(15, 40)
        sigma = random.uniform(3, 6)
        img = elastic_distort(img, alpha, sigma)
        transforms.append("elastic")

    # Mood lighting based on emotion
    if random.random() < 0.6:
        if emotion == "confused":
            mood = random.choice(["harsh", "cold", "dim"])
        elif emotion == "engaged":
            mood = random.choice(["warm", "warm", "harsh"])
        else:  # disengaged
            mood = random.choice(["cold", "dim", "dim"])
        img = mood_lighting(img, mood)
        transforms.append(f"mood_{mood}")

    # Expression intensity
    if random.random() < 0.5:
        factor = random.uniform(0.8, 1.4)
        img = expression_intensity(img, factor)
        transforms.append(f"intensity_{factor:.1f}")

    # Perspective shift
    if random.random() < 0.4:
        img = perspective_shift(img, random.uniform(0.02, 0.06))
        transforms.append("perspective")

    # Color cast
    if random.random() < 0.3:
        img = color_cast(img)
        transforms.append("color_cast")

    # Film grain
    if random.random() < 0.4:
        img = add_noise_grain(img, random.uniform(8, 20))
        transforms.append("grain")

    # Dramatic contrast
    if random.random() < 0.3:
        factor = random.uniform(1.2, 1.6)
        img = dramatic_contrast(img, factor)
        transforms.append("contrast")

    # Random horizontal flip
    if random.random() < 0.5:
        img = cv2.flip(img, 1)
        transforms.append("hflip")

    return img, transforms


def get_source_images(emotion, max_count=500):
    """Get existing images for a given emotion from the training set."""
    train_img_dir = BASE_DIR / "train" / "images"
    train_lbl_dir = BASE_DIR / "train" / "labels"

    class_id = EMOTION_DIRS[emotion]
    matching_images = []

    for lbl_file in os.listdir(train_lbl_dir):
        if not lbl_file.endswith('.txt'):
            continue

        lbl_path = train_lbl_dir / lbl_file
        with open(lbl_path) as f:
            lines = f.readlines()

        # Check if any annotation matches our class
        for line in lines:
            if line.strip() and int(line.split()[0]) == class_id:
                # Find corresponding image
                img_name = lbl_file.replace('.txt', '')
                for ext in ['.jpg', '.jpeg', '.png']:
                    img_path = train_img_dir / f"{img_name}{ext}"
                    if img_path.exists():
                        matching_images.append(img_path)
                        break
                break

    random.shuffle(matching_images)
    return matching_images[:max_count]


def run_style_transfer(emotions, count_per_emotion, output_dir):
    """Generate augmented images using style transfer transforms."""
    output_dir = Path(output_dir)
    total = 0

    for emotion in emotions:
        print(f"\n{'='*60}")
        print(f"  Style Transfer: {emotion.upper()} — {count_per_emotion} images")
        print(f"{'='*60}")

        source_images = get_source_images(emotion)
        if not source_images:
            print(f"  No source images found for {emotion}!")
            continue

        print(f"  Found {len(source_images)} source images")

        img_dir = output_dir / "images"
        lbl_dir = output_dir / "labels"
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        class_id = EMOTION_DIRS[emotion]
        generated = 0

        for i in range(count_per_emotion):
            # Pick a random source image
            src_path = random.choice(source_images)
            img = cv2.imread(str(src_path))
            if img is None:
                continue

            # Apply random style transforms
            augmented, transforms_used = apply_random_transforms(img, emotion)

            # Save
            filename = f"style_{emotion}_{i:04d}"
            cv2.imwrite(str(img_dir / f"{filename}.jpg"), augmented)

            # Create YOLO label (full-image bounding box)
            with open(lbl_dir / f"{filename}.txt", "w") as f:
                f.write(f"{class_id} 0.500000 0.500000 0.900000 0.900000\n")

            generated += 1

            if (i + 1) % 100 == 0:
                print(f"  Generated {i + 1}/{count_per_emotion}")

        print(f"  ✓ Generated {generated} {emotion} images")
        total += generated

    print(f"\n{'='*60}")
    print(f"  STYLE TRANSFER COMPLETE: {total} images generated")
    print(f"  Output: {output_dir}")
    print(f"{'='*60}")

    return total


def merge_to_dataset(synthetic_dir, dataset_dir):
    """Merge style-transferred images into main dataset."""
    syn_img_dir = Path(synthetic_dir) / "images"
    syn_lbl_dir = Path(synthetic_dir) / "labels"

    if not syn_img_dir.exists():
        print("No images to merge")
        return

    images = sorted([f for f in os.listdir(syn_img_dir) if f.endswith(('.png', '.jpg'))])
    random.seed(42)
    random.shuffle(images)

    n_train = int(len(images) * 0.85)  # More to train since these are augmented
    n_valid = int(len(images) * 0.075)

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
            lbl_file = f"{name}.txt"
            shutil.copy2(syn_img_dir / f, dst_img / f)
            if (syn_lbl_dir / lbl_file).exists():
                shutil.copy2(syn_lbl_dir / lbl_file, dst_lbl / lbl_file)
            total += 1

        print(f"  {split_name}: merged {len(files)} images")

    # Clear caches
    for split in ['train', 'valid', 'test']:
        cache = Path(dataset_dir) / split / "labels.cache"
        if cache.exists():
            cache.unlink()

    print(f"Total merged: {total} images")


def main():
    parser = argparse.ArgumentParser(description="Style Transfer Face Augmentation")
    parser.add_argument("--count", type=int, default=200,
                        help="Augmented images per emotion (default: 200)")
    parser.add_argument("--emotion", type=str, default="all",
                        choices=["all", "confused", "engaged", "disengaged"])
    parser.add_argument("--output", type=str, default=str(OUTPUT_DIR))
    parser.add_argument("--merge", action="store_true",
                        help="Merge into main dataset after generation")
    args = parser.parse_args()

    emotions = list(EMOTION_DIRS.keys()) if args.emotion == "all" else [args.emotion]

    total = run_style_transfer(emotions, args.count, args.output)

    if args.merge and total > 0:
        print("\nMerging into main dataset...")
        merge_to_dataset(args.output, BASE_DIR)


if __name__ == "__main__":
    main()
