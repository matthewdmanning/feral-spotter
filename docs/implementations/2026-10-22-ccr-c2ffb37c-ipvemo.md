# Cozy UI pass: warm palette, Nunito, layout rhythm

**Scope:** refactor (visual)
**Issues/spec:** user request, 2026-10-22: "tighten up the entire UI", "less like slop", "cozy and less corporate". The user marked `docs/DESIGN.md` as deprecated for this work.
**Date:** 2026-10-22
**Branch/PR:** `ccr-c2ffb37c-ipvemo`

## Scope

**In scope:**

- [x] New warm palette for light and dark themes
- [x] Nunito (rounded sans) as the app typeface
- [x] Type scale with real size hierarchy
- [x] One screen gutter, one card padding, group gaps larger than stack gaps
- [x] Off-grid magic numbers moved onto tokens
- [x] Home: one primary action per group

**Out of scope / not addressed:**

- Camera chrome geometry (shutter 78/62, thumbnail strip), annotate handles and dots. These sizes are tuned to the camera and crop tools.
- The inset crop bubble. Its sizes are fixed by `docs/agents/ui-ux/current-state/inset-crop-bubble.md`.
- Stale content in `docs/DESIGN.md`. The user deprecated it; it was not edited.

## Intent

**Purpose:** The refresh of 2026-10-06 used a neon lime accent on olive black, glossy bevels with an accent glow, one size for every heading, and text two steps above stock. It read as technical and generic. This pass makes the app warm, soft, and consistent.

## Design decisions and reasoning

### Palette

- **Decision:** Generate with material-color-utilities as a Fidelity `DynamicScheme`. Primary is a moss seed, HCT(116, 44, 74). Neutral is warm brown, HCT hue 70, chroma 6. Tertiary (segmented answers) is terracotta, HCT hue 45, chroma 38. The inputs are recorded in the `themes.ts` header.
- **Reason:** Warm cream and cocoa surfaces read as cozy. A moss accent keeps the outdoor feel. It also stays a yellow-green, so it does not collide with the Okabe-Ito cat colors (orange, vermillion, blue, and others) that mark recorded cats.
- **Contrast (token pairs):** dark text on background 14.4:1, muted 10.9:1, label on accent 6.5:1 (5.4:1 on the darkest gradient stop). Light text 16.4:1, muted 8.9:1, label on accent 6.5:1.

### Depth

- **Decision:** Bevel highlight 0.38 → 0.20, shade 0.22 → 0.10. The accent-colored glow in `depth.raised` is removed; shadows are warm brown. Card outlines are 1 dp in the soft border color, not 1.5 dp in the strong outline color.
- **Reason:** Soft, matte faces read as friendly. Heavy rims and glows read as a dashboard.

### Typeface

- **Decision:** Nunito 400/500/600/700/800 from `@expo-google-fonts/nunito`, loaded with `useFonts` in `app/_layout.tsx`. The splash stays up until the fonts settle. A load error falls back to the system font.
- **Reason:** Rounded terminals are the strongest single cozy cue. Runtime loading needs no native rebuild.
- **Rule:** Android cannot synthesize weights for a custom family. Text sets `fontFamily` from `theme.fonts`, never `fontWeight`. Every inline `fontWeight` was replaced.

### Type scale

- **Decision:** Raw scale 14/16/18/20/24/28/34 (was 16/18/20/24/26/34/40). Roles: display 34, title 28, heading 20, body 18, bodySmall 16, label 18, labelSmall 16, caption 14.
- **Reason:** Before, display, title, and heading were all 24 dp; weight alone separated them. Size now carries hierarchy. Body stays one step above stock for outdoor reading.

### Layout rhythm

- **Decision:** New `theme.layout` tokens: `gutter` 20, `cardPadding` 16, `stackGap` 12, `sectionGap` 24. Every screen edge uses `gutter` (was a mix of 16, 20, 24, and 32). Every card uses `cardPadding` (was 16 or 20).
- **Reason:** Screens now line up with each other. Groups sit further apart than items in a group.

### Home hierarchy

- **Decision:** Take Photos stays the filled `primary` circle; Upload Photos becomes `secondary`. Continue Observation stays `primary`; New Sighting becomes `secondary`.
- **Reason:** Two equal primaries compete. One primary per group tells the user where to start.

## What shipped

- `src/config/themes.ts`: palette, gradients, depth, `fonts`, type scale, text roles, `layout`.
- `src/app/_layout.tsx`: font loading and splash hold; header title uses Nunito.
- `src/screens/home/index.tsx`: variants above; header title font; column spacing from tokens.
- 19 `*.styles.ts` files: gutter, card padding, group gap, grid values, `fontFamily` overrides.
- `__mocks__/react-native-unistyles.js`: token numbers brought in line with `themes.ts` (radius and typography were stale before this change).
- `package.json`: `@expo-google-fonts/nunito`.

## Tests

