"""
YOLOv8 Training Script — Student Emotion Detection
===================================================
Optimized for NVIDIA RTX 3050 Ti (4GB VRAM)
3 Classes: Engaged, Confused, Disengaged

Two-phase training:
  Phase 1: Frozen backbone (warmup)
  Phase 2: Full fine-tuning with cosine LR
"""

import argparse
import os
import sys
from pathlib import Path
from ultralytics import YOLO


def get_args():
    parser = argparse.ArgumentParser(description="Train YOLOv8 for Student Emotion Detection")

    # Model
    parser.add_argument("--model", type=str, default="yolov8s.pt",
                        choices=["yolov8n.pt", "yolov8s.pt", "yolov8m.pt", "yolov8l.pt"],
                        help="Pretrained model size (default: yolov8s for 4GB VRAM)")
    parser.add_argument("--resume", type=str, default=None,
                        help="Resume from a checkpoint (path to last.pt)")

    # Data
    parser.add_argument("--data", type=str, default=None,
                        help="Path to data.yaml (auto-detected if not set)")
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Image size for training")

    # Training
    parser.add_argument("--epochs", type=int, default=150,
                        help="Total epochs")
    parser.add_argument("--batch", type=int, default=8,
                        help="Batch size (8 safe for RTX 3050 Ti 4GB)")
    parser.add_argument("--patience", type=int, default=30,
                        help="Early stopping patience")
    parser.add_argument("--workers", type=int, default=4,
                        help="Data loading workers")

    # Phase control
    parser.add_argument("--freeze-epochs", type=int, default=10,
                        help="Epochs with frozen backbone (Phase 1)")
    parser.add_argument("--skip-freeze", action="store_true",
                        help="Skip Phase 1 (frozen backbone)")

    # Output
    parser.add_argument("--name", type=str, default="emotion_detect",
                        help="Run name for saving results")
    parser.add_argument("--project", type=str, default=None,
                        help="Project directory for results")

    return parser.parse_args()


def find_data_yaml():
    """Auto-detect data.yaml location."""
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir.parent / "data.yaml",
        script_dir / "data.yaml",
        Path.cwd() / "data.yaml",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def train_phase1_frozen(model: YOLO, data_path: str, args):
    """Phase 1: Train with frozen backbone for initial head adaptation."""
    print("\n" + "=" * 60)
    print("  PHASE 1: FROZEN BACKBONE TRAINING")
    print(f"  Freezing first 10 layers for {args.freeze_epochs} epochs")
    print("=" * 60)

    model.train(
        data=data_path,
        epochs=args.freeze_epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        freeze=10,                  # Freeze backbone layers

        # Optimizer
        optimizer="AdamW",
        lr0=0.01,
        lrf=0.1,
        warmup_epochs=3,
        weight_decay=0.0005,

        # Augmentation (lighter for Phase 1)
        hsv_h=0.01,
        hsv_s=0.5,
        hsv_v=0.3,
        degrees=5.0,
        translate=0.1,
        scale=0.3,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.0,
        erasing=0.0,

        # Performance
        amp=True,                   # Mixed precision — essential for 4GB VRAM
        cache=False,                # Don't cache to save RAM
        workers=args.workers,
        single_cls=False,

        # Output
        name=f"{args.name}_phase1",
        project=args.project,
        exist_ok=True,
        verbose=True,
        plots=True,
    )

    return model


def train_phase2_finetune(model: YOLO, data_path: str, args):
    """Phase 2: Full fine-tuning with all augmentations."""
    print("\n" + "=" * 60)
    print("  PHASE 2: FULL FINE-TUNING")
    print(f"  All layers unfrozen, {args.epochs} epochs with cosine LR")
    print("=" * 60)

    model.train(
        data=data_path,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,

        # Optimizer
        optimizer="AdamW",
        lr0=0.001,                  # Lower LR for fine-tuning
        lrf=0.01,                   # Final LR = lr0 × lrf
        warmup_epochs=5,
        weight_decay=0.0005,
        cos_lr=True,                # Cosine annealing

        # Regularization
        label_smoothing=0.1,        # Prevents overconfidence
        dropout=0.1,                # Head dropout

        # Online augmentation (YOLOv8 built-in)
        hsv_h=0.015,               # Hue
        hsv_s=0.7,                 # Saturation
        hsv_v=0.4,                 # Value/brightness
        degrees=10.0,              # Rotation
        translate=0.1,             # Translation
        scale=0.5,                 # Scale
        fliplr=0.5,               # Horizontal flip
        mosaic=1.0,               # Mosaic (combines 4 images)
        mixup=0.15,               # MixUp blending
        copy_paste=0.1,           # Copy-paste augmentation
        erasing=0.4,              # Random erasing
        close_mosaic=15,          # Disable mosaic last 15 epochs

        # Early stopping
        patience=args.patience,

        # Performance
        amp=True,
        cache=False,
        workers=args.workers,
        single_cls=False,

        # Output
        name=f"{args.name}_phase2",
        project=args.project,
        exist_ok=True,
        verbose=True,
        plots=True,
        save=True,
        save_period=25,             # Save checkpoint every 25 epochs
    )

    return model


def main():
    args = get_args()

    # Find data.yaml
    data_path = args.data or find_data_yaml()
    if not data_path or not Path(data_path).exists():
        print("✗ Could not find data.yaml! Specify with --data")
        sys.exit(1)

    # Set project dir
    if args.project is None:
        args.project = str(Path(__file__).resolve().parent.parent / "runs")

    print("=" * 60)
    print("  STUDENT EMOTION DETECTION — YOLOv8 TRAINING")
    print("=" * 60)
    print(f"  Model:     {args.model}")
    print(f"  Data:      {data_path}")
    print(f"  Image size: {args.imgsz}")
    print(f"  Batch:     {args.batch}")
    print(f"  Epochs:    {args.epochs}")
    print(f"  GPU:       RTX 3050 Ti (4GB VRAM)")
    print(f"  AMP:       Enabled (FP16)")
    print(f"  Output:    {args.project}/{args.name}")
    print()

    # Resume or start fresh
    if args.resume:
        print(f"📂 Resuming from: {args.resume}")
        model = YOLO(args.resume)
        train_phase2_finetune(model, data_path, args)
    else:
        # Load pretrained model
        model = YOLO(args.model)

        # Phase 1: Frozen backbone
        if not args.skip_freeze:
            train_phase1_frozen(model, data_path, args)

            # Get best weights from Phase 1
            phase1_best = Path(args.project) / f"{args.name}_phase1" / "weights" / "best.pt"
            if phase1_best.exists():
                model = YOLO(str(phase1_best))
                print(f"\n✅ Phase 1 complete. Loaded best weights: {phase1_best}")
            else:
                print("\n⚠ Phase 1 best weights not found, continuing with current model")

        # Phase 2: Full fine-tuning
        train_phase2_finetune(model, data_path, args)

    # Final results
    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE!")
    print("=" * 60)

    best_path = Path(args.project) / f"{args.name}_phase2" / "weights" / "best.pt"
    if best_path.exists():
        print(f"  Best model: {best_path}")
        print(f"\n  Next steps:")
        print(f"    1. Evaluate:  python scripts/evaluate_model.py --model {best_path}")
        print(f"    2. Export:    python scripts/export_model.py --model {best_path}")
        print(f"    3. Live test: python scripts/live_inference.py --model {best_path}")


if __name__ == "__main__":
    main()
    