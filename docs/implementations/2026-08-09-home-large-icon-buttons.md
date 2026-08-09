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
