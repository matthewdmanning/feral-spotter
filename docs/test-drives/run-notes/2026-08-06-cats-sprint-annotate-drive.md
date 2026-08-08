# Emulator run — cats/annotate-flow sprint live walkthrough (2026-08-06)

Git state at test time: `f6c9bef1df35923d5ac18889dc70e6973627d114`, branch `sprint/cat-annotate-flow`.

AVD: Pixel_8_APIs. Fresh cold boot this session (prior `emulator-5554` was
wedged offline at handoff time; killed qemu PID and relaunched — see
"Environment notes" below). App data cleared once mid-session (`pm clear`)
to get a clean submission state after an old leftover draft was found.

## Confirmed this run

- **#173 (Cat List auto-skip) — PASS.** Camera → `Done (1)` landed directly
  on `annotate` at `1 / 1`, no empty Cat List render in between. This
  resolves the prior run-note's "not cleanly verified" — driven via the
  real camera capture entry point, not a deep link, as instructed.
- **#170 (Annotate discovers cats via first box) — PASS.** Drew a box via
  swipe gesture (350,700)→(750,1500) on the photo canvas
  (bounds `[0,161][1079,2233]`), tapped Confirm, tapped Boxing Complete.
  Landed on Cat Form titled **"Observed Cat"** (the no-existing-cat /
  `addCat` path) with no explicit "add a cat" step taken first — `cat_id`
  minted silently as designed.
