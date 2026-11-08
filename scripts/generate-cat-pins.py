#!/usr/bin/env python3
"""Draw the Reports map's cat-head pin icons.

Writes assets/images/catPins/cat-pin[-N|-many][@2x|@3x].png: a plain pin and
one per badge value (2..9 and "9+"), at 1x/2x/3x. Map markers take a bitmap,
not a React view, so the count badge is baked into the image.

Map tiles are light in both app themes, so one set of pins serves both. Colors
are read from src/shared/config/themes.ts, never hardcoded: the head and face use
lightTheme's accent pair; the ears, badge, and badge text use darkTheme's
pastel selection, highlight, and background, which stand out on light tiles.
The badge cap is MAX_BADGE_COUNT, read from src/features/history/lib/history.ts.

Run from the repo root:  python3 scripts/generate-cat-pins.py
Needs Pillow and an installed node_modules (for the Nunito font).
"""

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images" / "catPins"
FONT = (
    ROOT
    / "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf"
)
THEMES = (ROOT / "src/shared/config/themes.ts").read_text(encoding="utf-8")
HISTORY = (ROOT / "src/features/history/lib/history.ts").read_text(encoding="utf-8")


def token(theme: str, name: str) -> str:
    """The first `name: '#RRGGBB'` after `export const <theme> = {`."""
    start = THEMES.index(f"export const {theme} = {{")
    match = re.compile(rf"\b{name}: '(#[0-9A-Fa-f]{{6}})'").search(THEMES, start)
    if not match:
        raise SystemExit(f"{theme}.colors.{name} not found in themes.ts")
    return match.group(1)


HEAD = token("lightTheme", "accent")
FACE = token("lightTheme", "accentText")
RIM = FACE
NOSE = token("darkTheme", "selection")
BADGE = token("darkTheme", "highlight")
BADGE_TEXT = token("darkTheme", "background")
MAX_BADGE = int(re.search(r"MAX_BADGE_COUNT = (\d+)", HISTORY).group(1))

# Design units (dp at 1x). The pin tip sits at bottom-center: the marker anchor.
W, H = 40, 46
SUPERSAMPLE = 8


def draw_pin(scale: int, badge: str | None) -> Image.Image:
    s = scale * SUPERSAMPLE
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def pts(*xy: float) -> list[tuple[float, float]]:
        return [(xy[i] * s, xy[i + 1] * s) for i in range(0, len(xy), 2)]

    cx, cy, r = 20, 21, 13
    rim = 2

    def silhouette(grow: float, fill: str) -> None:
        # Ears, pointer, then head — one shape, grown outward for the rim.
        d.polygon(pts(7 - grow, 15, 8 - grow, 2 - grow, 19 + grow, 9), fill=fill)
        d.polygon(pts(33 + grow, 15, 32 + grow, 2 - grow, 21 - grow, 9), fill=fill)
        d.polygon(pts(13 - grow, 30, 27 + grow, 30, 20, 44 + grow), fill=fill)
        d.ellipse(
            pts(cx - r - grow, cy - r - grow, cx + r + grow, cy + r + grow),
            fill=fill,
        )

    silhouette(rim, RIM)
    silhouette(0, HEAD)

    # Inner ears.
    d.polygon(pts(10.5, 12, 11, 6, 16, 10), fill=NOSE)
    d.polygon(pts(29.5, 12, 29, 6, 24, 10), fill=NOSE)

    # Face: eyes, nose, muzzle.
    d.ellipse(pts(12.5, 17, 17.5, 23), fill=FACE)
    d.ellipse(pts(22.5, 17, 27.5, 23), fill=FACE)
    d.ellipse(pts(14.3, 18.2, 16.3, 22), fill=HEAD)
    d.ellipse(pts(24.3, 18.2, 26.3, 22), fill=HEAD)
    d.polygon(pts(18, 25, 22, 25, 20, 27.5), fill=NOSE)
    for side in (-1, 1):
        d.line(pts(20 + side * 3, 27, 20 + side * 11, 25.5), fill=FACE, width=s // 2)
        d.line(pts(20 + side * 3, 28.5, 20 + side * 11, 29.5), fill=FACE, width=s // 2)

    if badge:
        bx, by, br = 30, 36, 8
        d.ellipse(pts(bx - br - 1.5, by - br - 1.5, bx + br + 1.5, by + br + 1.5), fill=RIM)
        d.ellipse(pts(bx - br, by - br, bx + br, by + br), fill=BADGE)
        size = 10.5 if len(badge) == 1 else 8
        font = ImageFont.truetype(str(FONT), int(size * s))
        d.text((bx * s, (by + 0.3) * s), badge, font=font, fill=BADGE_TEXT, anchor="mm")

    return img.resize((W * scale, H * scale), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    variants: list[tuple[str, str | None]] = [("cat-pin", None)]
    variants += [(f"cat-pin-{n}", str(n)) for n in range(2, MAX_BADGE + 1)]
    variants += [("cat-pin-many", f"{MAX_BADGE}+")]
    for name, badge in variants:
        for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
            draw_pin(scale, badge).save(OUT / f"{name}{suffix}.png", optimize=True)
    print(f"wrote {len(variants) * 3} files to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
