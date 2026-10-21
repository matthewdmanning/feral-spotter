#!/usr/bin/env python3
"""Export a YOLO detector for the Android live detector.

Writes two files into the native camera module's asset folder:

  detector/detector.tflite  the LiteRT model
  detector/detector.json    the sidecar the Kotlin runner reads

Both files are gitignored. The benchmark weights (yolo26n) are AGPL-3.0, and
this repository is CC BY-NC 4.0, so the weights are not committed. Run this
script on each build machine instead.

Default: the yolo26n benchmark, NMS-free (end-to-end) head, FP32, 640 px.
The Kotlin runner also decodes the raw one-to-many head, so a custom model
exported with --raw-head (or with INT8, which forces it) also works.

Usage:
  pip install "ultralytics[export-litert]>=8.4.83"
  python scripts/detector/export-detector.py
  python scripts/detector/export-detector.py --weights runs/cat/best.pt \
      --targets cat

Tested with ultralytics 8.4.183 on Linux x86_64, Python 3.13.
"""

from __future__ import annotations

import argparse
import json
import shutil
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = (
    REPO_ROOT
    / "modules"
    / "native-identification-camera"
    / "android"
    / "src"
    / "main"
    / "assets"
    / "detector"
)
SIDECAR_VERSION = 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--weights",
        default="yolo26n.pt",
        help="Ultralytics weights. A bare model name is downloaded.",
    )
    parser.add_argument("--imgsz", type=int, default=640, help="Square input size.")
    parser.add_argument(
        "--targets",
        nargs="*",
        default=["cat"],
        help="Class names the app keeps. Empty keeps every class.",
    )
    parser.add_argument(
        "--score-threshold",
        type=float,
        default=0.35,
        help="Minimum score the app draws.",
    )
    parser.add_argument(
        "--quantize",
        choices=["none", "w8a32", "int8"],
        default="none",
        help="none = FP32. int8 needs --data and forces the raw head.",
    )
    parser.add_argument("--data", default=None, help="Calibration dataset YAML for int8.")
    parser.add_argument(
        "--raw-head",
        action="store_true",
        help="Export the one-to-many head. The app then runs NMS.",
    )
    parser.add_argument("--out", type=Path, default=ASSET_DIR, help="Output folder.")
    return parser.parse_args()


def read_embedded_metadata(tflite: Path) -> dict:
    """Ultralytics appends metadata.json to the .tflite as a zip entry."""
    try:
        with zipfile.ZipFile(tflite) as archive:
            return json.loads(archive.read("metadata.json"))
    except (zipfile.BadZipFile, KeyError):
        return {}


def main() -> None:
    args = parse_args()
    import ultralytics
    from ultralytics import YOLO

    # format="litert" (litert-torch, NCHW input) replaced the onnx2tf TFLite
    # path in 8.4.83. Older releases write a different layout and file name.
    major, minor, patch = (int(p) for p in ultralytics.__version__.split(".")[:3])
    if (major, minor, patch) < (8, 4, 83):
        raise SystemExit(f"ultralytics {ultralytics.__version__} is too old; need >= 8.4.83")

    model = YOLO(args.weights)
    names = {int(k): v for k, v in model.names.items()}
    unknown = [t for t in args.targets if t not in names.values()]
    if unknown:
        raise SystemExit(f"Unknown target classes {unknown}. Model classes: {names}")

    export_kwargs = {"format": "litert", "imgsz": args.imgsz}
    # nms=False selects the NMS-free one-to-one head; nms=None keeps the raw head.
    export_kwargs["nms"] = None if args.raw_head else False
    if args.quantize == "w8a32":
        export_kwargs["quantize"] = "w8a32"
    elif args.quantize == "int8":
        if not args.data:
            raise SystemExit("--quantize int8 needs --data for calibration")
        export_kwargs["quantize"] = 8
        export_kwargs["data"] = args.data

    exported = Path(model.export(**export_kwargs))
    metadata = read_embedded_metadata(exported)

    # The head follows from the export arguments: nms=False asks for the
    # end-to-end head, and INT8 always falls back to the raw head. The embedded
    # metadata must agree; a disagreement means the exporter changed.
    end2end = not args.raw_head and args.quantize != "int8"
    if "end2end" in metadata and bool(metadata["end2end"]) != end2end:
        raise SystemExit(
            f"Exported end2end={metadata['end2end']} but the arguments imply {end2end}"
        )

    args.out.mkdir(parents=True, exist_ok=True)
    target_model = args.out / "detector.tflite"
    shutil.copyfile(exported, target_model)

    sidecar = {
        "version": SIDECAR_VERSION,
        "source": Path(args.weights).name,
        "ultralytics": metadata.get("version"),
        "license": metadata.get("license"),
        "imgsz": args.imgsz,
        "end2end": end2end,
        # litert-torch keeps PyTorch's planar layout: input is [1, 3, H, W].
        "inputLayout": "nchw",
        "labels": [names[i] for i in sorted(names)],
        "targets": args.targets,
        "scoreThreshold": args.score_threshold,
        "quantize": args.quantize,
    }
    (args.out / "detector.json").write_text(json.dumps(sidecar, indent=2) + "\n")
    print(f"Wrote {target_model} ({target_model.stat().st_size} bytes)")
    print(f"Wrote {args.out / 'detector.json'}")


if __name__ == "__main__":
    main()