- **#174 inset-crop bubble — first live look, one confirmed bug.**
  - Bubble appears bottom-right on `annotate` after Confirm
    (content-desc `Cropped photo of the cat being described` /
    `Collapse cat photo preview`, resource-id `inset-crop-bubble`).
  - Also appears on Cat Form (top area) for the same cat, as expected.
  - **Bubble diameter confirmed correct/intentional** — bounds measured
    at 726×726px (≈276dp @ 420dpi) initially read by me as oversized
    against the box drawn, but the user visually confirmed via screenshot
    that this size is accurate. Flagged handoff risk #1 (diameter formula)
    is **not** a bug — false alarm on my part, corrected in-session.
  - **Collapse gesture — PASS.** Tapping the bubble toggles content-desc
    `Collapse cat photo preview` ↔ `Expand cat photo preview`; bounds
    slide from `x=323` to `x=773` (screen width 1080), consistent with a
    right-edge collapse animation. Re-tapping restores the expanded state.
  - **Header-zone no-overlap guarantee (handoff risk #2) — CONFIRMED BUG.**
    The bubble visually overlaps the "Observed Cat" title on Cat Form
    (confirmed against the screenshot). The reserved-`minHeight` guarantee
    described in the handoff (reserving space equal to the bubble's
    diameter) is not holding — needs a fix. Bubble bounds on this screen:
    `[312,279][1038,1005]`; title bounds: `[42,279][522,385]` — bubble top
    edge is flush with the title's top edge, no header clearance at all.
    **User's fix direction (given live during this session):** the
    original prototype had the bubble transition to a square picture on
    tap (better than the current circle-collapse) — center it
    horizontally, and fade the "Observed Cat" title out significantly
    where it would otherwise sit under the bubble.
- **Location capture** — `Location acquired` control present (disabled/
  checked state) on Submission Details, consistent with a Live fix having
  resolved. Not independently cross-checked against logcat GPS provider
  lines this run.
- **#171 ("Not in this photo" pill) — PASS.** On a 3-photo pass: pill is
  `enabled=false` on photo 1/3 before any cat exists (no active cat to say
  "not in photo" for — plausibly correct, cross-check against the #171
  implementation note rather than assuming). Once a box was confirmed on
  photo 1 (minting the cat), the pill became `enabled=true` on photo 2/3;
  tapping it advanced the pass to 3/3, same as a confirmed box would.
- **#170 item 6 (Boxing Complete tappable early) — PASS.** `Boxing
Complete` was `enabled=true` at photo 1/3, before any photo in the pass
  had a box or absence marked.
- **#170 multi-cat — PASS.** Ran a second `Add a Cat` pass after saving
  the first cat; Submission Details showed two distinct cat entries
  (`[42,697][1038,843]` and `[42,864][1038,1010]`) rather than one being
  overwritten.
- **#172 (no manual photo-selector) — PASS, deliberately verified.**
  Scrolled the full Cat Form (Age/Sex/Ear Tipped/Owned·Domesticated/
  Pattern/Hair Length/Color/Health + `Put the Cat in a Box`) — no
  photo-selection control anywhere. See field inventory below.
- **New a11y finding — missing label on the remove-photo button.**
  `src/screens/submission/annotate/index.tsx:101-109`: the top-bar
  remove/trash `Pressable` has `accessibilityRole="button"` but no
  `accessibilityLabel`, so it renders as `NAF="true"` with empty
  content-desc (bounds `[944,0][1038,95]`). `ux_principles.md` principle
  5 requires labels on all icon-only buttons. In-scope sprint code
  (annotate top bar), not a pre-existing issue.

## #177 — BLOCKED, not exercised

Could not reach the remove-photo control to test orphaned-box cleanup:

- Long-pressing the main photo canvas does **not** trigger removal — it's
  captured by the box-drawing gesture handler instead (confirmed: a
  long-press swipe there drew and confirmed a box, advancing the pass).
- The actual remove control is a separate unlabeled trash-icon `Pressable`
  in the top bar (`index.tsx:101-109`, bounds `[944,0][1038,95]`,
  `delayLongPress={500}`). Five tap/long-press attempts at this location
  (plain tap and long-press, multiple y-offsets within the reported
  bounds, cross-checked against a screenshot via pixel-edge detection
  which found the button visually at the same coordinates) all failed to
  trigger either the `onPress` alert or `onLongPress` removal.
- One attempt at `y=47` opened the Android notification shade instead of
  hitting the app, suggesting the button's hit area overlaps the real
  OS status-bar strip on this device (`annotate` is a `fullScreenModal`
  with `headerShown` off, edge-to-edge, no visible top safe-area
  handling in `index.styles.ts`'s `topBar`/`topRow`).
- Stopped at the user's instruction after the 5th attempt rather than
  continuing to guess coordinates. **Possible real bug**: the remove
  button may be genuinely unreachable by touch in its current position,
  which would itself block #177's data-cleanup fix from ever running
  on-device — worth a targeted look with real-device testing or a debug
  border/inspector rather than more coordinate guessing.
- #172 partially covered for free by the field dump below even before
  the deliberate check above.

Ran out of session time after the registration/reset detour below ate a
large chunk of the walkthrough; #177 (and confirming the remove-button
reachability issue) remain for a follow-up pass.

## Cat Form field inventory (for #172 cross-check)

Full content-desc list on "Observed Cat" (Cat Form, one cat, one photo):
`Age` (Kitten/Juvenile/Adult/Senior/Unknown), `Sex` (Male/Female/Unknown),
`Ear Tipped` (Yes/No/Unsure), `Color` (Black/White/Orange/Gray/Brown/
Cream/Bicolor/Calico/Tortoiseshell/Mixed/Unknown), `Pattern` (Solid/Tabby/
... /Unknown), `Hair Length` (Short/Long/Unknown), plus `Clear` and the
inset-crop bubble. No photo-picker/library-selection control anywhere in
this list — consistent with #172 shipping correctly, but not a targeted
verification.

## Environment notes (not sprint bugs, but blocked/slowed the run)

- `emulator-5554` was offline at session start (matches handoff's known
  blocker). `adb kill-server`/`start-server`/`reconnect` all failed to
  recover it — root cause was a wedged qemu process, not the adb daemon.
  Fix: `taskkill` the qemu PID and relaunch via
  `emulator -avd Pixel_8_APIs -netdelay none -netspeed full`, then
  `adb reverse tcp:8081 tcp:8081` once back online.
- Metro dev-client reconnect (`exp://localhost:8081` via the dev
  launcher's "New development server" entry) took ~60-90s to first-bundle
  after the cold boot, and a second ~95s on a later reconnect. Both times
  it eventually resolved on its own; no actual hang.
- **Reset button on Submission Details does not clear the submission.**
  Tapped Reset → confirmed "RESET" in the destructive-action dialog →
  Submission Details re-rendered showing the same stale cat, and
  re-entering annotate still showed the old 5-photo pool. Had to
  `pm clear com.mmanning.feralspotter` to get a clean state instead.
  Flagging per user's steer to defer non-sprint bugs — **not one of
  #170-#177, needs its own issue.**
- A leftover in-progress submission (5 photos, 1 "Unknown" cat already
  recorded) was present at session start from a prior test session that
  was never finished/reset. Cold-booting the AVD does not wipe app data
  by itself.
- Registered a throwaway test account to get past sign-in:
  `feralspotter.test.qa@example.com` on the real Firebase project
  backend (not a local-only artifact) — needs cleanup by someone with
  console access.

## Tooling note

`emulator/tap_desc.py` crashes with `UnicodeEncodeError` on content-desc
strings containing non-cp1252 characters (hit this on `"← Back"`,
`←`). Worked around by reading bounds from the dump and using
`adb shell input tap <x> <y>` directly. Worth a one-line fix (stdout
encoding) if this script gets used again on em-dash/arrow-labeled
elements.