**Not tested:** No new tests. The change is visual. The existing suites cover layout arithmetic that reads tokens through the mock.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit` — one error, in `node_modules/phosphor-react-native`. It is also present on the base commit.
- [x] Unit/model tests: `npx jest` — 76 suites, 352 tests pass.
- [x] Lint: `npx expo lint` on the changed files in `src/` — 0 errors.
- [x] Formatting: `npx prettier --write` on the changed files.

**Unverified:**

- No emulator or device render. Contrast figures are token-pair checks only.
- Font loading on a device, and the splash hold.
- Header and row layouts with the larger title (28 dp) at large OS text sizes.
- The secondary circle's label contrast on the rendered gradient.

## Follow-ups and known limitations

- [ ] Drive the app on an emulator in light and dark mode and check each screen.
- `docs/DESIGN.md` still describes the old palette and scale. The user deprecated it.

## Implementation updates

### 2026-10-22 — extension

**Purpose:** User request: "a more polished look by using a liquid glass, gradient look." Branch `liquid-glass-ui`, off `ccr-c2ffb37c-ipvemo`.
**Change:**

- New `AmbientBackground` atom paints `gradients.ambient` (radial pools of moss, terracotta, and honey light). It is the first child of every screen root except Camera, Annotate, and Location Picker, which show photos or a map.
- New `glass` surface tokens (`card`, `raised`, `chip`) replace solid surface + elevation + outline on cards, dialogs, the tutorial card, the location sheet, and camera controls. They use `boxShadow`, not Android `elevation`, which draws through a translucent fill. The unused `outlined` and `elevation.card` tokens are removed.
- Buttons: a smooth glass sheen replaces the bevel, and gradients run at 135°. Secondary is now clear sage glass with the plain text color. The circle size no longer adds `elevation.raised`.
- No backdrop blur. Real blur needs a native module (`expo-blur`) and a rebuild. The ambient pools are smooth, so a translucent fill reads as glass without blur.
- Verified: `npx tsc --noEmit` (only the known phosphor error), `npx jest` (352 pass), `npx expo lint` on changed `src/` files (0 errors). Not verified: no render on a device. Radial gradient and translucent `boxShadow` rendering on Android is unchecked.

### 2026-10-22 — refactor

**Purpose:** User request: a pass over the whole UI for hand-rolled components, duplicated code, and business logic in component bodies. Branch `liquid-glass-ui`.
**Change:**

- **New shared components.**
  - `atoms/TextButton` replaces six hand-rolled text links: Tutorial Skip, Consent Decline, Cat Form Clear, the intro data-agreement link, sign-in "Create one", and the settings link rows.
  - `atoms/TextField` replaces five hand-styled inputs (register, sign-in, settings).
  - `molecules/ToggleRow` replaces two copies of the switch row in Settings.
  - `molecules/GateScreen` replaces the camera gate and the consent "Permission Blocked" gate. Each screen had its own copy of the same styles.
  - `molecules/DisclosureText` replaces the same disclosure rendering in Consent and the Data Usage Agreement.
- **Hand-rolled buttons now use AppButton.** These are the annotate Confirm button and the date/time step toggle in DateTimePicker.
- **Duplicates removed.**
  - `confirmExitApp` is the one copy of the exit dialog that Consent and the intro flow both had.
  - `LABEL_COLOR_KEY` gives AppButton's label and its spinner one color source.
  - The four carousel handle blocks are now one mapped list.
  - The two Home circle blocks are now one `EntrypointCircle`.
  - The "Take/Select More Photos" label is defined once.
  - The carousel's contain-fit math now calls `cropProjection.containFit`.
  - Magic numbers became tokens or named constants: the strip spacing (now uses `THUMB_GAP`), the column spacing, and the tab pill padding.
- **Logic moved out of component bodies.**
  - `useEntryGate` and `useResumableDraft` take Home's two effects. The pure rule is `isResumableDraft`.
  - `useConsentPermissions` takes Consent's permission flow.
  - `validateRegistration` takes the register checks.
  - `draftWarnings` and `useDraftSync` take the create screen's warning rules and its two background effects.
  - `previousCatBoxes` and `bubbleImageRect` take the annotate overlay and crop math.
  - `useAnnotationTutorial` takes the tutorial's analytics handlers.
  - `visiblePhotoToggles` and `PHOTO_TOGGLES` (in `config/`) take the settings toggle list and its build filter.
  - The submission header button is hoisted out of the layout's render.
- **Tests.** `src/utils/__tests__/validateRegistration.test.ts` checks the order and the length floor; no screen test covers them. `src/config/__tests__/photoToggles.invariant.test.ts` reads the real toggle list, so a dev-only toggle cannot reach a release build. The existing screen tests cover the other moves unchanged.
- **Visual effects.** Every text link is now 16 dp bold and at least 48 dp tall. Inputs share one style: the warm alt surface with a 1 dp border.
- **Verified:** `npx tsc --noEmit` (only the known phosphor error), `npx jest` (78 suites, 360 tests pass), `npx expo lint` on changed files (0 errors; 1 warning in TutorialOverlay, from before this change). **Not verified:** no device render.
- **Found, not changed:** On Home, "New Sighting" and "Continue Observation" both open `/submission/create`, and New Sighting does not clear the draft. Sign-in keeps its auth calls in the screen. The create screen keeps its auto-skip redirect, which depends on render timing.
