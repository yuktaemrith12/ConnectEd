"""
Merge Additional Dataset subfolders into the main train/valid/test splits.
Remaps all original class IDs to the 3-class system:
  0: Engaged  (Happy, Excited, Neutral, Surprise, Positive emotion, etc.)
  1: Confused (Fear, Confused, Stuned/Stunned, Worried)
  2: Disengaged (Angry, Anger, Disgust, Sad)

Non-emotion labels (Female, Male, emotion-baby) are SKIPPED.
"""

import os
import shutil
from collections import Counter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADDITIONAL = os.path.join(BASE_DIR, 'Additional Dataset')

# === CLASS REMAPPING RULES ===
# Each dict maps original class ID -> new 3-class ID (or None to skip)

REMAP = {
    'Angry.v1i.yolov8': {
        # ['Anger', 'Angry', 'Female', 'Happy', 'Male', 'anger', 'angry', 'angry face', 'emotion-baby']
        0: 2,     # Anger -> Disengaged
        1: 2,     # Angry -> Disengaged
        2: None,  # Female -> SKIP
        3: 0,     # Happy -> Engaged
        4: None,  # Male -> SKIP
        5: 2,     # anger -> Disengaged
        6: 2,     # angry -> Disengaged
        7: 2,     # angry face -> Disengaged
        8: None,  # emotion-baby -> SKIP
    },
    'Disgust.v1i.yolov8': {
        # ['disgust']
        0: 2,     # disgust -> Disengaged
    },
    'Excited.v1i.yolov8': {
        # ['Confused', 'Excited', 'Fear', 'Happy', 'Neutral', 'Positive emotion', 'Sad', 'Stuned', 'Surprise', 'excited', 'happy', 'surprise']
        0: 1,     # Confused -> Confused
        1: 0,     # Excited -> Engaged
        2: 1,     # Fear -> Confused
        3: 0,     # Happy -> Engaged
        4: 0,     # Neutral -> Engaged
        5: 0,     # Positive emotion -> Engaged
        6: 2,     # Sad -> Disengaged
        7: 1,     # Stuned -> Confused
        8: 0,     # Surprise -> Engaged
        9: 0,     # excited -> Engaged
        10: 0,    # happy -> Engaged
        11: 0,    # surprise -> Engaged
    },
    'Fear.v1i.yolov8': {
        # ['Fear', 'anger', 'fear', 'sad']
        0: 1,     # Fear -> Confused
        1: 2,     # anger -> Disengaged
        2: 1,     # fear -> Confused
        3: 2,     # sad -> Disengaged
    },
}

SPLITS = ['train', 'valid', 'test']

def merge_dataset(folder_name, remap):
    """Merge one Additional Dataset subfolder into the main dataset."""
    prefix = folder_name.split('.')[0].lower()  # e.g. 'angry', 'disgust', etc.
    folder_path = os.path.join(ADDITIONAL, folder_name)
    
    stats = {'images_copied': 0, 'labels_remapped': 0, 'annotations_skipped': 0}
    
    for split in SPLITS:
        src_img_dir = os.path.join(folder_path, split, 'images')
        src_lbl_dir = os.path.join(folder_path, split, 'labels')
        dst_img_dir = os.path.join(BASE_DIR, split, 'images')
        dst_lbl_dir = os.path.join(BASE_DIR, split, 'labels')
        
        if not os.path.exists(src_img_dir):
            print(f"  [{split}] No images folder — skipping")
            continue
        
        # Ensure destination dirs exist
        os.makedirs(dst_img_dir, exist_ok=True)
        os.makedirs(dst_lbl_dir, exist_ok=True)
        
        # Get all image files
        img_files = [f for f in os.listdir(src_img_dir) if os.path.isfile(os.path.join(src_img_dir, f))]
        
        for img_file in img_files:
            name, ext = os.path.splitext(img_file)
            # Prefix filename to avoid collisions
            new_name = f"{prefix}_{name}"
            new_img_file = f"{new_name}{ext}"
            new_lbl_file = f"{new_name}.txt"
            
            # Copy image
            src_img = os.path.join(src_img_dir, img_file)
            dst_img = os.path.join(dst_img_dir, new_img_file)
            if not os.path.exists(dst_img):
                shutil.copy2(src_img, dst_img)
                stats['images_copied'] += 1
            
            # Remap label file
            src_lbl = os.path.join(src_lbl_dir, f"{name}.txt")
            dst_lbl = os.path.join(dst_lbl_dir, new_lbl_file)
            
            if os.path.exists(src_lbl):
                remapped_lines = []
                with open(src_lbl, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split()
                        orig_class = int(parts[0])
                        new_class = remap.get(orig_class)
                        if new_class is None:
                            stats['annotations_skipped'] += 1
                            continue
                        parts[0] = str(new_class)
                        remapped_lines.append(' '.join(parts))
                
                if remapped_lines:
                    with open(dst_lbl, 'w') as f:
                        f.write('\n'.join(remapped_lines) + '\n')
                    stats['labels_remapped'] += 1
                else:
                    # All annotations were skipped — still copy image but create empty label
                    with open(dst_lbl, 'w') as f:
                        f.write('')
        
        print(f"  [{split}] Copied {len(img_files)} images")
    
    return stats


def count_final_stats():
    """Count the final dataset statistics after merge."""
    print("\n" + "=" * 60)
    print("FINAL DATASET STATISTICS")
    print("=" * 60)
    
    class_names = {0: 'Engaged', 1: 'Confused', 2: 'Disengaged'}
    
    for split in SPLITS:
        lbl_dir = os.path.join(BASE_DIR, split, 'labels')
        img_dir = os.path.join(BASE_DIR, split, 'images')
        
        img_count = len([f for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f))])
        
        class_counts = Counter()
        for f in os.listdir(lbl_dir):
            if f.endswith('.txt'):
                with open(os.path.join(lbl_dir, f)) as lf:
                    for line in lf:
                        if line.strip():
                            class_counts[int(line.split()[0])] += 1
        
        print(f"\n{split.upper()}: {img_count} images")
        for cid in sorted(class_counts.keys()):
            name = class_names.get(cid, f'Unknown({cid})')
            print(f"  Class {cid} ({name}): {class_counts[cid]} annotations")


if __name__ == '__main__':
    print("=" * 60)
    print("MERGING ADDITIONAL DATASETS")
    print("=" * 60)
    
    total_stats = {'images_copied': 0, 'labels_remapped': 0, 'annotations_skipped': 0}
    
    for folder_name, remap in REMAP.items():
        print(f"\n>>> Processing: {folder_name}")
        stats = merge_dataset(folder_name, remap)
        for k in total_stats:
            total_stats[k] += stats[k]
        print(f"    Images: {stats['images_copied']}, Labels remapped: {stats['labels_remapped']}, Annotations skipped: {stats['annotations_skipped']}")
    
    print(f"\n{'=' * 60}")
    print(f"MERGE COMPLETE")
    print(f"  Total images copied: {total_stats['images_copied']}")
    print(f"  Total labels remapped: {total_stats['labels_remapped']}")
    print(f"  Total annotations skipped: {total_stats['annotations_skipped']}")
    
    # Count final stats
    count_final_stats()
