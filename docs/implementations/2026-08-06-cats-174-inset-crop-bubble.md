# Sprint:cats — #174 Inset crop real component (2026-08-06)

Implements #174, blocked by #172 (merged) and #168 (closed, design
decided). Branch `issue-174-inset-crop-bubble`, forked from
`sprint/cat-annotate-flow`. Code complete.

## What shipped

`src/lib/insetCrop/diameter.ts` (new): pure `computeBubbleDiameter(boxWidth,
boxHeight)` extracting the #168-decided formula, `(diagonal + short side) /
1.6`. Matches #172's implementation note's own flagged gap: "would need a
plain unit test if this stops being a 'plain, undesigned' placeholder."

`src/components/organisms/CatFormInsetCrop.{tsx,styles.ts}` renamed to
`InsetCropBubble.{tsx,styles.ts}` (`git mv`, history preserved) — the
component now serves both `annotate` and Cat Form, so the old name no
longer fit. Rewritten:

- Reuses #172's box-lookup (`useBoundingBoxStore.getFirstBox`) and
  crop-centering math (cover-fit, computed once `Image.onLoad` reports
  natural pixel dimensions) unchanged.
- Container is now a circle (`borderRadius: diameter / 2`) sized by
  `computeBubbleDiameter`, not a fixed 88px square.
- New `edge: 'top-right' | 'bottom-right'` prop selects anchor/collapse
  direction; both slide the same way (toward the right edge) since both
  placements dock on the right.
- Collapse: `Pressable` toggles `collapsed` state; an `Animated.Value`
  drives `translateX(diameter * 0.62)` on toggle (slide, the #168-decided
  primary mechanic — shrink fallback not implemented, since slide didn't
  prove impractical).
- New optional `onDiameterChange` callback, fired from a `useEffect`
  whenever the live diameter changes and a box exists — lets a host
  layout reserve space for the bubble without either component needing
  to know the other's internals.
- Returns `null` until a box is confirmed for the cat (story 2) — same
  gate #172 already had, now doubling as `annotate`'s "hidden until first
  box" requirement for free.

`src/screens/submission/annotate/index.tsx`: renders
`<InsetCropBubble catId={activeCatId} edge="bottom-right" />` gated on
`activeCatId`, positioned bottom-right clear of the bottom bar
(`InsetCropBubble.styles.ts`'s `wrapBottomRight`, `zIndex: 3` to paint
above `bottomBar`'s `zIndex: 2`).

`src/screens/submission/cats/index.tsx` + `index.styles.ts`: the bubble
moved out of `CatForm.tsx` into this screen's header row, since the
title ("Observed Cat"/"Edit Cat") it needs to sit over lives here, not
inside `CatForm`. New `headerZone` wrapper (`position: relative`)
wraps the existing `header` row; its `minHeight` is set to
`bubbleDiameter`, local state fed by `InsetCropBubble`'s
`onDiameterChange` — this is the no-field-overlap guarantee: the header
row's reserved height can never be less than the bubble's own diameter,
so the bubble is structurally confined to the title row regardless of
how large it computes. `CatForm`'s `catId` prop dropped entirely (its
only use was rendering the old placeholder) — `CatForm` no longer needs
to know which cat it's for.

`src/components/organisms/CatForm.tsx`: `CatFormInsetCrop` import and
render removed; `catId` prop removed from `CatFormProps`.

## Units deviation from the spec — flagged on #174

#174's spec says the diameter formula's `boxWidth`/`boxHeight` inputs are
"the confirmed box's natural-image pixel dimensions." Implemented
literally, that produces unusable diameters: a modest 25%x20% box on a
real 4032x3024 camera photo is ~1008x605px, giving `diameter ≈ 940dp` —
multiple screen-widths wide. It's also inconsistent with the same
ticket's own out-of-scope note about boxes computing _below_ the
44-48dp touch-target minimum, which only makes sense if the inputs are
already display-scale (a natural-pixel box would need to be a sliver of
the image to ever get near 48).

The #168 prototype's own mock inputs (40x30 / 96x74 / 170x132) rendered
against a 267px-wide mock device frame are the real signal: those are
display-scale numbers, not camera-resolution ones. Implemented the
formula using the device window's dp dimensions
(`Dimensions.get('window')`) as the reference instead of the photo's
natural pixel dimensions — `boxWidthDp = (upperRightX - lowerLeftX) *
window.width`, **and `boxHeightDp = (lowerLeftY - upperRightY) *
window.width`** (width for both axes, not width for one and height for
the other). An earlier draft scaled the height axis by `window.height`;
advisor review caught that this is anisotropic — the box's aspect ratio
gets stretched by ~2.2x (window.height/window.width on a typical phone)
before it reaches a formula that's sensitive to that ratio (min-side +
diagonal), so a square-fraction box no longer produced a
proportionally-sized bubble. Using `window.width` for both axes keeps
the derivation isotropic, reproduces the prototype's proportions, and
keeps the diameter identical regardless of which screen (`annotate` or
Cat Form) renders the bubble, satisfying story 10 (identity persists
across the navigation). Posted as a comment on #174 rather than silently
matching the literal spec text.

## Testing Decisions followed

Per #174's own testing decisions (no new XState model — this is
component-level, not a flow):

- `src/lib/insetCrop/__tests__/diameter.test.ts`: pure-function tests for
  `computeBubbleDiameter` — matches the #168 prototype's own readouts for
  its three mock box sizes (small/medium/large), scale-proportionality
  (story 8), width/height symmetry, and the zero-area degenerate case.
- `src/screens/submission/cats/__tests__/CatObservationScreen.insetCropHeaderZone.test.tsx`:
  rendered-layout assertion (not a snapshot) — mocks `InsetCropBubble` to
  report a fixed diameter via `onDiameterChange`, renders the real
  `CatObservationScreen`, and asserts the header zone's `minHeight`
  equals that diameter exactly via `StyleSheet.flatten`. A second case
  asserts `minHeight` still equals the bubble's own `DEFAULT_DIAMETER`
  (not 0) for the frame before `onDiameterChange` has fired the first
  time — advisor review caught that the guarantee had a hole there:
  `bubbleDiameter` state started at `0`, so an absolutely-positioned
  bubble with a nonzero default size could overhang the header for one
  frame. Fixed by initializing that state to `InsetCropBubble`'s own
  exported `DEFAULT_DIAMETER` instead of `0`.
- `src/components/organisms/__tests__/InsetCropBubble.diameterDerivation.test.tsx`
  (new, added after the anisotropic-scaling bug above was caught): pins
  the normalized-box-to-dp derivation itself, not just the pure formula —
  renders the real component with a mocked box/photo, reads the rendered
  bubble's width, and asserts it matches an isotropic (both axes scaled
  by the same window dimension) expectation while explicitly asserting
  it does _not_ match the anisotropic value the earlier draft would have
  produced. The formula-only test above wouldn't have caught this class
  of bug since it never exercises the box-to-dp conversion.
- No new test for `annotate`'s bubble placement or the collapse
  animation — consistent with this screen's existing zero test coverage
  (same gap #171's implementation note already flagged) and with #174's
  explicit "component-level" testing scope.

## Not addressed (per #174's Out of Scope)

- No px clamping for boxes that compute below the 44-48dp touch target —
  left as an open question, not silently clamped, per the ticket's
  explicit instruction to raise rather than resolve it.
- Shrink collapse fallback not implemented — slide (the primary
  mechanic) didn't prove impractical, so the fallback wasn't needed.
- #170's Cat List auto-skip, #177's box-sweep, and "Not in this photo"
  semantics were not re-verified — out of scope per the ticket text.

## Design decisions from advisor review

Before this note's final form, advisor review of the load-bearing code
and tests caught three real issues, all fixed:

1. **Anisotropic box-to-dp scaling** (units deviation section above) —
   the height axis was scaled by `window.height` instead of
   `window.width`, distorting box aspect ratio before the diameter
   formula. Fixed; regression-tested by
   `InsetCropBubble.diameterDerivation.test.tsx`.
2. **`onDiameterChange` effect had a lying deps array** — `[diameter,
!!box, !!photo]` with an `eslint-disable` masking that `!!box`/`!!photo`
   are expressions, not tracked values. Simplified to `[diameter, box,
photo, onDiameterChange]` (all stable references between renders) and
   the disable comment removed.
3. **Header-zone pre-report gap** (testing section above) —
   `bubbleDiameter` state started at `0`. Fixed by initializing to
   `DEFAULT_DIAMETER`, now exported from `InsetCropBubble.tsx`.

## Verification status

Gates run and passing (after the advisor-review fixes above): full
`jest` suite (29 suites / 106 tests, up from 27/98 baseline), `tsc
--noEmit` (0 errors), `eslint` on all touched/created files (0 errors —
the `react-hooks/refs` rule initially flagged reading
`useRef(...).current` during render for the `Animated.Value`; fixed by
holding it in `useState(() => new Animated.Value(0))` instead),
`prettier --write` (7 files needed reformatting, all clean after).

**Not run on-device.** The bubble's real size/position/collapse
interaction has never been visually verified against a real photo/box —
same unverified-on-device gap already flagged for #170-#172.

## 2026-08-07 — fix (#186)

**Purpose:** the on-device pass that finally exercised this component
(`emulator/run-notes/2026-08-06-cats-sprint-annotate-drive.md`) found the
no-field-overlap guarantee above doesn't actually prevent visual overlap:
`headerZone`'s `minHeight` reserves total height, but the title row and
the bubble are both anchored at `top: 0` inside it, so a bubble wider
than the title row's own natural height paints directly over the title
instead of using the reserved space below. Confirmed bug, not the
diameter formula (that was independently re-verified correct against a
screenshot this same run).

**Change:** per Matthew's live direction, stopped trying to dodge the
overlap positionally and instead accepted it, styling around it:

- `InsetCropBubble`: circular bubble (`borderRadius: diameter / 2`)
  replaced with a fixed rounded square (`theme.radius.lg`) — Matthew's
  call ("use a rounded square throughout"), not a tap-triggered
  shape-morph.
- Cat Form's bubble anchor changed from `top-right` to a new `top-center`
  edge (horizontally centered, `InsetCropEdge` updated to
  `'top-center' | 'bottom-right'`; `top-right`/`wrapTopRight` removed,
  no longer used anywhere). `annotate`'s `bottom-right` placement is
  unchanged — it wasn't part of this bug.
- Collapse slide direction is now edge-aware: `bottom-right` keeps #168's
  decided horizontal edge-ward slide; `top-center` has no side edge to
  slide toward, so it collapses upward (`translateY`) instead.
- Cat Form's title (`"Observed Cat"`/`"Edit Cat"`) fades to `opacity:
0.15` whenever a bubble is showing (`catId` truthy) — accepts that the
  centered bubble can be wider than the header row and sits over the
  title, rather than pretending `minHeight` alone prevents it.

No changes to the diameter formula, the header-zone `minHeight`
reservation itself (still tracks the live diameter, still guards the
pre-report frame), or the crop-centering math — this was a
positioning/styling fix, not a sizing one. Existing tests (diameter
derivation, header-zone `minHeight`) still pass unchanged; no new
automated coverage added for the shape/centering/fade change itself
(visual, not logic — matches this component's existing "component-level
only" testing scope).

**Verification status:** `tsc --noEmit`, `eslint`, full `jest` (29/29
suites) all pass. **Not yet re-verified live on-device** — the emulator
session that would confirm the fix visually was paused mid-boot (host
battery). Live check remains outstanding on #186.

## 2026-08-07 — collapse unification (#186 continued)

**Purpose:** the previous entry's `top-center` collapse (`translateY`,
upward) was itself a design mistake, caught in a live grilling session
before implementation went further — Matthew's ruling: collapse should
be identical on both screens (same component, same behavior), docking
toward the right screen edge like `bottom-right` already does, not a
per-edge-shape special case. Separately, the collapsed state was flagged
as visually too large on Cat Form — collapse only ever translated
position, never resized.

**Change:**

- `InsetCropBubble.styles.ts`'s `wrapTopCenter`: right-anchored (`top: 0,
right: theme.spacing.md`), same positioning strategy as `wrapBottomRight`
  — no longer flex-centered (`alignItems: 'center'` / `left: 0` removed).
  "Centered while expanded" is now a computed `translateX`, not a layout
  property.
- New `COLLAPSED_DIAMETER = 68` constant — a flat, non-proportional
  collapsed size (Matthew's explicit call, deviating from #168's
  prototype-documented `scale(0.4)` shrink-fallback). Same numeric value
  as `DEFAULT_DIAMETER` but a separate constant — different semantic role
  (pre-report placeholder vs. collapsed-state target), independently
  tunable.
- Collapse transform is now `[translateX, scale]` on both edges: `scale`
  interpolates `1 → COLLAPSED_DIAMETER / diameter` (native-driver
  compatible, unlike animating literal `width`/`height`). `translateX`
  interpolates `centeringOffset → diameter * COLLAPSE_SLIDE_FRACTION` —
  `centeringOffset` is `0` for `bottom-right` (already anchored at rest)
  and a computed leftward pull for `top-center` (anchor-to-screen-center
  distance), so both converge on the same collapsed-state math (#168's
  decided `translateX(62%)`-of-diameter slide past the anchor).
- New optional `onCollapsedChange` callback (mirrors `onDiameterChange`'s
  pattern) — lets Cat Form react to collapse state without either
  component knowing the other's internals.
- Cat Form's title fade is now collapse-aware: `catId && !bubbleCollapsed
? styles.titleFaded : null`, instead of fading unconditionally whenever
  a bubble exists. Once the bubble docks at the edge, it no longer covers
  the title, so there's no reason to keep it faded.

No change to the diameter formula, header-zone `minHeight` reservation
(still fed the raw/expanded `diameter`, never the collapsed value — the
reservation intentionally does not shrink on collapse, Matthew's call:
the no-overlap guarantee outranks reclaiming space), or crop-centering
math.

**Verification status:** `tsc --noEmit` (0 errors), `eslint` on all
touched files (0 errors), full `jest` (29/29 suites, 106/106 tests,
unchanged from the previous entry's baseline — no new coverage added,
consistent with this component's existing component-level-only,
visual-change-untested scope), `prettier --check` (clean). **Not
verified live on-device** — same outstanding gap as the previous entry.
