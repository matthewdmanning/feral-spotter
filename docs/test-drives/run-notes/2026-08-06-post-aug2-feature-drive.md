# Test drive — 2026-08-06

Git state: branch `sprint/cat-annotate-flow`, commit `c086a049b9ad878db3baf304ba699880a5df26c3`.
Emulator: `Pixel_8_APIs` (emulator-5554).
Scope: feat/fix commits since 2026-08-02 not yet on `main` — #170, #171, #172, #177.
Method: `adb shell uiautomator dump` + tap/swipe scripting, not screenshots.

Setup note: app was reinstalled via `npm run android` on `matthewdmanning/issue168` earlier in the
session (fixed a stale-APK `RNFBAppModule`/`ExpoMaps` native-module mismatch), then branch-switched
to `sprint/cat-annotate-flow` for this drive — no native rebuild needed for the switch itself (diff
vs. prior HEAD was JS-only, `package.json` -2 lines, no `android`/`ios` changes).

**Observability method:** `topResumedActivity`/`ResumedActivity` does **not** distinguish dev-launcher
JS from app JS — both run under `.MainActivity` in the single-activity dev-client architecture; don't
infer screen identity from it alone. `uiautomator dump` does work on live app screens (confirmed
non-empty, readable `content-desc`/`text` nodes), even though it returned an empty 5-node tree on the
dev-launcher's own connect screen. Screen identity was verified by dumping + grepping `text=`/
`content-desc=`.

## Confirmed

- **#171 "Not in this photo" pill** — present in `annotate`'s bottom bar, functional (advances the pass on tap).
- **"Boxing Complete" no-op with zero boxes drawn** — marking every photo "not in this photo" and tapping "Boxing Complete" returns to Cat List with no cat recorded. Consistent with #170's design: no box drawn → no `cat_id` ever generated → nothing to open a Cat Form for.
- **#172 Cat Form photo-selector gone** — after drawing a real box and confirming, Cat Form ("Observed Cat") showed the placeholder inset ("Cropped photo of the cat being described") and the full attribute form, with no photo-selection control anywhere.

## Not cleanly verified

- **#170 empty-Cat-List auto-skip** — landing on Cat List via a fresh app relaunch (deep-link, not a real photo-capture entry) rendered normally with "Add a Cat" despite `cats.length === 0`, instead of auto-skipping into `annotate`. May be correct (auto-skip likely scoped to the actual photo-capture→Cat-List transition, not every app entry) or may be a real gap — didn't drive the camera/photo-capture entry point to confirm either way.
- **#177 bounding-box sweep on mid-pass photo removal** — not exercised this pass.
- **"Not in this photo" per-tap advance semantics** — one dump showed the photo counter jump 1/4 → 4/4 across two taps with a 2s settle between; likely a dump-timing artifact, not confirmed as a bug.
- **Camera fixes (#146, sprint #148)** — already on `main`, deprioritized, not tested.

## Side findings from this session

- Stale installed APK was missing `RNFBAppModule`/`ExpoMaps` native modules (pre-Firebase-link build) — fixed with a native rebuild (`npm run android`) before this drive started.
- Hit one real crash: `NullPointerException` in `ReactActivityDelegate.onKeyDown` (react-native), triggered by a key event racing the React delegate's readiness. Unrelated to the branch under test.
- #168/#167 GitHub links originally pointed to a pre-push branch (404'd); fixed once `matthewdmanning/issue168` was pushed.
- Inset-crop prototype (`docs/planning/prototypes/2026-08-06-issue168-inset-crop.*`) lives on `matthewdmanning/issue168`, **not reachable from `sprint/cat-annotate-flow`** — will need merging into whatever branch #174 gets built from.

## Required per-run checks (project_instructions.md)

- PostHog: only saw `[analytics] capturer not registered` — no network activity, consistent with no-consent/dev config. Didn't test the consent-flip path itself.
- Location: "Location acquired" appeared on Cat List (implies a Live fix succeeded), but no matching `FusedLocationProvider`/`GnssLocationProvider` logcat lines under the grep used.
