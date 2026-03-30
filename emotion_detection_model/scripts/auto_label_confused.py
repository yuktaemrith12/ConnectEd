"""
Auto-label confused face images and merge into the main dataset.
Since these are cropped face images (face = entire image),
we label each with a near-full-image bounding box as class 1 (Confused).
Split: 80% train, 10% valid, 10% test.
"""

import os
import shutil
import random
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BASE_DIR / "New Confused Dataset"

CONFUSED_CLASS = 1

def auto_label_images():
    # Get all image files
    img_files = sorted([f for f in os.listdir(SRC_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    print(f"Found {len(img_files)} images to label")
    
    # Shuffle and split
    random.seed(42)
    random.shuffle(img_files)
    
    n_train = int(len(img_files) * 0.80)
    n_valid = int(len(img_files) * 0.10)
    
    splits = {
        'train': img_files[:n_train],
        'valid': img_files[n_train:n_train + n_valid],
        'test': img_files[n_train + n_valid:],
    }
    
    print(f"Split: train={len(splits['train'])}, valid={len(splits['valid'])}, test={len(splits['test'])}")
    
    total = 0
    for split_name, files in splits.items():
        dst_img_dir = BASE_DIR / split_name / "images"
        dst_lbl_dir = BASE_DIR / split_name / "labels"
        dst_img_dir.mkdir(parents=True, exist_ok=True)
        dst_lbl_dir.mkdir(parents=True, exist_ok=True)
        
        for img_file in files:
            src_path = SRC_DIR / img_file
            name = Path(img_file).stem
            ext = Path(img_file).suffix
            
            new_name = f"newconfused_{name}"
            dst_img = dst_img_dir / f"{new_name}{ext}"
            dst_lbl = dst_lbl_dir / f"{new_name}.txt"
            
            if dst_img.exists():
                continue
            
            # Copy image
            shutil.copy2(src_path, dst_img)
            
            # Create label: full-image bounding box, class 1 (Confused)
            # YOLO format: class center_x center_y width height (all normalized)
            with open(dst_lbl, 'w') as f:
                f.write(f"{CONFUSED_CLASS} 0.500000 0.500000 0.900000 0.900000\n")
            
            total += 1
        
        print(f"  {split_name}: {len(files)} images added")
    
    print(f"\nTotal: {total} images labeled and merged")
    
    # Delete old cache files
    for split in ['train', 'valid', 'test']:
        cache = BASE_DIR / split / "labels.cache"
        if cache.exists():
            cache.unlink()
            print(f"Deleted cache: {cache}")
    
    # Count final dataset
    print(f"\nFINAL DATASET:")
    for split in ['train', 'valid', 'test']:
        img_dir = BASE_DIR / split / "images"
        count = len([f for f in os.listdir(img_dir) if os.path.isfile(img_dir / f)])
        print(f"  {split}: {count} images")

if __name__ == '__main__':
    auto_label_images()
