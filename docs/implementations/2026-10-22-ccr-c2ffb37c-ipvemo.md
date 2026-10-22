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
