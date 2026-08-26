"""
push_no_exif_fixture.py — #224 (Library Pick Manual-time fallback)

Generates a JPEG with no EXIF DateTime, pushes it onto the connected
device's shared Pictures folder, and triggers a media-store rescan so it
shows up in the system Photo Picker / "Choose from Library". Manual steps
after this script: open the app, Home -> "Choose from Library", pick the
pushed fixture, confirm the date-time-picker modal appears, fill it in,
submit, then check the submission cache (`databases/RKStorage`,
`catalystLocalStorage`, key `submission_cache_<uuid>`) for
`metadata.time_type: "manual"` and the entered `metadata.manual_time`.

Usage:
    python emulator_tools/push_no_exif_fixture.py
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image

DEVICE_DIR = "/sdcard/Pictures/FeralSpotterTest"
DEVICE_PATH = f"{DEVICE_DIR}/no_exif_fixture.jpg"
LOCAL_PATH = Path(__file__).parent / "no_exif_fixture.jpg"


def run(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FAILED: {' '.join(args)}\n{result.stderr}")
        sys.exit(1)
    return result.stdout


def main() -> None:
    devices = run("adb", "devices").strip().splitlines()[1:]
    if not any(line.strip().endswith("device") for line in devices):
        print("No adb device attached. Connect the test device first.")
        sys.exit(1)

    # exif=b"" forces Pillow to write the JPEG with no EXIF segment at all —
    # no DateTimeOriginal/DateTime tag for expo-image-picker to read.
    img = Image.new("RGB", (800, 600), color=(80, 140, 200))
    img.save(LOCAL_PATH, exif=b"")

    check = Image.open(LOCAL_PATH)
    if dict(check.getexif()):
        print("Fixture unexpectedly has EXIF data, aborting.")
        sys.exit(1)
    print(f"Generated EXIF-free fixture: {LOCAL_PATH}")

    run("adb", "shell", "mkdir", "-p", DEVICE_DIR)
    run("adb", "push", str(LOCAL_PATH), DEVICE_PATH)
    print(f"Pushed to {DEVICE_PATH}")

    run(
        "adb", "shell", "am", "broadcast",
        "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d", f"file://{DEVICE_PATH}",
    )
    print("Triggered media-store rescan.")
    print(
        "\nNext: open the app -> Home -> \"Choose from Library\" -> pick "
        "the fixture (likely named \"no_exif_fixture\" or newest photo in "
        "the picker) -> confirm the date-time-picker modal appears -> fill "
        "it in -> submit -> inspect the submission cache for "
        "metadata.time_type == 'manual' and metadata.manual_time set to "
        "what was entered."
    )


if __name__ == "__main__":
    main()
