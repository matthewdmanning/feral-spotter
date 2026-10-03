# #157 — Resume Submission button prominence

[GitHub issue #157](https://github.com/matthewdmanning/feral-spotter/issues/157) · label `ready-for-human` · common context: [README](../README.md)

## Status: needs a UX decision, not more verification

Device-tested on Pixel 7, 2026-08-09. The open factual questions from the
2026-08-07 grilling session are now answered — **don't re-test these:**

- Trigger reliability: confirmed working. "Resume Submission" appears
  correctly on Home whenever `getAllSubmissionCaches()` returns an
  in-progress cache (`src/screens/home/index.tsx`, `BottomButtonColumn`).
- Existence and on-screen position: confirmed present, on-screen without
  scrolling (screen is 1080×2400).

## What's actually wrong (the decision to make)

Button vertical order on Home, top to bottom:

1. "Take a Photo" (y 695–773)
2. "Choose from Library" (y 1542–1620)
3. "Resume Submission" (y 1937–2007)
4. "New Sighting" (y 2098–2168)

For a user with in-progress work, the two most prominent actions on the
screen are still "start new" — "Resume Submission" is 3rd, after both
fresh-capture entry points, not emphasized ahead of them. Not evaluated:
color/visual weight (would need a screenshot; not taken this session,
purely structural/positional evidence).

## Decision needed

Per [ux_principles.md](../../../references/ux_principles.md) principle 2
(visual hierarchy) and principle 1 (thumb-friendly, primary actions in the
bottom third) — is the current bottom-third position actually fine once
visual weight is accounted for, or does an in-progress submission need to
outrank "start new" in the _order_, not just be present? This needs a human
call before implementation, not more device time.

## Suggested skills

- None until the design decision lands — this is a `ready-for-human` ticket,
  not implementation-ready.
