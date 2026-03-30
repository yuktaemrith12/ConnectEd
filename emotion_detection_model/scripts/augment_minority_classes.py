"""
Minority Class Augmentation Script
===================================
After remapping to 3 classes, the distribution is heavily imbalanced:
    Engaged:    ~2,651 (59.7%)
    Confused:     ~335 ( 7.5%)  <- Needs 5-7x augmentation!
    Disengaged: ~1,454 (32.7%)  <- Needs ~2x augmentation

Uses Albumentations for realistic, classroom-appropriate augmentations.
Only augments TRAINING data. Validation/test sets remain untouched.
"""

import os
import random
import cv2
import numpy as np
import albumentations as A
from pathlib import Path
from collections import Counter
from tqdm import tqdm


# -- Augmentation Pipelines -------------------------------------------------

def get_light_augment():
    """Light augmentations — safe for any image."""
    return A.Compose([
        A.HorizontalFlip(p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.8),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=20, p=0.5),
    ], bbox_params=A.BboxParams(format='yolo', label_fields=['class_labels'], min_visibility=0.3))


def get_medium_augment():
    """Medium augmentations — simulates classroom conditions."""
    return A.Compose([
        A.HorizontalFlip(p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.8),
        A.HueSaturationValue(hue_shift_limit=15, sat_shift_limit=30, val_shift_limit=30, p=0.7),
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 5), p=1.0),
            A.MotionBlur(blur_limit=(3, 7), p=1.0),
        ], p=0.3),
        A.GaussNoise(var_limit=(5.0, 25.0), p=0.3),
        A.CLAHE(clip_limit=2.0, p=0.3),
        A.Rotate(limit=12, border_mode=cv2.BORDER_REFLECT_101, p=0.4),
    ], bbox_params=A.BboxParams(format='yolo', label_fields=['class_labels'], min_visibility=0.3))


def get_heavy_augment():
    """Heavy augmentations — maximum diversity for severely underrepresented classes."""
    return A.Compose([
        A.HorizontalFlip(p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.4, contrast_limit=0.4, p=0.9),
        A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=40, val_shift_limit=40, p=0.8),
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 7), p=1.0),
            A.MotionBlur(blur_limit=(3, 9), p=1.0),
            A.MedianBlur(blur_limit=5, p=1.0),
        ], p=0.4),
        A.GaussNoise(var_limit=(10.0, 40.0), p=0.4),
        A.CLAHE(clip_limit=3.0, p=0.4),
        A.Rotate(limit=15, border_mode=cv2.BORDER_REFLECT_101, p=0.5),
        A.RandomScale(scale_limit=0.15, p=0.3),
        A.CoarseDropout(max_holes=3, max_height=30, max_width=30,
                        min_holes=1, min_height=10, min_width=10,
                        fill_value=0, p=0.3),
        A.OneOf([
            A.RandomShadow(shadow_roi=(0, 0, 1, 1), num_shadows_limit=(1, 2), p=1.0),
            A.RandomFog(fog_coef_lower=0.1, fog_coef_upper=0.2, p=1.0),
        ], p=0.2),
        A.ImageCompression(quality_lower=60, quality_upper=95, p=0.3),
    ], bbox_params=A.BboxParams(format='yolo', label_fields=['class_labels'], min_visibility=0.3))


