# Pre-release Android build variant (#454)

**Scope:** tooling
**Issues/spec:** #454
**Date:** 2026-11-14
**Branch/PR:** feat/454-prerelease-build

## Scope

**In scope:**

- [x] A standalone (release variant, JS bundled) Android APK that is identifiable as pre-release.
- [x] Experimental camera controls on in that build; a place to add more flags.
- [x] `vX.Y.Z-pre.N` tag convention, documented.

**Out of scope / not addressed:**

- EAS, Play upload or internal track (#334). Distribution is a locally built APK for sideloading.
- A separate applicationId.
- Showing the pre-release state in Settings.

## Intent

**Purpose:** let the maintainer sideload a release-mode build that exercises test features without Metro.

## Design decisions and reasoning

### Same applicationId

- **Decision:** the variant keeps `com.mmanning.feralspotter`.
- **Reason:** `google-services.json` is bound to it. It installs over a release build rather than beside it.

### Variant from `APP_VARIANT`, flags from `EXPO_PUBLIC_*`

- **Decision:** `app.config.js` reads `APP_VARIANT=prerelease` to set `extra.isPrerelease` and add " (pre)" to the app name. `scripts/build-prerelease.sh` also exports each name in `PRERELEASE_FLAGS` as `true`.
- **Reason:** `FEATURE_FLAGS` already reads `EXPO_PUBLIC_*` at bundle time, so a new flag needs one array entry and no new mechanism.

### Version stays `X.Y.Z`

- **Decision:** the pre-release identity is the tag and the launcher label, not `expo.version`.
- **Reason:** `isVersionReleased` uses `semver.gte`; `0.1.0-pre.1` is below `0.1.0` and would close release gates.

## What shipped

- `app.config.js`: `extra.isPrerelease` (false unless `APP_VARIANT=prerelease`), " (pre)" name suffix.
- `scripts/build-prerelease.sh` and `npm run build:prerelease`: `expo prebuild --platform android --clean`, then `./gradlew assembleRelease`. Needs no device.
- Build and install steps in `docs/agents/native-code.md` ("Pre-release build").

## Tests

| Test file                     | What it verifies                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `__tests__/appConfig.test.ts` | `isPrerelease` is false when unset or another value, true with `prerelease`; applicationId unchanged. |

**Not tested:** the shell script's behavior (only `bash -n`).

## Verification status

**Run and passing:** `npx jest __tests__/appConfig.test.ts`; `npx expo config --json` shows `extra.isPrerelease` true with `APP_VARIANT=prerelease` and false without.

**Unverified:**

- No Android SDK in the authoring environment: the release Gradle build and the APK on a device were not run.
- That the inlined `EXPO_PUBLIC_EXPERIMENTAL_CAMERA` turns the camera controls on in the built APK.
- Release signing: whatever the generated `android/` project uses (Expo's template uses the debug keystore); fine for sideloading.

## Follow-ups and known limitations

- [ ] Show pre-release state in Settings if wanted.
