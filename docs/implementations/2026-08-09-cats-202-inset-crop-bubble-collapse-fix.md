# Fix InsetCropBubble expand/collapse state across Annotate + Cat Form (#202)

## What shipped

- **Default state**: bubble now mounts collapsed on both screens (was expanded) — `src/components/organisms/InsetCropBubble.tsx`'s `collapsed` state defaults `true`, `slideAnim` starts at `1` to match (no spurious slide-in animation on mount).
- **Annotate dock edge**: `bottom-right` → `top-right`, per `docs/design-decisions/inset-crop-bubble.md`. Renamed `InsetCropEdge`'s `'bottom-right'` to `'top-right'` and `InsetCropBubble.styles.ts`'s `wrapBottomRight` to `wrapTopRight` (`top: 0, right: theme.spacing.md`, dropping the old `bottom: 84` clearance for annotate's bottom bar, no longer relevant).
- **Top-bar overlap**: moving the dock to the top surfaced a second bug — the bubble was a sibling of `topBar` positioned absolute against the screen root, so `top: 0` landed under/over the counter + remove-photo button row. Fixed by re-parenting the `InsetCropBubble` into the `carousel` container in `src/screens/submission/annotate/index.tsx` (RN Views default to `position: relative`, so `top: 0` there already starts below `topBar` — no hardcoded offset needed).
- **Off-screen collapse**: collapse slide used `diameter * 0.62` (`COLLAPSE_SLIDE_FRACTION`, a leftover from #168's earlier spec), which overshoots the right-edge anchor for any diameter above ~110dp and pushes the collapsed bubble off-screen. Replaced with a derived offset, extracted as a pure function per the repo's `panClamp.ts`/`diameter.ts` precedent (worklets/animation values aren't testable in Jest, so the math lives outside them): `src/lib/insetCrop/collapse.ts`'s `computeCollapsedOffset(diameter, collapsedDiameter) = (diameter - collapsedDiameter) / 2`. Verified algebraically against the transform math (`Translate(tx) · Scale(s)` composition, scale-around-center) — lands the collapsed bubble's visual right edge exactly flush at the `right: theme.spacing.md` anchor for any diameter.
- **Header-zone reservation never shrank**: Cat Form's header zone (`src/screens/submission/cats/index.tsx`) tracked only the bubble's reported _expanded_ diameter, never its collapsed state, so `minHeight` stayed at the last-expanded size forever even after the bubble docked down to 68dp. Now tracks a `bubbleCollapsed` mirror too; `minHeight = bubbleCollapsed ? COLLAPSED_DIAMETER : bubbleDiameter`.
- **Signal timing split**: the header-zone fix needed the collapse signal reported _eagerly_ on expand (over-reserving early is safe) but _delayed_ on collapse (must not shrink while the bubble could still overlap the title) — added as `InsetCropBubble`'s `onCollapsedChange`, using a plain `setTimeout` matching the animation's duration rather than gating on `Animated.timing`'s completion callback (decouples the signal from Animated's timing internals, which aren't reliably drivable with fake timers in Jest). Reusing that same eager-on-expand signal for the _title fade_ would have faded the title before the bubble visually slid over it — added a second, symmetric signal, `onSettledChange`, delayed in _both_ directions, wired to the title fade instead.

## Tests

Per `docs/agents/testing.md` — model-based/stateful-flow tests only, no hand-written per-case bloat:

- `src/lib/insetCrop/__tests__/collapse.test.ts` (new): pure function unit tests for `computeCollapsedOffset`, including a regression guard pinning the value against the old (wrong) `diameter * 0.62` formula.
- `src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx` (new): xstate model of the bubble's own tap/collapse/expand flow — mount-collapsed, tap-to-expand, tap-to-collapse, animation-settles — asserting `onCollapsedChange` and `onSettledChange` timing at each state (fake timers, real component, no `InsetCropBubble` mock).
- `src/screens/submission/cats/__tests__/CatObservationScreen.insetCropHeaderZone.test.tsx` (rewritten, was 2 hand-written `it()` cases): xstate model of the header-zone reservation across a full collapse/expand journey (mount collapsed with no diameter reported yet → expand → diameter reported → collapse → re-expand), driving the mocked `InsetCropBubble`'s callback contract directly. Subsumes both prior hand-written cases (default-before-report and reserves-reported-diameter), which are now individual states on this model instead of standalone tests.
- `src/components/organisms/__tests__/InsetCropBubble.diameterDerivation.test.tsx`: existing test, only its `edge` prop value updated (`bottom-right` → `top-right`) — diameter derivation itself is edge-independent.

## Verification

| Criterion                                                                           | Status                                                                                                                             |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Default/initial state is collapsed, both screens                                    | Verified — `collapsed` state defaults `true`, covered by the mount state in `InsetCropBubble.collapseFlow.model.test.tsx`          |
| Annotate: expanded bubble docks top-right                                           | Verified by inspection (edge rename + style) and re-parenting fix; not verified on-device                                          |
| Cat Form: expanded bubble docks top-center                                          | Unchanged from prior implementation, already correct                                                                               |
| Collapsed bubble fully visible, docked at right edge, flat 68dp, both screens       | Verified algebraically (`computeCollapsedOffset` derivation) and via `collapse.test.ts`'s regression guard; not verified on-device |
| Cat Form header-zone reservation shrinks in step with (or no earlier than) collapse | Verified via `CatObservationScreen.insetCropHeaderZone.test.tsx`'s full journey                                                    |

- `npx tsc --noEmit` — clean
- `npx eslint` on all changed files — clean
- `npx jest` — 138/138 passing (full suite, no regressions)
- Issue is labeled `needs-test-drive`; none of the above verified on a physical device/emulator yet.
