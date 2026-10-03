# Home: large icon primary action buttons (#207)

## What shipped

- `AppButton` gained an opt-in `size="large"` variant (unistyles `size` variant dimension alongside existing `variant`): column layout, `flex: 1`, bigger padding/radius/label size. Existing callers (register, sign-in, intro-flow, BottomButtonColumn) are unaffected — `size` defaults to unset, which resolves to the existing row-button styling.
- Home screen's two entrypoint buttons ("Take a Photo" / "Choose from Library") now use `size="large"` with 48px icons, each filling half of `entrypointArea` via `flex: 1`, so they scale to roughly half the available screen height. Gap between them set to 30px (`entrypointArea.gap`) per the issue's explicit spacing spec — no existing spacing token matches 30 exactly (nearest are 24/32), so used the literal value.
- Removed the now-unused `entrypointGap` style (replaced by the parent's `gap`).

## Tests

No new test file — this is a visual/layout change to existing buttons with no new business logic or state transitions. Existing `HomeScreen.gate.model.test.tsx` and `HomeScreen.photoSourceGate.model.test.tsx` still cover the camera/library disabled-state gating and pass unchanged, confirming the redesign didn't alter behavior.

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint` on changed files — clean
- `npx jest` — 111/111 passing (full suite, no regressions)
- Not verified on a physical device/emulator (no visual QA pass this session).

## 2026-08-15 — extension: circular shape, visible labels

**Purpose:** design brief (no issue filed): the two entrypoint buttons should
be circles, sized off the screen's shorter side with a configurable edge
buffer (default 7.5%), each carrying a visible text label ("Take Photos" /
"Upload Photos", renamed from "Take a Photo" / "Choose from Library").

**Change:**

- Replaces `AppButton`'s `size="large"` variant with `size="circle"` —
  `large` had exactly two consumers (both here), now dead, deleted.
  `circle`'s diameter is a prop (`diameter?: number`), not a style-variant
  constant, since it's screen-dependent — computed by the caller and applied
  as an inline `width`/`height`/`borderRadius` override.
- New `computeEntrypointBuffer`/`computeEntrypointDiameter`
  (`src/lib/home/entrypointDiameter.ts`): `buffer = min(screenWidth,
screenHeight) * ENTRYPOINT_BUFFER_PERCENT`, `diameter = (screenWidth -
2*buffer - theme.spacing.xxl) / 2`, floored at 48dp (Material/HIG
  touch-target minimum). `ENTRYPOINT_BUFFER_PERCENT` (`src/config/constants.ts`,
  default `0.075`) is the only exposed knob; the buffer scales off the
  *shorter* screen side so it stays proportional across orientations (app is
  portrait-locked, so this is currently formula-only, not exercised).
- `entrypointArea` goes row layout (was column); `root`'s fixed
  `paddingHorizontal` moved to a new `bottomArea` wrapper around
  `BottomButtonColumn` only, so the circles' own buffer (computed, not the
  theme's fixed spacing token) controls their inset instead.
- Label sits inside the circle (icon above, text below) — not caption-below
  or icon-only. Not visually verified on device/emulator; Android large
  font-scale settings could get tight at smaller diameters (flagged, not
  fixed).
- Design decision recorded in `agents/ux_decisions.md` under "Home
  entrypoint buttons".

Found via `/ponytail-review` after initial implementation: `entrypointBuffer`
was being computed twice (inline in `HomeScreen` and again inside
`computeEntrypointDiameter`) — extracted `computeEntrypointBuffer` as the
single source, called by both. Also dropped a hand-duplicated
`ENTRYPOINT_GAP_DP` constant (existed only to dodge a test mock's Proxy-theme
arithmetic limitation) in favor of fixing the three `HomeScreen.*.model.test.tsx`
mocks to hold real numeric `spacing`/`radius`/`typography`, and dropped
`AppButton`'s empty `label.variants.size.circle` (no-op vs. falling through
to `default`).
