"""
Label Remapping Script
=====================
Converts 10-class emotion labels → 3-class system:
    0: Engaged   (Happy, Thinking, Serious, Excited, neutral)
    1: Confused   (Worried, Fear)
    2: Disengaged (Disgust, Sad, Angry)

Creates a backup of original labels and writes remapped labels in-place.
"""

import os
import shutil
from pathlib import Path
from collections import Counter

# ── Class Mapping ──────────────────────────────────────────────────────────
# Original classes from Roboflow:
#   0: Angry, 1: Disgust, 2: Excited, 3: Fear, 4: Happy,
#   5: Sad, 6: Serious, 7: Thinking, 8: Worried, 9: neutral

CLASS_REMAP = {
    0: 2,  # Angry      → Disengaged
    1: 2,  # Disgust    → Disengaged
    2: 0,  # Excited    → Engaged
    3: 1,  # Fear       → Confused
    4: 0,  # Happy      → Engaged
    5: 2,  # Sad        → Disengaged
    6: 0,  # Serious    → Engaged
    7: 0,  # Thinking   → Engaged
    8: 1,  # Worried    → Confused
    9: 0,  # neutral    → Engaged
}

NEW_CLASSES = {0: "Engaged", 1: "Confused", 2: "Disengaged"}

ORIGINAL_CLASSES = [
    "Angry", "Disgust", "Excited", "Fear", "Happy",
    "Sad", "Serious", "Thinking", "Worried", "neutral"
]


def remap_label_file(label_path: Path) -> dict:
    """Remap class IDs in a single YOLO label file. Returns class count dict."""
    counts = Counter()

    with open(label_path, "r") as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        parts = line.strip().split()
        if len(parts) < 5:
            continue

        old_class = int(parts[0])
        new_class = CLASS_REMAP.get(old_class)

        if new_class is None:
            print(f"  [!] Unknown class {old_class} in {label_path.name}, skipping line")
            continue

        parts[0] = str(new_class)
        new_lines.append(" ".join(parts) + "\n")
        counts[new_class] += 1

    with open(label_path, "w") as f:
        f.writelines(new_lines)

    return counts


def remap_split(base_dir: Path, split: str) -> Counter:
    """Remap all labels in a split (train/valid/test)."""
    labels_dir = base_dir / split / "labels"
    backup_dir = base_dir / f"{split}_labels_backup_10class"

    if not labels_dir.exists():
        print(f"  [X] Labels directory not found: {labels_dir}")
        return Counter()

    # Create backup
    if not backup_dir.exists():
        print(f"  [BACKUP] Backing up original labels -> {backup_dir.name}/")
        shutil.copytree(labels_dir, backup_dir)
    else:
        print(f"  [BACKUP] Backup already exists: {backup_dir.name}/")

    total_counts = Counter()
    label_files = list(labels_dir.glob("*.txt"))

    for lf in label_files:
        counts = remap_label_file(lf)
        total_counts.update(counts)

    return total_counts


def main():
    base_dir = Path(__file__).resolve().parent.parent

    print("=" * 60)
    print("  LABEL REMAPPING: 10 Classes -> 3 Classes")
    print("=" * 60)
    print()
    print("  Mapping:")
    for old_id, old_name in enumerate(ORIGINAL_CLASSES):
        new_id = CLASS_REMAP[old_id]
        new_name = NEW_CLASSES[new_id]
        print(f"    {old_name:12s} (class {old_id}) -> {new_name:12s} (class {new_id})")
    print()

    grand_total = Counter()

    for split in ["train", "valid", "test"]:
        print(f"-- {split.upper()} {'-' * 45}")
        counts = remap_split(base_dir, split)
        grand_total.update(counts)

        total = sum(counts.values())
        for cls_id in sorted(NEW_CLASSES.keys()):
            count = counts.get(cls_id, 0)
            pct = (count / total * 100) if total > 0 else 0
            bar = "#" * int(pct / 2)
            print(f"    {NEW_CLASSES[cls_id]:12s}: {count:5d} ({pct:5.1f}%) {bar}")
        print(f"    {'Total':12s}: {total:5d}")
        print()

    # Summary
    print("=" * 60)
    print("  OVERALL SUMMARY")
    print("=" * 60)
    total = sum(grand_total.values())
    for cls_id in sorted(NEW_CLASSES.keys()):
        count = grand_total.get(cls_id, 0)
        pct = (count / total * 100) if total > 0 else 0
        bar = "#" * int(pct / 2)
        print(f"  {NEW_CLASSES[cls_id]:12s}: {count:5d} ({pct:5.1f}%) {bar}")
    print(f"  {'Total':12s}: {total:5d}")
    print()

    # Imbalance warning
    max_count = max(grand_total.values())
    min_count = min(grand_total.values())
    ratio = max_count / min_count if min_count > 0 else float("inf")
    print(f"  Imbalance ratio: {ratio:.1f}:1")
    if ratio > 3:
        print("  [!] Significant imbalance detected! Run augment_minority_classes.py next.")
    else:
        print("  [OK] Class distribution is acceptable.")

    print()
    print("[DONE] Label remapping complete! Original labels backed up.")


if __name__ == "__main__":
    main()
