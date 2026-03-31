"""
Model Export Script — Student Emotion Detection
================================================
Exports the trained YOLOv8 model to optimized formats:
  - ONNX (cross-platform, CPU/GPU)
  - TensorRT (NVIDIA GPU — fastest)
  - OpenVINO (Intel hardware)
  - TFLite (edge devices)
  - CoreML (Apple devices)

Also benchmarks inference speed across formats.
"""

import argparse
import sys
import time
from pathlib import Path

try:
    from ultralytics import YOLO
except ImportError:
    print("✗ ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)


def get_args():
    parser = argparse.ArgumentParser(description="Export emotion detection model")
    parser.add_argument("--model", type=str, required=True,
                        help="Path to trained model (best.pt)")
    parser.add_argument("--format", type=str, nargs="+",
                        default=["onnx"],
                        choices=["onnx", "tensorrt", "openvino", "tflite", "coreml", "all"],
                        help="Export format(s)")
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Image size for export")
    parser.add_argument("--half", action="store_true",
                        help="Export with FP16 half-precision (recommended for GPU)")
    parser.add_argument("--dynamic", action="store_true",
                        help="Enable dynamic batch size (ONNX)")
    parser.add_argument("--simplify", action="store_true", default=True,
                        help="Simplify ONNX model")
    parser.add_argument("--benchmark", action="store_true",
                        help="Run inference benchmark after export")
    parser.add_argument("--benchmark-runs", type=int, default=100,
                        help="Number of benchmark inference runs")
    return parser.parse_args()


def export_model(model: YOLO, fmt: str, args) -> str:
    """Export model to the specified format. Returns exported path."""
    print(f"\n  📦 Exporting to {fmt.upper()}...")

    try:
        export_path = model.export(
            format=fmt,
            imgsz=args.imgsz,
            half=args.half if fmt in ["onnx", "tensorrt", "openvino"] else False,
            dynamic=args.dynamic if fmt == "onnx" else False,
            simplify=args.simplify if fmt == "onnx" else False,
        )
        print(f"  ✅ Exported: {export_path}")
        return str(export_path)
    except Exception as e:
        print(f"  ✗ Export to {fmt} failed: {e}")
        return None


def benchmark_model(model_path: str, imgsz: int, num_runs: int):
    """Benchmark inference speed."""
    import numpy as np

    print(f"\n  ⏱ Benchmarking: {Path(model_path).name}")
    print(f"    Image size: {imgsz}, Runs: {num_runs}")

    model = YOLO(model_path)

    # Warmup
    dummy = np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)
    for _ in range(5):
        model.predict(dummy, imgsz=imgsz, verbose=False)

    # Benchmark
    times = []
    for _ in range(num_runs):
        dummy = np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)
        t0 = time.perf_counter()
        model.predict(dummy, imgsz=imgsz, verbose=False)
        t1 = time.perf_counter()
        times.append((t1 - t0) * 1000)  # ms

    avg = sum(times) / len(times)
    p50 = sorted(times)[len(times) // 2]
    p95 = sorted(times)[int(len(times) * 0.95)]
    fps = 1000 / avg

    print(f"    Average: {avg:.1f}ms ({fps:.1f} FPS)")
    print(f"    Median:  {p50:.1f}ms")
    print(f"    P95:     {p95:.1f}ms")

    return {"avg_ms": avg, "fps": fps, "p50_ms": p50, "p95_ms": p95}


def main():
    args = get_args()

    print("=" * 60)
    print("  MODEL EXPORT — STUDENT EMOTION DETECTION")
    print("=" * 60)
    print(f"  Model:     {args.model}")
    print(f"  Format(s): {', '.join(args.format)}")
    print(f"  Image size: {args.imgsz}")
    print(f"  FP16:      {'Yes' if args.half else 'No'}")

    model = YOLO(args.model)

    # Determine formats
    formats = args.format
    if "all" in formats:
        formats = ["onnx", "tensorrt", "openvino"]

    # Export each format
    exported = {}
    for fmt in formats:
        path = export_model(model, fmt, args)
        if path:
            exported[fmt] = path

    # Summary
    print("\n" + "=" * 60)
    print("  EXPORT SUMMARY")
    print("=" * 60)
    for fmt, path in exported.items():
        size_mb = Path(path).stat().st_size / (1024 * 1024) if Path(path).exists() else 0
        print(f"  {fmt:12s}: {path} ({size_mb:.1f} MB)")

    # Benchmark
    if args.benchmark and exported:
        print("\n" + "=" * 60)
        print("  INFERENCE BENCHMARK")
        print("=" * 60)

        # Benchmark original PyTorch
        print(f"\n  --- PyTorch (original) ---")
        pytorch_results = benchmark_model(args.model, args.imgsz, args.benchmark_runs)

        # Benchmark exported formats
        for fmt, path in exported.items():
            print(f"\n  --- {fmt.upper()} ---")
            fmt_results = benchmark_model(path, args.imgsz, args.benchmark_runs)

            speedup = pytorch_results["avg_ms"] / fmt_results["avg_ms"]
            print(f"    Speedup vs PyTorch: {speedup:.2f}x")

    # Usage instructions
    print("\n" + "=" * 60)
    print("  USAGE")
    print("=" * 60)
    if "onnx" in exported:
        print(f"\n  ONNX inference:")
        print(f"    python scripts/live_inference.py --model {exported['onnx']}")
    if "tensorrt" in exported:
        print(f"\n  TensorRT inference (fastest on NVIDIA):")
        print(f"    python scripts/live_inference.py --model {exported['tensorrt']} --half")

    print()


if __name__ == "__main__":
    main()
