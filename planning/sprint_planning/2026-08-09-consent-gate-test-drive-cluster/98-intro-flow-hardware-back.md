# #98 — Intro-flow T1 hardware back

[GitHub issue #98](https://github.com/matthewdmanning/feral-spotter/issues/98) · label `ready-for-agent` · common context: [README](README.md)

## Decided (2026-08-09)

Add a confirm-exit prompt on intro-flow T1's hardware back, consistent with
`consent`'s existing Decline→Exit pattern — see `docs/design/2026-07-27-onboarding-registration-consent-fsm.md`
for the FSM this fits into (of the 8 states in that flow, only `consent`
currently intercepts hardware back via `useBackHandler`).

## What's already confirmed (don't re-verify)

Device-tested on Pixel 7: hardware back at T1 currently backgrounds cleanly
to the launcher, process stays alive, no crash, no blank screen, clean
relaunch. Not a bug — the current behavior was one of the two acceptable
outcomes named in the original issue. This ticket is now purely additive UX,
not a bug fix.

## Not yet done

- Locate T1's screen component under the `intro-flow` route (not pinned down
  precisely this session — start from the route folder per
  [domain.md](../../agents/domain.md)'s Onboarding definition).
- Add a `useBackHandler` intercept matching `consent`'s pattern (find that
  screen's implementation as the reference for the confirm-exit prompt UX).
- Model this as a state addition to the onboarding FSM doc if that doc is
  the source of truth for these decisions — check whether it needs updating
  alongside the code, per [documentation.md](../../agents/documentation.md).

## Suggested skills

- `tdd` — this is a small state addition to an existing flow; per
  [testing.md](../../agents/testing.md), extend the existing onboarding
  model rather than writing isolated `it()` cases if one already exists.
