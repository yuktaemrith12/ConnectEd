"""
Phase A: Smart Fine-Tuning from best.pt
========================================
Fine-tunes the existing best model with the expanded dataset
(including new confused data, style transfer, and AI-generated images).

Uses lower learning rate and fewer epochs since the model already
knows the domain well — just needs to adapt to the new data distribution.

Usage:
  python scripts/train_smart.py
"""

import sys
from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent
BEST_MODEL = BASE_DIR / "runs" / "emotion_detect_v2_phase2" / "weights" / "best.pt"
DATA_YAML = BASE_DIR / "data.yaml"


def main():
    print("=" * 60)
    print("  PHASE A: SMART FINE-TUNING")
    print("  Model: best.pt (epoch 44, mAP50=64.8%)")
    print("  Goal: Adapt to expanded confused dataset")
    print("=" * 60)

    if not BEST_MODEL.exists():
        print(f"ERROR: Model not found at {BEST_MODEL}")
        sys.exit(1)

    model = YOLO(str(BEST_MODEL))

    model.train(
        data=str(DATA_YAML),
        epochs=40,
        imgsz=640,
        batch=8,

        # Lower LR — small refinements, model already knows the domain
        optimizer="AdamW",
        lr0=0.0005,
        lrf=0.01,
        warmup_epochs=3,
        weight_decay=0.0005,
        cos_lr=True,

        # Regularization
        label_smoothing=0.1,
        dropout=0.1,

        # Moderate augmentation — not too aggressive for fine-tuning
        hsv_h=0.015,
        hsv_s=0.5,
        hsv_v=0.3,
        degrees=8.0,
        translate=0.1,
        scale=0.4,
        fliplr=0.5,
        mosaic=0.8,
        mixup=0.1,
        copy_paste=0.05,
        erasing=0.3,
        close_mosaic=10,

        # Early stopping — tight patience since we expect quick convergence
        patience=15,

        # Performance
        amp=True,
        cache=False,
        workers=4,
        single_cls=False,

        # Output
        name="emotion_v3_phaseA",
        project="runs",
        exist_ok=True,
        verbose=True,
        plots=True,
        save=True,
        save_period=10,
    )

    print("\n" + "=" * 60)
    print("  PHASE A COMPLETE!")
    print(f"  Best model: runs/emotion_v3_phaseA/weights/best.pt")
    print("=" * 60)


if __name__ == "__main__":
    main()
