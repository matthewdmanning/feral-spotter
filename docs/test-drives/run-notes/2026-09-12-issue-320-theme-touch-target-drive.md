# 2026-09-12 — Theme control, live OS toggle, touch-target spot check (Pixel 7)

**Git state:** `issue-320-ui-styling-pass` @ `98b726b` (fontSize tokenization
+ AppButton danger border, both committed this session). Working tree clean
at start and end.
**Device:** Pixel 7 physical, `2A151FDH200HY4`, Android 17. Density 420,
1080×2400. `$is_emulator: false` confirmed via PostHog device properties.
**OS appearance at start:** Dark (`cmd uimode night` = yes). Restored to Dark
at end.

Purpose: close out the on-device verification gap for #322, #323, #325, #338
— all four were code-complete with passing tests but explicitly marked
"unverified on a device" in their implementation notes.

## Status: all four PASS

| Issue | What was checked | Result |
| --- | --- | --- |
| #323 | Theme control offers System/Light/Dark, shows active state | **PASS** — screenshot |
| #323 | Choosing Light persists across a cold start (force-stop + relaunch) | **PASS** — screenshot |
| #323 | Explicit Dark wins over a live OS change to Light | **PASS** — screenshot |
| #323 | No throw across System→Light→System→Dark transitions | **PASS** — no crash, no ANR after Metro was healthy |
| #338 | With System selected, toggling OS dark mode live (app foregrounded, no restart) changes the app's theme | **PASS** — screenshot, was the actual defect |
| #322 | Breakpoints registered, tracer screen (Settings `maxWidth`) renders | **PASS at phone width** — see Not covered |
| #325 | Touch targets ≥48dp, measured with `measure.py` | **PASS** — Settings (10 elements) and camera (4 elements), see tables below |

## #323 / #338 — theme control

Screenshots taken at each step (not committed, local only):

1. **Light, first selection** — white background (`#F9FAFB`-ish), near-black
   text, red `Remove Password`/`Clear Draft`, teal `Save`. Fully legible, no
   contrast issues — this is the render `docs/implementations/2026-08-26-issue-320-theme-mode-and-breakpoints.md`
   flagged as never having been seen.
2. **Cold restart (`adb shell am force-stop` + relaunch via deep link)** —
   Light still selected, no crash. Persistence confirmed.
3. **Tapped System, OS was Dark** — app immediately rendered Dark, matching
   OS. Correct.
4. **`adb shell cmd uimode night no` while app stayed foregrounded on
   Settings, System still selected** — app flipped Light **live, no
   restart, no remount**. This is #338's exact defect and it is fixed.
5. **Tapped Dark, then `adb shell cmd uimode night no`** — app stayed Dark.
   Explicit choice correctly wins over a live OS change.

No crash, no ANR, no stale-theme flash at any transition.

## #325 — touch targets

Settings screen (`density 420, 1dp = 2.625px, floor 48dp`):

```
ok    113.9 x   48.0 dp   Dark
ok    114.7 x   48.0 dp   Light
ok    115.0 x   48.0 dp   System
ok    137.1 x   48.0 dp   FeralSpotter
ok    137.1 x   48.0 dp   Reports
ok    137.1 x   48.0 dp   Settings
ok    345.1 x   48.0 dp   Clear Draft
ok    345.1 x   48.0 dp   Remove Password
ok    184.8 x   51.0 dp   Save
ok    186.7 x   51.0 dp   Discard
```

Camera screen (the file's own implementation note called icon-only controls
the worst offenders — spot-checked for that reason):

```
ok     48.0 x   48.0 dp   A
ok     48.0 x   48.0 dp   Button
ok     51.8 x   52.2 dp   Button
ok     77.7 x   78.1 dp   Button
```

Everything on both screens clears the floor. This is a spot check, not the
full #329 sweep — the 29 size-less Pressables the touch-target implementation
note deferred to #329 are still untested here.

## Not covered, and why

- **#322's tablet-width tracer.** The Settings screen's `maxWidth` at the
  `md` breakpoint (768px) needs a screen ≥768px wide to actually cross the
  breakpoint. This device is 411dp wide — the breakpoint never engages, so
  "renders correctly at tablet width" is still unverified. Needs a tablet or
  a resized AVD, not this device.
- **#322's font-scaling criterion** ("honours the OS accessibility text-size
  setting"). Not actively exercised — no component in the codebase currently
  reads `rt.fontScale` (grepped, zero hits outside the config file's own
  comment), so there is nothing to verify yet. Default RN text scaling with
  system font size was not disproven, just not positively checked against an
  enlarged OS font size.
- **AppButton's `danger` border** (fix landed this session). Zero live call
  sites exist — #315 (Cat Form / Cat List AppButton adoption) hasn't shipped
  yet — so there is no on-screen destructive button to look at. The style
  change is inert until #315 lands.
- **#324, #328, #336, #329** — out of scope for this drive; #324 and #336 are
  explicitly `needs-physical-device` for their own full audits (not just this
  spot check), #328's broader audit is still open per its own GitHub comment,
  and #329 is blocked behind most of the above closing first.

## Device state at end

OS night mode restored to `yes` (Dark, its state at drive start). App theme
left on System. No draft was touched — this drive stayed on Settings and
camera, never opened a submission flow.
