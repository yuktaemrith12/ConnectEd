"""
Model Evaluation Script — Student Emotion Detection
====================================================
Generates comprehensive metrics on the test set:
  - mAP50, mAP50-95
  - Precision, Recall, F1 per class
  - Confusion matrix
  - PR curves
  - Per-class analysis focusing on Confused detection
"""

import argparse
import sys
import json
import numpy as np
from pathlib import Path
from ultralytics import YOLO


CLASS_NAMES = {0: "Engaged", 1: "Confused", 2: "Disengaged"}


def get_args():
    parser = argparse.ArgumentParser(description="Evaluate trained emotion detection model")
    parser.add_argument("--model", type=str, required=True,
                        help="Path to trained model weights (best.pt)")
    parser.add_argument("--data", type=str, default=None,
                        help="Path to data.yaml")
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Image size for evaluation")
    parser.add_argument("--batch", type=int, default=8,
                        help="Batch size")
    parser.add_argument("--conf", type=float, default=0.25,
                        help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.5,
                        help="IoU threshold for NMS")
    parser.add_argument("--split", type=str, default="test",
                        choices=["test", "val"],
                        help="Dataset split to evaluate on")
    return parser.parse_args()


def find_data_yaml():
    """Auto-detect data.yaml."""
    script_dir = Path(__file__).resolve().parent
    for candidate in [script_dir.parent / "data.yaml", Path.cwd() / "data.yaml"]:
        if candidate.exists():
            return str(candidate)
    return None


def main():
    args = get_args()

    data_path = args.data or find_data_yaml()
    if not data_path:
        print("✗ data.yaml not found! Use --data to specify.")
        sys.exit(1)

    print("=" * 60)
    print("  MODEL EVALUATION — STUDENT EMOTION DETECTION")
    print("=" * 60)
    print(f"  Model:      {args.model}")
    print(f"  Data:       {data_path}")
    print(f"  Split:      {args.split}")
    print(f"  Confidence: {args.conf}")
    print(f"  IoU:        {args.iou}")
    print()

    # Load model
    model = YOLO(args.model)

    # Run validation
    results = model.val(
        data=data_path,
        imgsz=args.imgsz,
        batch=args.batch,
        conf=args.conf,
        iou=args.iou,
        split=args.split,
        plots=True,
        save_json=True,
        verbose=True,
    )

    # Display results
    print("\n" + "=" * 60)
    print("  RESULTS SUMMARY")
    print("=" * 60)

    print(f"\n  Overall Metrics:")
    print(f"    mAP50:      {results.box.map50:.4f}")
    print(f"    mAP50-95:   {results.box.map:.4f}")

    print(f"\n  Per-Class Performance:")
    print(f"  {'Class':12s} {'Precision':>10s} {'Recall':>10s} {'mAP50':>10s} {'mAP50-95':>10s}")
    print(f"  {'─' * 54}")

    for i, cls_name in CLASS_NAMES.items():
        if i < len(results.box.ap50):
            p = results.box.p[i] if i < len(results.box.p) else 0
            r = results.box.r[i] if i < len(results.box.r) else 0
            ap50 = results.box.ap50[i]
            ap = results.box.ap[i] if i < len(results.box.ap) else 0
            f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0

            marker = ""
            if cls_name == "Confused":
                marker = " ← KEY CLASS"

            print(f"  {cls_name:12s} {p:10.4f} {r:10.4f} {ap50:10.4f} {ap:10.4f}{marker}")

    # Confused class analysis
    print(f"\n" + "=" * 60)
    print("  CONFUSED CLASS ANALYSIS (Key for Student Engagement)")
    print("=" * 60)

    if 1 < len(results.box.ap50):
        confused_p = results.box.p[1] if 1 < len(results.box.p) else 0
        confused_r = results.box.r[1] if 1 < len(results.box.r) else 0
        confused_f1 = 2 * confused_p * confused_r / (confused_p + confused_r) if (confused_p + confused_r) > 0 else 0

        print(f"  Precision: {confused_p:.4f}")
        print(f"  Recall:    {confused_r:.4f}")
        print(f"  F1 Score:  {confused_f1:.4f}")

        if confused_r < 0.5:
            print("\n  ⚠ Low Recall! The model is missing confused students.")
            print("  Suggestions:")
            print("    1. Lower confidence threshold (--conf 0.15)")
            print("    2. Add more training data for Confused class")
            print("    3. Increase augmentation multiplier")
            print("    4. Try training with higher class weight for Confused")
        elif confused_p < 0.5:
            print("\n  ⚠ Low Precision! Too many false positives for confusion.")
            print("  Suggestions:")
            print("    1. Raise confidence threshold")
            print("    2. Review training labels for ambiguous annotations")
        else:
            print("\n  ✅ Good balance! Model detects confusion well.")

    # Save results
    output_dir = Path(args.model).parent.parent
    results_file = output_dir / "evaluation_results.json"
    results_dict = {
        "model": args.model,
        "split": args.split,
        "metrics": {
            "mAP50": float(results.box.map50),
            "mAP50-95": float(results.box.map),
        },
        "per_class": {}
    }
    for i, cls_name in CLASS_NAMES.items():
        if i < len(results.box.ap50):
            results_dict["per_class"][cls_name] = {
                "precision": float(results.box.p[i]) if i < len(results.box.p) else 0,
                "recall": float(results.box.r[i]) if i < len(results.box.r) else 0,
                "mAP50": float(results.box.ap50[i]),
            }

    with open(results_file, "w") as f:
        json.dump(results_dict, f, indent=2)
    print(f"\n   Results saved to: {results_file}")

    print(f"\n   Plots saved to: {output_dir}/")
    print(f"     - confusion_matrix.png")
    print(f"     - PR_curve.png")
    print(f"     - F1_curve.png")
    print(f"     - results.png")


if __name__ == "__main__":
    main()
