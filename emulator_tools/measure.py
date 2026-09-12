"""Measure on-screen touch targets in dp, and flag anything under 48dp.

    sh drive.sh                     # refresh window_dump.xml first
    PYTHONIOENCODING=utf-8 python measure.py

Reads the window_dump.xml that drive.sh/tapd.sh already pull, so run one of
those first — measuring a stale dump measures the previous screen.

Density is read live from `adb shell wm density`, not assumed: the override
(Settings > Display size) changes px-per-dp, and hardcoding it silently skews
every number. PYTHONIOENCODING=utf-8 for the same reason drive.sh needs it —
labels contain characters cp1252 cannot encode.

Two traps, both of which produced false results before they were understood:

1. uiautomator clips node bounds to the VISIBLE region. A control that is
   half-scrolled measures short, and one scrolled off-screen can measure
   negative. "Put the Cat in a Box" read 39.1dp when clipped and 57.5dp once
   scrolled fully into view. Scroll the target fully on screen before
   believing its number.

2. Bounds do NOT include hitSlop. A control can measure under 48dp and still
   be fine — "Clear" on the Cat Form measures 66.5 x 37.8dp but carries
   hitSlop={12}, so its real target is about 90 x 62dp. Check the source
   before filing a FAIL.
"""

import re
import subprocess

FLOOR_DP = 48


def device_density() -> int:
    """px-per-160dp, preferring the user's override over the physical value."""
    out = subprocess.run(
        ['adb', 'shell', 'wm', 'density'], capture_output=True, text=True
    ).stdout
    values = [int(l.split(':')[1]) for l in out.strip().splitlines() if ':' in l]
    return values[-1]


def attr(node: str, name: str) -> str:
    m = re.search(rf'{name}="([^"]*)"', node)
    return m.group(1) if m else ''


def main() -> None:
    density = device_density()
    dpr = density / 160.0
    print(f'(density {density}, 1dp = {dpr:.3f}px, floor {FLOOR_DP}dp)')

    dump = open('window_dump.xml', encoding='utf-8').read()
    rows = []
    for m in re.finditer(r'<node[^>]*?>', dump):
        node = m.group(0)
        if 'clickable="true"' not in node:
            continue
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        if not bounds:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        w, h = (x2 - x1) / dpr, (y2 - y1) / dpr
        label = (
            attr(node, 'content-desc')
            or attr(node, 'text')
            or attr(node, 'class').split('.')[-1]
        )
        rows.append((min(w, h), w, h, label))

    for smallest, w, h, label in sorted(rows):
        flag = 'FAIL' if smallest < FLOOR_DP else 'ok  '
        print(f'{flag} {w:6.1f} x {h:6.1f} dp   {label[:48]}')


if __name__ == '__main__':
    main()
