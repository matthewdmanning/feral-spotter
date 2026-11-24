# Code audit fixes — duplication lens

**Scope:** refactor
**Issues/spec:** `docs/reviews/2026-11-24-code-audit-duplication.md` (DUP-1–11, DUP-T-1/2), decisions in `docs/reviews/2026-11-24-code-audit-decisions.md`
**Date:** 2026-11-24
**Branch/PR:** `fix/audit-duplication`

## Scope

**In scope:** DUP-1–11; tests DUP-T-1, DUP-T-2. DUP-14 rode along with DUP-5 (its file went away).

**Out of scope:** other P3s (DUP-12, 13, 15–20; DUP-T-3–5), filed as issues by the lens owner.

## What shipped

| Finding | Change                                                                                                                                                                                                                                                                                                                                                               |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DUP-1   | `useCapturedPhotoWorkflow.runCapture({ capture, failureProps, logTag })` owns the photo limit, taking-photo flag, flash, failure event and gallery flush; location start moved there too. Both camera hooks pass only their capture call. Native: one `nativeTelemetryBase()`, one `NATIVE_CAMERA_BACKEND`. VisionCamera: shared `performanceProps`/`pipelineProps`. |
| DUP-2   | `shared/hooks/useMapFrame(viewForSize, onTouchActiveChange)` → `{ cameraPosition, frameProps }`: frame measurement, value-keyed camera, unmount touch-release. Both sightings maps use it.                                                                                                                                                                           |
| DUP-3   | `edgeHandle(axis, sign)` builds the four crop handles. `clampTranslate` calls `clampHalfExtent`.                                                                                                                                                                                                                                                                     |
| DUP-4   | `SharingCheckbox` gains `disabled`; `SharingFieldInputs` (checkbox + revealed input beneath) serves Settings and Leave. Both moved to `organizations/components/`. Leave now shows each input under its checkbox, per UI standards.                                                                                                                                  |
| DUP-5   | `useCatForm` holds one values object with `setField(key, value)`; `CatForm` renders controls from `CAT_ATTRIBUTES` (coat pair special). `formOptions.ts` deleted (DUP-14); `shownCoatValue` beside `COAT_GROUPS`.                                                                                                                                                    |
| DUP-6   | `PHOTO_FORMATS` (extension → contentType) derives the extension list, MIME list and `photoContentType`.                                                                                                                                                                                                                                                              |
| DUP-7   | `STORAGE_BUCKET_NAME` (`submissionLimits.ts`) and `DEFAULT_BUCKET_NAME` (`functions/src/submissionLayout.ts`), pinned equal by the contract test.                                                                                                                                                                                                                    |
| DUP-8   | `SHARING_NAME_MAX_LENGTH`, `SHARING_PHONE_MAX_LENGTH`, `INVITE_CODE_LENGTH` in `functions/src/organizations/domain.ts`; server validation, invite code and app inputs use them.                                                                                                                                                                                      |
| DUP-9   | `stackScreenOptions(theme)` (`shared/ui/molecules/`) for root and submission Stacks; submission takes the root `headerTitleStyle`.                                                                                                                                                                                                                                   |
| DUP-10  | Organizations flags through the PostHog SDK. See the [Organizations note](2026-11-07-feat-organizations.md#2026-11-24--refactor-organizations-flags-through-the-posthog-sdk-dup-10).                                                                                                                                                                                 |
| DUP-11  | Live-fix state, draft lock and upload-queue signal are Zustand stores (`useLocationCaptureStore`, `useDraftBusyStore`, `useUploadQueueStore`). Timers and guards stay module variables; `__resetLocationCaptureForTests` still stops timers.                                                                                                                         |

## Tests

- `organizationsFlag.test.ts` — rewritten against the real SDK via MSW (`src/test-utils/posthogFlags.ts`); a `sendEvent: true` mutation fails it.
- `OrganizationsRuntime`, `SettingsScreen.saveScope`, `CreateScreen.organizationsGate` — mount the same SDK instead of a hand-stubbed `/flags`.
- `submissionLayout.contract.test.ts` — bucket equality; each format uploads with the app's own `photoContentType`.
- DUP-T-1: `draftUploads.test.ts` drops its `expo-crypto` re-mock.
- DUP-T-2: `firebaseUpload.behavior.test.ts` answers admission through MSW, not `global.fetch`.

No new bug surfaced, so no failing-first regression test.

## Verification

- Run after rebasing on main (style lens #514): `npm run typecheck`, `npx expo lint` (0 errors; 12 warnings, none in changed files), `npx jest` (148 suites / 694 tests), `functions` Jest (10 / 99), `npm run test:rules` (3 / 34).
- Unverified: no device drive. Camera capture, crop handles and map touch-lock are Jest-covered only; the SDK flag path is untested on a release-candidate build.
