# Native glass surfaces

**Scope:** feature (UI surfaces)
**Issues/spec:** maintainer request, 2026-10-28: native glass in components, Expo's native glass on iOS, `react-native-liquid-glassmorphism` for the Android look, the theme surface as the fallback instead of CSS glass. [mobile-ux-layout-best-practices.md](../agents/ui-ux/reference/mobile-ux-layout-best-practices.md).
**Date:** 2026-10-28
**Branch/PR:** `ui/component-spacing-alignment`

## Scope

**In scope:**

- [x] `GlassSurface` atom: native glass for cards and sheets.
- [x] Theme `colors.surface` when glass cannot draw. No CSS glass.
- [x] Camera controls and the location-picker sheet: `colors.surface` only.
- [x] Remove the CSS `theme.glass.*` styles.

**Out of scope / not addressed:**

- Native tab bar glass. The Android bar takes solid colours only.
- Buttons. They keep their gradient glass look (`gradients.*`, `depth.*`).

## Intent

**Purpose:** Replace the CSS imitation of glass (translucent fill, hairline, inset highlight) with real backdrop glass, and never show a broken or stale glass.

## Design decisions and reasoning

### Expo glass on iOS, the AGSL library on Android

- **Decision:** iOS uses `GlassView` from `expo-glass-effect` (SDK 58), when `isGlassEffectAPIAvailable()` and `isLiquidGlassAvailable()` are true. Its `colorScheme` follows the app theme mode. Android uses `LiquidGlassView` from `react-native-liquid-glassmorphism`.
- **Reason:** Maintainer decision. `GlassView` is Expo's own wrapper of the system `UIGlassEffect`. It is iOS-only and needs iOS 26; it can crash on iOS 26 betas without the API, so availability is checked first. Android tiers come from the library: API 33+ AGSL refraction, API 31–32 blur, below 31 tint and rim.

### Theme surface fallback, never CSS glass

- **Decision:** `GlassSurface` renders a plain `View` in `theme.colors.surface` with a `colors.border` hairline when:
  - the user asks for less transparency (iOS Reduce Transparency, Android high-contrast text),
  - iOS has no Liquid Glass API (below iOS 26), or
  - the Android glass reports a fatal error, or `BACKDROP_CAPTURE_FAILED`.
- **Reason:** Maintainer decision: fall back to the theme. The library's own opaque mode uses system greys (`#F2F2F7` / `#1C1C1E`) chosen from the system colour scheme, not the app theme mode. `BACKDROP_CAPTURE_FAILED` means the glass freezes on its last frame, so it is replaced.
- Other non-fatal Android codes (`PIPELINE_DEGRADED`, `GLASS_UNAVAILABLE`, `INVALID_SHAPE`) keep the glass. The library already stepped down a tier and still draws.

### Camera controls and the map sheet are solid

- **Decision:** Camera chips use `colors.surface` with a `colors.border` hairline. The location-picker sheet uses `colors.surface`.
- **Reason:** The library captures its backdrop with a software draw. The camera preview and the Google map are native surfaces that refuse it (`BACKDROP_CAPTURE_FAILED`). Glass there would show a stale frame, then switch to the surface. Using the surface from the start removes the flash. Surface plus `colors.text` is a theme contrast pair on any scene.

## What shipped

- `src/components/atoms/GlassSurface.tsx`: `GlassSurface` (`kind: 'card' | 'raised'`) and `useReduceTransparency`. On Android the glass corner radius comes from `style.borderRadius`; the library takes it as a prop.
- `src/config/themes.ts`: `glass.card` and `glass.raised` are now tint colours (the old CSS fill colours). `glass.chip` is removed. The fallback uses the existing `colors.surface`; no new colour.
- `GlassSurface kind="card"`: `ReportCard`, Settings cards, Submission status row and cat cards, `CatForm`, `ConsentChoiceScreen` choice row, `ErrorBoundary`, Reports empty state.
- `GlassSurface kind="raised"`: `AlertHost` and `DateTimePicker` dialogs (`dialogShell.sheet`), `TutorialOverlay`.
- `app.json`: the `react-native-liquid-glassmorphism` config plugin.

## Tests

| Test file                                              | What it verifies                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/atoms/__tests__/GlassSurface.test.tsx` | Android: theme surface for reduced transparency, `BACKDROP_CAPTURE_FAILED` and fatal errors; glass kept for no error and a non-fatal degrade. iOS: theme surface for reduced transparency and a missing Liquid Glass API. Fails if either gate is removed. |

**Not tested:** the native glass render itself. No JavaScript check reads native code.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit/model tests: `npx jest` (88 suites, 404 tests)
- [x] Lint: `npx eslint .` (0 errors; 5 warnings, all present before)
- [x] Formatting: `npx prettier --write` on changed files

**Unverified:**

- No build and no device run (maintainer: no build here). CI builds on the PR.
- The glass look, tint strength and rim on a device, light and dark.
- That `BACKDROP_CAPTURE_FAILED` does not fire for cards over `AmbientBackground`.
- High-contrast text on Android switches cards to the surface, live.
- iOS glass. Builds are Android-only.

## Follow-ups and known limitations

- **AGSL cost in lists:** the library captures the backdrop per view per frame. Many glass cards in the Reports FlashList may drop frames. Profile with `onFrameStats`. If needed, use `LiquidGlassContainer`, or glass on the list frame only.
- **R8** is on by default in SDK 58 release builds. Check keep rules for this library before release.
- `react-native-liquid-glassmorphism` is a small single-maintainer package (MIT). It is pinned at `1.2.1`; review its updates.
