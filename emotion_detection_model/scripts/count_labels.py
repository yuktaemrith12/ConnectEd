import os
from collections import Counter

base = r'Additional Dataset'
folders = ['Angry.v1i.yolov8', 'Disgust.v1i.yolov8', 'Excited.v1i.yolov8', 'Fear.v1i.yolov8']
splits = ['train', 'valid', 'test']

with open('label_counts.txt', 'w') as out:
    for folder in folders:
        out.write(f'=== {folder} ===\n')
        for split in splits:
            label_dir = os.path.join(base, folder, split, 'labels')
            if not os.path.exists(label_dir):
                out.write(f'  {split}: NO FOLDER\n')
                continue
            c = Counter()
            for f in os.listdir(label_dir):
                if f.endswith('.txt'):
                    for line in open(os.path.join(label_dir, f)):
                        if line.strip():
                            c[int(line.split()[0])] += 1
            out.write(f'  {split}: {dict(sorted(c.items()))}\n')
        out.write('\n')
    
    # Also count images per split
    out.write('=== CURRENT DATASET IMAGE COUNTS ===\n')
    for split in ['train', 'valid', 'test']:
        img_dir = os.path.join(split, 'images')
        count = len([f for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f))])
        out.write(f'  {split}: {count} images\n')
    
    out.write('\n=== ADDITIONAL DATASET IMAGE COUNTS ===\n')
    for folder in folders:
        out.write(f'  {folder}:\n')
        for split in splits:
            img_dir = os.path.join(base, folder, split, 'images')
            if not os.path.exists(img_dir):
                out.write(f'    {split}: NO FOLDER\n')
                continue
            count = len([f for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f))])
            out.write(f'    {split}: {count} images\n')

print('Done! Results written to label_counts.txt')