def read_yolo_label(label_path: Path):
    """Read YOLO label file. Returns (bboxes, class_labels)."""
    bboxes = []
    class_labels = []

    if not label_path.exists():
        return bboxes, class_labels

    with open(label_path, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                cls_id = int(float(parts[0]))
                x_c, y_c, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                # Clamp values to valid range
                x_c = max(0.001, min(0.999, x_c))
                y_c = max(0.001, min(0.999, y_c))
                w = max(0.001, min(0.999, w))
                h = max(0.001, min(0.999, h))
                bboxes.append([x_c, y_c, w, h])
                class_labels.append(cls_id)

    return bboxes, class_labels


def write_yolo_label(label_path: Path, bboxes, class_labels):
    """Write YOLO label file."""
    with open(label_path, 'w') as f:
        for bbox, cls_id in zip(bboxes, class_labels):
            f.write(f"{int(cls_id)} {bbox[0]:.6f} {bbox[1]:.6f} {bbox[2]:.6f} {bbox[3]:.6f}\n")


def get_class_files(labels_dir: Path, target_class: int):
    """Get all label files containing a specific class."""
    files = []
    for lf in labels_dir.glob("*.txt"):
        _, class_labels = read_yolo_label(lf)
        if target_class in class_labels:
            files.append(lf)
    return files


def augment_image(img_path: Path, label_path: Path, transform, output_img_dir: Path,
                  output_lbl_dir: Path, aug_idx: int) -> bool:
    """Apply augmentation to a single image+label pair and save."""
    img = cv2.imread(str(img_path))
    if img is None:
        return False

    bboxes, class_labels = read_yolo_label(label_path)
    if not bboxes:
        return False

    try:
        transformed = transform(image=img, bboxes=bboxes, class_labels=class_labels)
    except Exception as e:
        return False

    if len(transformed['bboxes']) == 0:
        return False

    # Save augmented image
    stem = img_path.stem
    suffix = img_path.suffix
    new_img_name = f"{stem}_aug{aug_idx}{suffix}"
    new_lbl_name = f"{stem}_aug{aug_idx}.txt"

    cv2.imwrite(str(output_img_dir / new_img_name), transformed['image'])
    write_yolo_label(
        output_lbl_dir / new_lbl_name,
        transformed['bboxes'],
        transformed['class_labels']
    )
    return True


def count_classes(labels_dir: Path) -> Counter:
    """Count instances of each class in a labels directory."""
    counts = Counter()
    for lf in labels_dir.glob("*.txt"):
        _, class_labels = read_yolo_label(lf)
        counts.update(class_labels)
    return counts


def main():
    base_dir = Path(__file__).resolve().parent.parent
    train_images = base_dir / "train" / "images"
    train_labels = base_dir / "train" / "labels"

    CLASS_NAMES = {0: "Engaged", 1: "Confused", 2: "Disengaged"}

    print("=" * 60)
    print("  MINORITY CLASS AUGMENTATION")
    print("=" * 60)

    # Count current distribution
    print("\n📊 Current class distribution (TRAIN):")
    counts = count_classes(train_labels)
    total = sum(counts.values())
    for cls_id in sorted(CLASS_NAMES.keys()):
        c = counts.get(cls_id, 0)
        pct = (c / total * 100) if total > 0 else 0
        print(f"  {CLASS_NAMES[cls_id]:12s}: {c:5d} ({pct:5.1f}%)")
    print(f"  {'Total':12s}: {total:5d}")

    # Determine augmentation targets
    max_count = max(counts.values())
    target_count = int(max_count * 0.8)  # Target 80% of the majority class

    print(f"\n🎯 Target count per class: ~{target_count}")
    print()

    for cls_id in sorted(CLASS_NAMES.keys()):
        current = counts.get(cls_id, 0)
        if current >= target_count:
            print(f"  {CLASS_NAMES[cls_id]:12s}: Already sufficient ({current} ≥ {target_count}), skipping.")
            continue

        needed = target_count - current
        print(f"\n  {CLASS_NAMES[cls_id]:12s}: Need {needed} more samples (current: {current})")

        # Get files for this class
        class_files = get_class_files(train_labels, cls_id)
        if not class_files:
            print(f"    X No files found for class {cls_id}")
            continue

        # Choose augmentation intensity based on how much we need
        multiplier = needed / len(class_files)
        if multiplier > 4:
            transform = get_heavy_augment()
            level = "HEAVY"
        elif multiplier > 2:
            transform = get_medium_augment()
            level = "MEDIUM"
        else:
            transform = get_light_augment()
            level = "LIGHT"

        augs_per_image = max(1, int(np.ceil(needed / len(class_files))))
        print(f"    📸 {len(class_files)} source images × {augs_per_image} augmentations = ~{len(class_files) * augs_per_image} new samples")
        print(f"    🔧 Augmentation level: {level}")

        generated = 0
        random.shuffle(class_files)

        pbar = tqdm(total=needed, desc=f"    Augmenting {CLASS_NAMES[cls_id]}", unit="img")
        for lf in class_files:
            if generated >= needed:
                break

            img_name = lf.stem + ".jpg"
            img_path = train_images / img_name

            # Try with .png if .jpg doesn't exist
            if not img_path.exists():
                img_name = lf.stem + ".png"
                img_path = train_images / img_name
            if not img_path.exists():
                continue

            for aug_i in range(augs_per_image):
                if generated >= needed:
                    break
                success = augment_image(
                    img_path, lf, transform,
                    train_images, train_labels,
                    aug_idx=aug_i + generated
                )
                if success:
                    generated += 1
                    pbar.update(1)

        pbar.close()
        print(f"    [DONE] Generated {generated} augmented samples")

    # Final distribution
    print("\n" + "=" * 60)
    print("  FINAL CLASS DISTRIBUTION (TRAIN)")
    print("=" * 60)
    final_counts = count_classes(train_labels)
    final_total = sum(final_counts.values())
    for cls_id in sorted(CLASS_NAMES.keys()):
        c = final_counts.get(cls_id, 0)
        pct = (c / final_total * 100) if final_total > 0 else 0
        bar = "#" * int(pct / 2)
        print(f"  {CLASS_NAMES[cls_id]:12s}: {c:5d} ({pct:5.1f}%) {bar}")
    print(f"  {'Total':12s}: {final_total:5d}")

    max_c = max(final_counts.values())
    min_c = min(final_counts.values())
    print(f"\n  Imbalance ratio: {max_c/min_c:.1f}:1")
    print("\n[DONE] Augmentation complete!")


if __name__ == "__main__":
    main()
