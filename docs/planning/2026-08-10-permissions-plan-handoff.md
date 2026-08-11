# Handoff — permissions migration (#243) + privacy nutrition-label plan

Repo: `C:\GitHub\feral-spotter`, worktree `C:\GitHub\feral-spotter\.claude\worktrees\device-testing-planning`, branch `issue-243-permissions-expo-migration`.

## What's done and shipped

Issue #243 (migrate off `react-native-permissions`) is implemented, committed, pushed, PR open as draft.

- PR: https://github.com/matthewdmanning/feral-spotter/pull/246
- Issue comment recording a deviation from the issue's literal text: https://github.com/matthewdmanning/feral-spotter/issues/243#issuecomment-5246737764
- Full implementation writeup (don't duplicate here — read it): `docs/implementations/2026-08-10-243-permissions-expo-migration.md`
- Commit: `cc5cb19` on `issue-243-permissions-expo-migration`

Key facts a fresh agent needs without re-deriving:

- Camera permission handling moved to `react-native-vision-camera`'s own API (`useCameraPermission()` hook / `VisionCamera.requestCameraPermission()`+`cameraPermissionStatus`), **not** `expo-camera` as the issue literally named — `expo-camera` was never a project dependency; the app's camera capture already runs on vision-camera. This was flagged explicitly on the issue and in the PR body, not buried.
- Location moved to `expo-location`, as the issue asked.
- `expo-location`'s native `AndroidManifest.xml` (in `node_modules`) hardcodes both `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`, independent of `app.json`'s permission list — confirmed by reading the file directly, not assumed.
- Not device-tested. PR body has a recommended pre-merge device sweep (camera first-denial → `'not-determined'` gates, Approximate → `android.accuracy === 'coarse'` gates, Settings-recovery clears both).
- Memory updated: `project_permissions_library_migration.md` in the auto-memory store — marks the migration shipped and records that `expires` does NOT distinguish Android's one-time vs persistent location grants (confirmed via `LocationModule.kt`, hardcoded to `"never"`), so #225's notice stays unconditional permanently — don't re-open that expecting a future fix.

## In progress — NOT yet started, blocked on user

User asked (this session, unrelated to #243/#246) for a plan to get correct data declared in both platforms' privacy nutrition labels (Apple App Privacy questionnaire, Google Play Data Safety form) and to confirm the app captures the right granularity of permission response. A plan was presented and the user has not yet answered the process question that blocks starting:

**Open question posed to the user, unanswered as of this handoff: new GitHub issue + branch for this work, or fold into the current #243/#246 branch?** Per this repo's global workflow rules (`~/.claude/CLAUDE.md` git-workflow section), unrelated work needs its own issue/branch — don't stack it onto #246 without the user's answer.

### Deliverable planned (not yet written)

One file: `docs/references/privacy-nutrition-labels.md` (this folder, not `design-decisions/` — that folder is UI/UX current-state and requires explicit user confirmation to edit, and this isn't UI/UX). No code changes planned — dropped, after advisor review, an idea to log granted location-accuracy via analytics: nutrition labels are static capability declarations, not per-session telemetry, and #243's `isLocationGated` already reads `android.accuracy`/`ios.accuracy` correctly for the app's own gating logic. That's sufficient; nothing else to build.

### Rows already evidence-backed, ready to write into the doc

| Data type                                    | iOS (App Privacy)                                                                                                                                                                      | Android (Data Safety)                                                                              | Evidence                                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location                                     | Precise Location: yes (no `NSLocationDefaultAccuracyReduced` set)                                                                                                                      | **Both** Approximate and Precise (COARSE is in the merged manifest regardless of app-level gating) | `app.json`; expo-location's `android/src/main/AndroidManifest.xml`; developer.android.com (see Sources)                                                                                                                                           |
| Photos                                       | Photos, add-only (app never reads the library)                                                                                                                                         | Photos and videos                                                                                  | `app.json`'s `savePhotosPermission`/`granularPermissions:["photo"]`; `useCameraCapture.tsx`'s `getPermissionsAsync(true)` (write-only calls, no read calls anywhere in `src/`)                                                                    |
| Cat details (user-entered animal attributes) | User Content, **linked to you** — reasoning: tied to an account-linked Submission, not "about the animal so not personal data" (a reasoning trap flagged by advisor — don't repeat it) | Same                                                                                               | `src/content/consentDisclosure.json`; Submission model is account-linked                                                                                                                                                                          |
| Account (Google + Apple Sign-In)             | Identifiers/Email, linked to you                                                                                                                                                       | Same                                                                                               | `app.json`'s `usesAppleSignIn: true`; Google Sign-In auth flow                                                                                                                                                                                    |
| Usage analytics/crash (PostHog)              | Usage Data/Diagnostics, **not linked to you**                                                                                                                                          | Same                                                                                               | grepped `src/lib/analytics/` and all of `src/` for `identify(`/`distinctId`/`register(`/`setUser`/`alias(` — zero matches; `EVENTS` in `analytics.ts` has 10 events, none carry email/name/uid/PII props                                          |
| Facebook SDK                                 | None currently collected                                                                                                                                                               | None currently collected                                                                           | `app.json`'s `react-native-fbsdk-next` plugin block: `isAutoInitEnabled`, `advertiserIDCollectionEnabled`, `autoLogAppEventsEnabled` all explicitly `false` — **add as a re-audit trigger if any of these three flags is ever flipped to `true`** |

Doc also needs a "re-audit when" section: new `app.json` permission or Info.plist key, new Expo plugin, new analytics property, any FB SDK flag flip. This is the same staleness-trigger pattern `design-decisions/` files use (`docs/design-decisions/using-design-decisions.md`), applied to a `references/` file instead.

Phase 2 (the user's own work, not automatable by an agent): transcribe the finished doc into App Store Connect's App Privacy questionnaire and Play Console's Data Safety form. The doc should list the exact form section names so transcription is mechanical.

## Sources consulted this session (don't re-fetch — cite these)

- `developer.android.com/privacy-and-security/declare-data-use` — official Google guidance, fetched via WebFetch. Direct finding: apps declaring `ACCESS_FINE_LOCATION` must declare **both** Approximate and Precise location in Data Safety, because fine access implies coarse capability and manifest-merged permissions from libraries count even if not explicitly declared by the app. This is the one fact that changed the plan's location row from "Precise only" to "both" — do not revert without a stronger contradicting source.
- WebSearch: `Google Play Data Safety form ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION declare approximate location required 2026` — surfaced the above page plus a real-world precedent (a GitHub issue, `commons-app/apps-android-commons#5708`, an app rejected specifically over an Approximate Location Data Safety mismatch) — worth reading if the doc needs a concrete "here's what goes wrong" citation.
- Primary-source code reads (all still valid, re-grep to confirm if this handoff is stale): `app.json` (iOS `infoPlist` block, Android `permissions` array, plugin configs), `node_modules/expo-location/android/src/main/AndroidManifest.xml`, `node_modules/expo-location/build/Location.types.d.ts` (`LocationPermissionResponse`, `android.accuracy: 'fine'|'coarse'|'none'`), `node_modules/expo-modules-core/build/PermissionsInterface.d.ts` (`PermissionExpiration` doc comment), `node_modules/react-native-vision-camera/src/hooks/usePermission.ts` + `VisionCamera.ts` + `specs/common-types/PermissionStatus.ts`, `src/content/consentDisclosure.json`, `src/lib/analytics/analytics.ts`, `src/providers/AppProviders.tsx`.

## Reasoning trail (advisor consultations this session)

Three `advisor()` calls, in order:

1. Before implementing #243 — advisor confirmed the plan to use vision-camera's own API for camera (not `expo-camera`), gave the exact `isCameraGated`/`isLocationGated` non-gated-⟺ framing used in the shipped code, and flagged two must-verify-before-coding items (vision-camera's public export surface, expo-location's return-type shape) — both were verified and held.
2. After implementation, before commit — advisor's Standards/Spec code-review synthesis led to two shipped fixes: `handleAgree` now reads the boolean `requestCameraPermission()` resolves with instead of re-reading a getter that might lag, and `openSettings` wraps `Linking.openSettings()` in an arrow function (detached-`this` risk). Also confirmed: leave the three test files' duplicated `jest.mock()` blocks as-is — a root `__mocks__/` file would silently change behavior for unrelated test suites, and a shared-module approach is fragile against `babel-plugin-jest-hoist`'s hoisting rules (only hoists calls written literally in the test file).
3. During the nutrition-label planning (this session, most recent) — advisor confirmed dropping the speculative analytics-event idea (YAGNI — static declarations don't need per-session telemetry), but caught that "don't declare Approximate because the app gates coarse-only grants" was likely wrong for Play — this is what triggered the WebFetch verification above, which confirmed the concern was correct. Also flagged: cat details are User Content linked-to-you via the account-linked Submission, not exempt because they're "about the animal" — and that starting the privacy-doc work on the current branch would be scope creep needing the user's explicit OK first (still unanswered).

## Suggested skills for continuing

- **advisor** — the user explicitly asked to consult it regularly for this task; keep doing so before finalizing the doc's content and before any further scope decisions.
- **mattpocock-skills:research** — if the Apple App Privacy side needs the same primary-source rigor the Play side just got (this session only used ad hoc WebSearch/WebFetch for Play; Apple's exact questionnaire category names/behavior haven't been verified against Apple's own documentation the same way). Would produce a citable markdown file under the repo instead of ad hoc fetches.
- Do **not** use a general-purpose subagent for this — the user's global memory explicitly restricts that to sessions where they type the literal phrase "general-purpose".

## Immediate next step

Resume by asking the user (if not already answered) whether the privacy-nutrition-label work gets its own issue+branch or folds into #243/#246, per the repo's own workflow rules — then write `docs/references/privacy-nutrition-labels.md` using the table above, plus the re-audit-triggers section, plus the exact App Store Connect / Play Console form-section names for Phase 2.
