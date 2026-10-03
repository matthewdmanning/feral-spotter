# #225 — "Only this time" convenience warning

[GitHub issue #225](https://github.com/matthewdmanning/feral-spotter/issues/225) · label `enhancement, UI/UX` · milestone MVP · common context: [README](README.md)

## What to build

When the user selects "Only this time" on the location permission dialog,
show a warning that this is a convenience tradeoff: the app will re-prompt
for location access every session, since "Only this time" grants don't
persist across app restarts (standard Android behavior, not a bug).

Split out from [#66](66-location-permission-gate.md) — that ticket covers
gating (Don't-allow, Approximate); this one is purely additive UX with no
gate involved.

## Acceptance criteria

- "Only this time" selection surfaces the warning
- No gate — user proceeds normally after acknowledging
- Copy is informational/reassuring, not alarming — this is expected Android
  behavior

## UX reference

[ux_principles.md](../../references/ux_principles.md) — this is a small
inline warning/toast-style element, not a full modal flow; keep it
consistent with the app's existing warning/notice patterns rather than
introducing a new pattern.

## Suggested skills

- No `tdd` model needed — this is presentational, not stateful-flow logic
  per [testing.md](../../agents/testing.md)'s scope.
