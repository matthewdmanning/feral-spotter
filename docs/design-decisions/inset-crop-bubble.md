---
topic: inset-crop-bubble
status: active
last_reviewed: 2026-08-07
governs:
  - src/components/organisms/InsetCropBubble.tsx
  - src/components/organisms/InsetCropBubble.styles.ts
  - src/screens/submission/cats/index.tsx
  - src/screens/submission/cats/index.styles.ts
  - src/screens/submission/annotate/index.tsx
derives_from: ['#168', '#174', '#186']
supersedes:
  - '#168 (2026-08-06 ratified): circular pill on annotate → rounded square (theme.radius.lg), both annotate and Cat Form'
  - '#168 prototype doc (2026-08-06-issue168-inset-crop.html): collapse shrink-fallback scale(0.4) proportional → flat 68dp constant, both screens'
---

# Inset-crop bubble — current design state

Static per-cat photo crop shown on `annotate` and persisted onto Cat Form. Background/pain-point: #167, #169. Visual/interaction treatment: #168 (original), #186 (this revision).

## Shape

Rounded square, `borderRadius: theme.radius.lg` (12dp fixed corner radius, not `diameter / 2`) — same on both `annotate` and Cat Form. One shared style, no per-screen shape variant.

Supersedes #168's ratified "circular pill" for `annotate`. Reason (2026-08-07, live grilling session): the circle read as visually heavier than intended and gave no clean way to signal the Cat Form title fading beneath it the way a squared-off edge does.

## Expanded position

Unchanged from #168:
- `annotate`: bottom-right, docked against the bottom bar.
- Cat Form: top-center, horizontally centered in the header zone (changed from #168's original top-right in the #186 pass — confirmed correct as-is).

## Collapse behavior

Unified — same component, same behavior on both screens (2026-08-07 decision: explicitly rejected a Cat-Form-only variant in favor of one shared mechanic):

- **Direction**: slides toward the right screen edge, both screens. Implemented as a computed `translateX` — `bottom-right` was already right-anchored (offset 0 at rest); `top-center`'s wrap is now right-anchored too (`InsetCropBubble.styles.ts`'s `wrapTopCenter`), with a `centeringOffset` pulling it visually to screen-center while expanded, animating back to the anchor (then past it) on collapse.
- **Size**: shrinks to a flat **68dp** collapsed diameter (`COLLAPSED_DIAMETER`), regardless of the expanded diameter, both screens. Implemented as a `scale` transform (`COLLAPSED_DIAMETER / diameter`) alongside the `translateX`, not a literal width/height change — keeps the animation native-driver-compatible.
  - Supersedes #168's prototype-documented shrink-fallback of `scale(0.4)` (proportional, 40% of expanded diameter). Explicitly a flat value, not proportional — deliberate deviation from the prototype doc, decided live.
  - `COLLAPSED_DIAMETER = 68` is a separate constant from `DEFAULT_DIAMETER = 68` (pre-report placeholder for a not-yet-confirmed box) — same numeric value, different semantic role, independently tunable.
- **Cat Form title fade**: now collapse-aware (`onCollapsedChange` callback) — fades only while the bubble is actually expanded over the title, un-fades once collapsed and docked at the edge. Not in the original acceptance criteria; added because the fade was previously unconditional and stopped making sense once collapse actually moves the bubble away.

## Header-zone reservation (Cat Form)

Reservation stays pinned to the **expanded** diameter at all times — does **not** shrink to 68dp when collapsed. No-overlap guarantee (#168) takes priority over reclaiming space; a collapsed bubble leaves dead space in the header zone rather than risk the title becoming reachable under it again (this is the #186 regression this whole revision exists to fix).

**Future consideration, not in scope now**: pin the header always to the top of the screen, making overlap with form content structurally impossible regardless of diameter or collapse state. Raised 2026-08-07, deferred to a later release.

## Open follow-ups

- ~~#168 needs a new decision comment~~ — done, [comment posted](https://github.com/matthewdmanning/feral-spotter/issues/168#issuecomment-5219164677) 2026-08-07.
- ~~#186's acceptance criteria need updating~~ — done, body updated 2026-08-07 to cover the unified both-screens collapse behavior.
- ~~Branch needs the right-edge-slide + 68dp-shrink mechanic implemented~~ — done, commit `29c68a0` on `issue-186-inset-crop-header-overlap`. All gates pass (`tsc`, `eslint`, `jest` 29/29, `prettier`).
- **Still outstanding**: not verified live on-device. #186's acceptance criteria explicitly require screenshot/run-note evidence of no overlap before this can be considered complete — implementation is spec-complete, not verification-complete.
