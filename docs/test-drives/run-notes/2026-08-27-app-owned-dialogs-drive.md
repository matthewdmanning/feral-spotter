# 2026-08-27 — App-owned dialogs, theme drive (Pixel 7)

**Git state:** `issue-320-ui-styling-pass` @ `09f26bd` at drive start; the one
defect found was fixed mid-drive and committed as `f197051`.
**Working tree:** clean at start and end.
**Device:** Pixel 7 physical, `2A151FDH200HY4`, Android 17. Density 420
physical, 1080×2400, no display-size override this time (the 356 override from
the 2026-08-26 drive was gone).
**OS appearance at start:** Light (`cmd uimode night` = no) — the condition the
un-themed dialogs used to fail under.

Purpose: verify #337, which replaced `Alert.alert` with an app-drawn dialog.
That defect class is invisible to CI by construction, which is the whole reason
this drive exists.

## Status: drive completed, one defect found and fixed

| # | Goal | Result |
| --- | --- | --- |
| 1 | Destructive confirm (Clear Draft), Light | **PASS** |
| 2 | Destructive confirm, Dark | **FAIL**, fixed in `f197051`, re-verified **PASS** |
| 3 | Two-button confirm — Discard Changes, Remove this cat?, Submit Submission | **PASS** |
| 4 | Dialog touch targets vs the 48dp floor | **PASS** |
| 5 | Hardware back on an open dialog | **PASS** |
| 6 | #338 System mode tracks the OS live | **FAIL** — expected, already filed |
| 7 | Single-OK error shape | **NOT TESTED** — see Not covered |
| 8 | Chained dialogs (submit flow raises two) | **NOT TESTED** — see Not covered |

## The defect

**Switching theme at runtime left the dialog's text in the previous theme.**
Light → Dark gave a near-black title and message on the dark card — the same
unreadable result the deleted `ValidationSheet` used to produce, mirrored.

A cold start in Dark rendered correctly, which is what separated "stale styles"
from "bad Dark palette". `AlertHost` mounts once at the app root and never
re-mounts, so nothing ever forced its stylesheet to re-resolve; screens escape
this only because they re-render as you navigate.

The buttons hid it. `AppButton` re-resolves through `styles.useVariants()` on
every render, so Cancel and Clear re-themed correctly while the `Text` nodes
between them did not — the dialog looked half-right, which is worse than
looking broken.

Fix: `useUnistyles()` in `AlertHost`, subscribing it to theme changes. That is
what `DateTimePicker` and the old `ValidationSheet` both did; the new component
simply didn't. Re-verified on device: fresh start in Light, switch to Dark,
dialog renders white-on-dark.

**Worth carrying forward:** any component that renders unistyles styles, calls
no unistyles hook, and does not re-mount on navigation has this bug latent.
`AlertHost` is the app-root case. Relevant to #327 and worth a look during
#329's sweep.

## Passed

- **Clear Draft, Light** — white card, near-black title and body, red Clear.
  This is the dialog that rendered dark-grey-on-Light before #337.
- **Clear Draft, Dark (post-fix)** — white text on the dark card.
- **Discard Changes** and **Remove this cat?** — both render correctly in Dark.
- **Submit Submission** — opened and cancelled; not submitted (see Not covered).
- **Touch targets** — every dialog button measured over the floor:

  | Dialog | Buttons | Size |
  | --- | --- | --- |
  | Clear Draft | Cancel / Clear | 152.4 × 54.9 dp / 149.7 × 54.9 dp |
  | Discard Changes | No / Yes | 152.4 × 54.5 dp / 149.7 × 54.5 dp |

- **Hardware back** — dismisses the dialog, runs the cancel handler, does not
  navigate away from the screen underneath.

## #338 — System mode, one detail to add

Confirmed still broken: with System selected and the app foregrounded, flipping
the OS to dark changed nothing.

The detail the issue does not yet record: **selecting System does re-read the
OS at that moment.** The app was in Dark, tapping System flipped it to Light
immediately (the OS was Light then). So the read happens on selection as well
as at startup — it is specifically the *later*, unsolicited OS change that goes
unobserved.

## Not covered, and why

- **Single-OK error shape** (`showError`, e.g. "Submission Incomplete"). Every
  reachable trigger needed either a sign-out, a denied permission, or a
  submission with zero cats. Untested, not passed.
- **Chained dialogs.** The submit flow raises a second dialog from the first's
  handler. Reaching it needs a real submission — an outward-facing upload — so
  it was left alone. Unit-tested only.
- **"Remove photo from submission?"** on annotate. Not reached.

## Note on the draft

Home showed no resume entry, so this drive treated the draft as empty and used
Upload Photos to reach the submit dialogs. The submit confirm then read
**"Submit 1 cat and 2 photos?"** — a draft did exist, with 1 cat and 1 photo,
and the drive added the second photo.

Nothing was submitted, removed, or cleared; every destructive dialog was
cancelled. The added photo is still in the draft. Two things to chase
separately: removing that photo, and *why Home showed no resume entry for a
draft that had a cat and a photo in it* — that second one may be a real
defect in the resume-entry logic (#314 / #316 territory), not just a
misreading.

## Device state at end

OS night mode restored to `no` (its state at drive start). App theme left on
Dark. Draft intact, plus the one added photo.
