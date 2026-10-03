# Theme staleness sweep — issue #320 (punchlist item 1)

Sweep for components stuck on their first-mount theme, per the class
identified fixing #337/AlertHost (`f197051`).

## Root cause

Unistyles 3 patches most `StyleSheet.create`-based styles directly on the
native ShadowTree, with zero React re-render required — confirmed against
the library's own docs (`how-unistyles-works.mdx`, "Shadow Tree updates").
That mechanism does not reach content rendered inside React Native's own
`<Modal>`, which mounts its content on a separate native surface outside the
main tree Unistyles walks. A component that renders only inside `<Modal>`
and never unmounts/remounts on its own therefore needs an explicit
`useUnistyles()` (or `useStyles`) call to force a React re-render when the
theme changes — the same mechanism `DateTimePicker` already used, and the
one added to `AlertHost` in `f197051`.

Regular screens are not in this class: they remount on navigation and their
content sits in the main tree the ShadowTree patch reaches directly.

## How searched

`rg '\bModal\b' src --glob '*.tsx'` — the full set of components rendering
content through RN's `<Modal>`, since that is the specific mechanism that
defeats Unistyles' direct patching. Cross-referenced each hit for a
`useUnistyles`/`useStyles` subscription.

## Result

| Component | Uses `<Modal>` | Subscribes (`useUnistyles`) | Verdict |
| --- | --- | --- | --- |
| `AlertHost` | Yes | Yes (`f197051`) | Fixed — reference case |
| `DateTimePicker` | Yes | Yes (pre-existing) | Safe |
| `TutorialOverlay` | Yes | **No** | **Fixed here** — added `useUnistyles()` |

No other component in `src/` renders through `<Modal>`. This is a complete
list for the identified defect class (Modal-hosted content with no theme
subscription); it is not a claim that every possible staleness bug in the
app is closed, only that the specific class named in the punchlist item has
no remaining instance.

## Change

`src/components/organisms/TutorialOverlay.tsx` — added `useUnistyles()`,
mirroring the `AlertHost` fix. Without it, toggling the theme while the
annotation tutorial is open leaves it in whichever theme was active when it
was last (re)mounted.

## Verification

- `npm test` — 57 suites / 261 tests green.
- `npm run typecheck` — clean.
- Not yet run on a device — same caveat as the rest of this branch. A
  device pass should specifically try: open the tutorial, flip the theme
  (OS appearance if System is selected, or the in-app control), confirm the
  overlay re-colors without closing it.
