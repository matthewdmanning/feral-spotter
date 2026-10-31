# Native tabs with Phosphor drawables

**Scope:** feature (navigation UI)
**Issues/spec:** maintainer request, 2026-10-28: replace the JS tab bar with native tabs; use the fastest Phosphor icon workaround. [Expo Router native tabs](https://docs.expo.dev/router/advanced/native-tabs/).
**Date:** 2026-10-28
**Branch/PR:** `ui/component-spacing-alignment`

## Scope

**In scope:**

- [x] `(home-tabs)` uses `NativeTabs` from `expo-router/native-tabs` (SDK 58 path).
- [x] Phosphor tab icons on Android as vector drawables, made at prebuild.
- [x] Theme colours, Nunito labels and the selection haptic on the native bar.

**Out of scope / not addressed:**

- A gradient or glass Android tab bar. The Material bar takes solid colours only.
- Tab badges.

## Intent

**Purpose:** The platform draws the tab bar: Material bottom navigation on Android (active indicator, ripple, animation, TalkBack) and the system glass bar on iOS 26. This removes the hand-sized JS bar.

## Design decisions and reasoning

### Icons: Android drawables from the official Phosphor SVGs

- **Decision:** `plugins/withPhosphorTabDrawables.js` writes one vector drawable per tab and state into `res/drawable` at prebuild: regular weight idle, fill weight selected. `Trigger.Icon` names them with `drawable={{ default, selected }}`. iOS uses SF Symbols (`sf`).
- **Reason:** Android priority is `drawable` > `md` > `src`. A drawable loads from app resources with no image decode and no JS rendering. `md` is Material Symbols only, not Phosphor. `src` with `VectorIcon` needs an icon font; Phosphor ships none for React Native.
- **Source:** `@phosphor-icons/core` (dev dependency, pinned `2.1.1`), the official SVGs that `phosphor-react-native` is built from. The plugin fails the prebuild if an SVG holds anything but `<path>`, or a viewBox other than `0 0 256 256`, so an icon is never partly dropped.
- `src/config/tabIcons.json` is the one list of tab icons. The plugin and the layout both read it, so drawable names cannot drift.

### Theme on the native bar

- **Decision:** `backgroundColor` surface; `indicatorColor` accentSoft; `rippleColor` secondary; icon muted, selected accentSoftText; label Nunito semibold at caption size, muted, selected text; `labelVisibilityMode="labeled"` (three tabs).
- **Reason:** The theme pairs accentSoft with accentSoftText, so the selected icon reads on the indicator.
- The selection haptic moved from the JS button's press-in to `screenListeners.tabPress`.

## What shipped

- `src/app/(home-tabs)/_layout.tsx`: `NativeTabs`, three `NativeTabs.Trigger`s.
- `plugins/withPhosphorTabDrawables.js`, registered in `app.json`.
- `src/config/tabIcons.json`: Phosphor name, drawable names and SF Symbols per tab.
- `src/config/themes.ts`: removed `gradients.tabBar` (unused).
- `src/screens/feralReports/index.tsx`: comment fix only.

## Tests

**Not tested:** no new Jest test. Native tabs render natively, and no JavaScript check reads native code. A bad icon name or SVG fails the prebuild, so the CI build catches it.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit/model tests: `npx jest` (88 suites, 404 tests)
- [x] Lint: `npx eslint .` (0 errors; 5 warnings, all present before)
- [x] Formatting: `npx prettier --write` on changed files
- [x] The plugin's Android mod, run on its own into a scratch folder: wrote all 6 drawables; each parses as XML.

**Unverified:**

- No build and no device run (maintainer: no build here). CI builds on the PR.
- Nunito on the native bar. Fonts load at runtime with `useFonts`; check the bar does not show Roboto.
- iOS. Builds are Android-only.

## Follow-ups and known limitations

- Android allows at most five tabs.
- The keyboard covers the Android bar unless `tabBarRespectsIMEInsets` is set. No tab screen has a text field today.
