# Code audit — MVVM alignment

Reviewed 2026-11-24 on `review/sonnet-code-audit` at `880c9b9` (HEAD is `4a603f4`, which only adds the review agents). Scope: `src/`, `functions/src/`, `modules/*/src/` (JS only). `node_modules` is absent: everything is static; no test was run, so nothing here claims a test passes or fails.

Layer mapping used (from the agent profile): View = `screens/`, `components/`, `shared/ui/`, `src/app/`; ViewModel = `hooks/` (screen hooks and actions); Model = Zustand stores, `lib/`, `config/`, Firebase/HTTP services, `functions/`.

## Summary

- No P1. 8 P2, 9 P3 source findings; 1 P2 and 8 P3 test findings.
- Dependency direction is clean. I scripted every import in `src/` (level table, screens rule, routes/providers, `../`, cycles): zero violations, zero import cycles, and every `src/app/**` route is a one-line re-export. `modules/` never imports `src/`. Sub-feature peers (`sharing`/`membership`/`interactions`) do not import each other outside screens. ADR-0006 holds: only `draft.ts` enumerates the four draft stores.
- The recurring defect is Fat Views in `features/organizations/`. `OrganizationPermissions`, `SubmissionOrganizations`, `LeaveChoices` and `SharedSightingsScreen` carry ledger filtering, review/reconfirm sequences, abort lifecycles, idempotency-key minting and direct `organizationRequest` calls. The sibling hooks (`useMemberships`, `useSharedSightings`) show the intended shape.
- The camera ViewModels are the other hotspot. `useCapturedPhotoWorkflow` returns JSX and owns the gallery-save pipeline; `useNativeCameraCapture` assembles the same telemetry property bag four times. The native capture path has no ViewModel test (MVVM-T-1).
- Two Model bypasses go around the project's own seams: `useSubmissionSubmit` calls `@react-native-firebase/auth` directly instead of `authProvider`, and the location picker's View sequences two store mutations whose order is load-bearing.
- `eslint.config.js` and `__tests__/architecture.test.ts` enforce unit levels, screens, routes, providers, cycles and `../`. They do not cover sub-feature isolation, `modules/` -> `src/`, barrels, or what the client may import from `@/functions/`.

## Findings

### MVVM-1 — P2: The location picker View sequences two store mutations whose order is load-bearing

**Where:** `src/features/draft-submission/screens/location-picker/index.tsx:37-41`, `src/shared/hooks/useSubmissionStore.ts` (`setLocationType`) · **Basis:** source · **Confidence:** confirmed
**Evidence:**
```ts
setLocationType('pin')
setSubmissionLocation(currentCenter())
router.back()
```
`setLocationType` clears `latitude/longitude/accuracy` whenever the type changes (`useSubmissionStore.ts`, "Switching method invalidates any acquired coords"), so the two calls must run in exactly this order. The only guard is a comment in the View. The same screen's `usePinCenter.ts:36` also calls `Location.getLastKnownPositionAsync()` directly, although `core/location` owns location acquisition.
**Human path / failure scenario:** a future edit that swaps the two lines, or a second caller that copies one of them, saves a `pin` Submission with no coordinates. The accuracy-warning icon on Sighting Details then flips to "uncertain" and the user cannot tell why.
**Fix:** add one store action, e.g. `setManualPin(loc: SubmissionLocation)`, that sets `location_type: 'pin'` and the coordinates in a single `set`. The View calls it once. Move `resolveSeedRegion` behind `core/location/location.ts`. `LocationPicker.model.test.tsx` already uses the real store and would keep covering it.

### MVVM-2 — P2: `OrganizationPermissions` is a Fat View that owns ledger rules and the review/reconfirm sequence

**Where:** `src/features/organizations/sharing/components/OrganizationPermissions.tsx:72-97` (filters), `:101-120` (revoke), `:122-151` (review), `:152-170` (organization list) · **Basis:** source · **Confidence:** confirmed
**Evidence:**
```ts
const permissions = account.ledger.permissions.filter(
  (p) =>
    (!organizationId || p.organizationId === organizationId) &&
    (!submissionId || p.submissionId === submissionId),
)
```
and `review` calls `useOrganizationSharingStore.getState().prepareReview`, then `reconfirm`, then `await persistOrganizationSharing()`, then `state.sync(uid)`. It also holds a `uid` captured-at-render guard, `useAuthStore.getState().user?.uid !== uid`, inside a dialog callback.
**Human path / failure scenario:** Settings (or Sighting detail, or an organization overview) -> Review sharing -> Confirm. This sequence (reviewed grant, then reconfirm, then persist, then sync, each with its own failure message) is the consent-critical path for sharing a Sighting with an organization. It can only be exercised by rendering a 297-line component. Anything that needs the same "pending, revoking, saved" status (e.g. a badge) must copy the filters.
**Fix:** extract `useOrganizationPermissions({ submissionId, organizationId })` into `sharing/hooks/`. It returns derived rows (status per permission, pending items, organization list) and actions (`revoke`, `review`, `retry`). Put the scoping filters in `sharing/lib/` as pure functions. The component then only maps rows to `TextButton`s. Same pattern as `useSharedSightings`.

### MVVM-3 — P2: Views call the organization API directly and mint idempotency keys

**Where:** `src/features/organizations/sharing/screens/SharedSightingsScreen.tsx:55-71` (`SharedPhoto`), `:107-130` (`SharedPhotos`); `src/features/organizations/membership/components/LeaveChoices.tsx:156-181` (`reviewLeaving`), `:167` and `:206` (`randomUUID()`) · **Basis:** source · **Confidence:** confirmed
**Evidence:**
```ts
void organizationRequest<{ image: string }>(
  { action: 'sharedPhoto', organizationId, id: sighting.id, index },
  uid, { signal: controller.signal },
)
```
`LeaveChoices` does the same for `reviewLeaving`, with its own `AbortController`, in-flight latch, and `mutationId: randomUUID()` built inside `onPress`. `SharedPhotos` implements "one photo at a time" by counting settled children in state.
**Human path / failure scenario:** Organizations -> Leave -> Keep my data -> Review. The leave mutation's idempotency key is created in a button handler, and `reset()` plus re-review mints a new one. Any retry-semantics change needs a View edit, and `LeaveChoices.test.tsx` is the only place the sequence is exercised.
**Fix:** add `useSharedPhoto(...)` and `useLeaveReview(...)` hooks beside `useMemberships`/`useSharedSightings`, using `organizationRequest` and `isRequestCancelled` from `organizations/lib/api`. The Views take `{ image, error, retry }` and `{ review, loading, choice }`. Mint `mutationId` in the hook, not the handler.

### MVVM-4 — P2: `SubmissionOrganizations` mixes selection rules, a derived-state sync effect and coverage messaging in the View

**Where:** `src/features/organizations/sharing/components/SubmissionOrganizations.tsx:46-70` (effect), `:73-82` (signature/patch), `:93-130` (coverage branching) · **Basis:** source · **Confidence:** confirmed
**Evidence:**
```ts
useEffect(() => {
  if (!user || !enabled || !hydrated || !directory.cache || ...) return
  const next = reconcileSharingDraft(draft, { ownerUid: user.uid, ... })
  if (next !== draft) setDraft(next)
}, [user, enabled, hydrated, directory.cache, ..., draft, setDraft, directory.organizations])
```
The effect writes a store value derived from other store values (the draft is reconciled against the directory), and it only runs while this component is mounted. Selection toggling (`patch({ selectedIds })`), confirmation signature and the five-way "saved/unavailable/none" copy choice all sit in JSX. The component also formats `new Date(directory.cache.fetchedAt).toLocaleDateString()` inline.
**Human path / failure scenario:** Sighting Details with Organizations on; open the Settings gear to change sharing fields while this card is unmounted, return. The reconcile and the signature check only happen after remount, so what the card shows is a function of mount timing rather than of the stores.
**Fix:** `useSubmissionSharing()` in `sharing/hooks/` owning the reconcile, `toggleOrganization`, `setAnonymous`, `confirmed`, and a `coverageStatus` discriminant. The View switches on `coverageStatus`. Keep `reconcileSharingDraft` and `sharingSignature` as the Model.

### MVVM-5 — P2: `useSubmissionSubmit` talks to Firebase Auth directly and carries an auth rule

**Where:** `src/features/draft-submission/hooks/useSubmissionSubmit.ts:22-26` (import), `:80-125` (`submitWithVerifiedEmail`); also `src/features/draft-submission/lib/upload/uploadAdmission.ts:8,67` · **Basis:** source · **Confidence:** confirmed
**Evidence:**
```ts
import { getAuth, reload, sendEmailVerification } from '@react-native-firebase/auth'
...
const auth = getAuth()
const user = auth.currentUser
if (user?.email && user.emailVerified === false) {
```
The auth feature already owns this seam: `features/auth/lib/IAuthProvider.ts` plus `authProvider` (real Firebase or the dev/Jest stub in `auth/lib/index.ts`). `IAuthProvider` has no `reload`, `emailVerified` or `sendVerificationEmail`, so the draft hook reaches around it. The verified-email gate, a Model rule, then lives as 45 lines of dialog plumbing in a ViewModel, behind a uid/draft-id staleness check.
**Human path / failure scenario:** a signed-in email user with an unverified address taps Submit Sighting -> app reloads the user -> shows "verify first". Anything that stubs `authProvider` (the sanctioned test seam) leaves this path on real Firebase; that is why `useSubmissionSubmit.submitFlow.test.ts` imports `reload`/`sendEmailVerification` from the SDK and mocks them there.
**Fix:** extend `IAuthProvider` (and the dev stub) with `emailVerification(): Promise<{ needsVerification: boolean }>` and `sendVerificationEmail()`; move the gate to `features/auth/lib/` (or a `draft-submission/lib/` function taking the provider). The hook keeps only the alert wiring. `uploadAdmission.ts:67` should use `authProvider.getToken()` for the same reason.

### MVVM-6 — P2: `useCapturedPhotoWorkflow` returns JSX and owns the gallery-save pipeline

**Where:** `src/features/camera-control/hooks/useCapturedPhotoWorkflow.tsx:218-228` (`renderItem`), `:169-193` (`flushGallerySaves`) · **Basis:** source, test-read · **Confidence:** confirmed
**Evidence:**
```ts
const renderItem = useCallback(
  ({ item, index }) => (
    <CameraThumb uri={item.uri} ... label={`Photo ${index + 1} of ${capturedPhotos.length}`} />
```
and `await Asset.create(uri)` from `expo-media-library` inside the hook, with `pendingGallerySaves`, permission check and file-retention bookkeeping. A ViewModel importing a component from `components/` and building its accessibility label inverts the dependency; the gallery pipeline is Model work (the doc comment even says "the application workflow exists once"). Four test files must `jest.mock('.../CameraThumb')` just to test hook behavior (`useCapturedPhotoWorkflow.test.tsx:35`, `useCameraCapture.test.ts`, `useCameraCapture.controls.model.test.ts`, `flow.cameraDone.test.tsx`).
**Human path / failure scenario:** Camera -> take 3 photos with "Keep Photos on Device" on -> Done. Gallery save is a hook-private ref queue; a screen that wants the same save (e.g. a library import) must copy it.
**Fix:** hooks return data (`capturedPhotos`, `removePhoto`); `CameraThumbStrip` in `components/` owns `renderItem`/`keyExtractor`. Move `pendingGallerySaves`/`flushGallerySaves` to `camera-control/lib/gallerySaver.ts` (queue + `Asset.create` + `releaseCapturedPhotoFile`), tested against the supplied media-library boundary as testing.md allows.

### MVVM-7 — P2: `useNativeCameraCapture` builds telemetry inline, repeated four times, and exposes a native prop bag

**Where:** `src/features/camera-control/hooks/useNativeCameraCapture.tsx:112-140` (`CAMERA_DEVICE_READY`), `:157-168` (diagnostic), `:214-250` (`PHOTO_CAPTURED`), `:253-275` (`PHOTO_CAPTURE_FAILED`); return block `:327-356` · **Basis:** source · **Confidence:** confirmed
**Evidence:** the block
```ts
camera_backend: Platform.OS === 'ios' ? 'avfoundation' : 'camerax',
camera_variant: 'native', camera_platform: Platform.OS, camera_position: position,
max_detail: maxDetail, motion_priority: motionPriority,
low_light_boost_disabled: disableLowLightBoost, subject_metering: subjectMetering,
requested_capture_tuning: requestedCaptureTuning.current ?? 'unreported',
```
appears in three events (`:114-140`, `:223-241`, `:257-271`). `handleTakePhoto` is a ~110-line callback that mixes the capture state machine, timing, persistence and event shaping, with a 12-entry dependency array. The hook returns 30 members including the setter `setIsCameraReady`, `diagnostics`, the constant `disableLowLightBoost`, and a never-called `applySubjectRegion`.
**Human path / failure scenario:** adding one tuning field means editing three property lists; one drifts and the PostHog camera dashboards silently disagree between events.
**Fix:** `camera-control/lib/cameraTelemetry.ts` with `nativeTuningProps({position, settings, requested})` used by all four events; the hook passes plain inputs. Return one `nativeViewProps` object instead of seven loose tuning fields. Drop `setIsCameraReady`: expose `handleCameraError` so the View stops calling `console.error` itself (MVVM-10).

### MVVM-8 — P2: Contact-field limits are re-typed in four Views while the server owns them

**Where:** `src/features/organizations/sharing/components/SharingSettings.tsx:75,92` (200, 50); `src/features/organizations/membership/components/LeaveChoices.tsx:114,126` (200, 50); `src/features/organizations/membership/screens/MembershipsScreen.tsx:106` (32); server `functions/src/organizations/api.ts:55,57` (`settings.name.length > 200`, `settings.phone.length > 50`) · **Basis:** source · **Confidence:** confirmed
**Evidence:** `maxLength={200}` and `maxLength={50}` in two Views; `settings.name.length > 200 || ... settings.phone.length > 50` as bare literals in the API. `MEMBER_NAME_MAX_LENGTH` is already exported from `functions/src/organizations/membership/domain.ts` and imported by `auth/screens/register`, so the project has a working pattern.
**Human path / failure scenario:** the server cap changes to 100; the field still accepts 200 characters, the confirm call returns 400 "Invalid sharing settings", and the user sees a generic failure on the consent step.
**Fix:** export `SHARING_NAME_MAX_LENGTH`/`SHARING_PHONE_MAX_LENGTH` (and the invite-code length) from `functions/src/organizations/domain.ts`; use them in `api.ts` and the Views. (Duplication lens will see the same literals.)

### MVVM-9 — P3: Settings screen derives a Model value inline and mirrors external state

**Where:** `src/features/settings/screens/settings/index.tsx:89-93`, `:73-82` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `const capturePriority = settings.camera_max_detail ? settings.camera_motion_priority ? 'balanced' : 'quality' : 'speed'`, while the inverse (`CAPTURE_PRIORITY_SETTINGS`) lives in `settings/config/capturePriority.ts`. The screen also keeps `useState(getThemeMode)` and `useState(getHapticsEnabled)` copies of module-level values it then writes through, and reads `useConsentStore`/`useAuthStore` raw.
**Failure scenario:** the two directions of one mapping live in different layers; a fourth priority updates one side only. The state mirrors cannot reflect a change made elsewhere.
**Fix:** `capturePriorityOf(settings)` next to `CAPTURE_PRIORITY_SETTINGS`; a `useSettingsScreen()` returning `{ themeMode, hapticsOn, emailOptIn, accountEmail, capturePriority, ...actions }`. The haptics/theme getters could be `useSyncExternalStore` like `useDraftBusy`.

### MVVM-10 — P3: Native camera screen owns permission, tap-to-focus math and error handling

**Where:** `src/features/camera-control/screens/camera/NativeCameraScreen.tsx:18` (permission), `:56-82` (focus gesture), `:111-117` (`onCameraError`); `LegacyCameraScreen.tsx:38` (`useCameraPermission`) · **Basis:** source · **Confidence:** confirmed
**Evidence:**
```ts
void focus({ x: event.x / width, y: event.y / height })
```
with the `width <= 0 || height <= 0` guard, and
```ts
onCameraError={(event) => { setIsCameraReady(false); console.error('[NativeCameraScreen]', ...) }}
```
**Failure scenario:** a regression in the divisor (or a rotated layout reporting 0) only shows up by driving the gesture on a device; no JS test can reach it without rendering the screen (see MVVM-T-3).
**Fix:** `focusAt(point, size)` in the hook (normalization is the rule); `handleCameraError` in the hook; permission through the existing `permissions` feature (`cameraPermission` is already used by `useConsentPermissions`) so both screens share one gate.

### MVVM-11 — P3: Root `_layout.tsx` carries a service subscription and start-up sequencing

**Where:** `src/app/_layout.tsx:49-60` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `NetInfo.addEventListener((s) => setOnlineStatus(s.isConnected ?? false))` and `void initializeDraft().catch(...)` in effects, plus font loading and splash control. PROJECT_STRUCTURE says routes are "thin re-exports of screens only"; the file's own header says "Routes only decide when screens are shown."
**Fix:** `useAppStartup()` in `shared/hooks/` (NetInfo bridge) and `features/draft-submission/hooks/` (draft init) called from `RootLayout`, or mount them in `AppProviders` beside `OrganizationsRuntime`. `__tests__/RootLayout.startup.test.tsx` already exists to guard the move.

### MVVM-12 — P3: Small rules left in screens (Home, Cat Form)

**Where:** `src/core/home/screens/home/index.tsx:162-166` (`draftOrigin`); `src/features/draft-submission/screens/cats/index.tsx:36-43,60-70` (stale edit link, remove navigation) · **Basis:** source · **Confidence:** confirmed
**Evidence:** `usePhotoStore((s) => s.updated_at === null || s.updated_at < APP_STARTED_AT ? 'restored' : 'in-session')` is a restored-versus-new rule inside a selector in the View. Cat Form freezes `staleEdit` in `useState` and redirects in an effect; it also composes the `handleRemove` closure and the `returnToCatListAfterRemoval` ordering (the long #299/#203 comment).
**Fix:** `draftOrigin()` into `draft-submission/lib/` (or `useResumableDraft`); `useCatFormRoute(editId)` returning `{ existingCat, isStale, remove }`.

### MVVM-13 — P3: Components subscribe to raw store slices

**Where:** `src/features/annotate/components/AnnotateCarouselItem.tsx:77-80`, `src/features/annotate/components/InsetCropBubble.tsx:120-125`, `src/features/draft-submission/components/ProfilePicPicker.tsx:41-45`; `src/features/organizations/membership/components/MemberCard.tsx` types a prop as `ReturnType<typeof useMemberships>` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `const boxes = useBoundingBoxStore((s) => s.boxes)`, `useBoundingBoxStore((s) => s.catColors)`, `usePhotoStore((s) => s.photos)` — whole maps/arrays read in Views, followed by `previousCatBoxes(...)` / `photos.find(...)` derivations. `AnnotateCarouselItem` rerenders on any box change anywhere.
**Fix:** `usePreviousCatBoxes(catId, photoId)` and `useCatBubbleSource(catId)` in `annotate/hooks/`; give `MemberCard` a named prop type instead of the hook's return type.

### MVVM-14 — P3: Wrong home

**Where and what:**
- `src/features/organizations/membership/components/styles.ts` (generic `screen/content/footer` layout) is imported by `sharing/screens/SharedSightingsScreen.tsx:20`, contradicting "membership … without importing sharing" symmetry. Two sub-features need it, so it belongs in `organizations/components/styles.ts`.
- `src/features/draft-submission/screens/location-picker/usePinCenter.ts` is a ViewModel (with a service call) inside `screens/`; it cannot be shared or imported by a non-screen.
- Whole-draft operations live in `hooks/` while the other draft rules live in `lib/draft.ts`: `removePhotoFromDraft.ts` (three stores plus upload cancellation/deletion), `catPass.ts` `removeCatFromDraft`/`startFreshPass` (three stores). They are Model code in the ViewModel folder; each is "the one way" but none sits behind `draft.ts`'s seam or has an invariant test like `draft.invariant.test.ts`.
- `src/features/organizations/components/OrganizationsRuntime.tsx` is a headless effect component (returns `null`); it is a ViewModel and belongs as a hook (`useOrganizationsRuntime`) called from `AppProviders`.
- `src/features/organizations/hooks/useOrganizationsFlag.ts` (134 lines) is a Zustand store that also does consent gating, PostHog `fetch`, AsyncStorage cache read/write and `JSON.parse` cache validation inline. Move the cache policy and request into `organizations/lib/flagEvaluation.ts`; keep the store thin.

### MVVM-15 — P3: Convention gaps that lint and the architecture test do not catch

**Where:** `src/shared/types/index.ts` (barrel, 22 importers), `src/shared/types/Organizations.ts:2` (`export * from '@/functions/src/organizations/domain'`, a value re-export), `@/functions/src/organizations/{domain,membership/domain,interactions/domain}` imported from 9 client files · **Basis:** source · **Confidence:** confirmed
**Evidence:** PROJECT_STRUCTURE: "No barrel (`index.ts` re-export) files … convention only". `shared/types/index.ts` is `export type * from './Api'` etc. (type-only, so no Metro cost, but still a barrel). The client importing server `domain.ts` modules (pure, no firebase-admin today) is the right idea but is documented nowhere and not linted; one stray `@/functions/src/organizations/store` import would bundle `firebase-admin` into the app. ESLint also has no rule for sub-feature peers or for `modules/` -> `src/`.
**Fix:** add a `no-restricted-imports` pattern for `@/functions/**` except `**/domain` and `**/errors`, plus `@/src/**` in `modules/**`; add the cases to `__tests__/architecture.test.ts`; document the client-reads-server-domain seam in PROJECT_STRUCTURE; list `shared/types` as an exempt type-only barrel or import the defining files.

### MVVM-16 — P3: `functions/src/index.ts` is a controller file holding rules

**Where:** `functions/src/index.ts:88-104` (`syncSubmissionCapClaim`), `:188-276` (sweep: grouping, cutoff, concurrency), `:65-75` (allowlist parse) · **Basis:** source · **Confidence:** confirmed
**Evidence:** `export const sweepPhotosWithoutMetadata = onSchedule({...}, async () => { const bucket = getStorage()...; ... prefixes.set(prefix, entry) ... })`. The newer server modules (`erasure/eraseAccount.ts` with `ErasurePorts`, `uploads/admission.ts`, `organizations/*`) separate pure rules from adapters; this file does not, so tests have to import the whole trigger file and stub three `firebase-admin` modules.
**Fix:** `uploads/orphanSweep.ts` exporting `selectOrphanedObjects(files, now): string[]` (pure) plus a thin storage adapter; keep `index.ts` as registration only.

### MVVM-17 — P3: `.claude/useeffect-audit.md` is stale

**Where:** `.claude/useeffect-audit.md` · **Basis:** source · **Confidence:** confirmed
It names `src/hooks/usePhotoSession.ts`, `src/hooks/useSettingsDraft.ts`, `src/screens/submission/create/index.tsx` and `useAnnotateStateMachine.ts:82`; none exists after the 2026-11-01 feature-folder migration (the annotate clamp is now done during render in `useAnnotatePass`, and `registerCapture` is now once in `AppProviders`' `AnalyticsBridge`). Current effects I read in hooks are legitimate subscriptions, async loads with cancellation, or one-shot navigation (`useCatListLanding`, `useEntryGate`); the one effect-as-event-handler candidate is `useNoPhotosPrompt.ts:65-75` (handed off to the logic lens). Refresh or delete the file so agents do not follow dead paths.

## Test findings

### MVVM-T-1 — P2: The native capture ViewModel has no test of the capture loop

**Where:** `src/features/camera-control/hooks/useNativeCameraCapture.tsx:169-285` · **Basis:** test-read · **Confidence:** confirmed
Only `useNativeCameraCapture.focus.test.ts` (two cases, `focus` and `applySubjectRegion`) and `CameraScreen.permissionGate.model.test.tsx` touch this hook or screen; a grep for `useNativeCameraCapture|NativeCameraScreen` across all `*.test.*` finds only those two. The legacy path has `useCameraCapture.test.ts` and `.controls.model.test.ts`.
**Coverage gap:** `handleTakePhoto` (limit check, `isTakingPhotoRef` latch, `persistCapturedPhoto`, upload start, `finally` -> `flushGallerySaves`, failure telemetry) is the primary capture path whenever the native module is available. Realistic regressions nothing catches: the latch not released after a postprocessor throw (second tap does nothing), a missing `flushGallerySaves` (photos not reaching the gallery), the photo limit not blocking a capture.
**Fix:** a hook test with real `usePhotoStore`/`useSettingsStore`, a fake `cameraRef.capture`, and `useCapturedPhotoWorkflow` unmocked, driving capture, a throwing capture, and the limit.

### MVVM-T-2 — P3: A test exercises a ViewModel function no View calls

**Where:** `src/features/camera-control/hooks/__tests__/useNativeCameraCapture.focus.test.ts:26` · **Basis:** test-read · **Confidence:** confirmed
`applySubjectRegion` is returned by the hook but has no non-test caller (`grep -rn applySubjectRegion src` -> hook and test only). The case "forwards a subject clear while disabled, but refuses a new subject region" passes forever whatever the UI does. Delete the case with the dead export (testing.md: unreachable branch).

### MVVM-T-3 — P3: Tap-to-focus normalization lives in the View and no test reaches it

**Where:** `NativeCameraScreen.tsx:75-79` (see MVVM-10) · **Basis:** test-read
The only screen test is the permission gate. A mutation such as `y: event.y / width` or removing the zero-size guard passes the whole suite. Moving the math into the hook (MVVM-10) lets a plain hook test cover it.

### MVVM-T-4 — P3: Cat Form's stale edit link is untested

**Where:** `src/features/draft-submission/screens/cats/index.tsx:36-43` · **Basis:** test-read
The screen suite is one file (`CatObservationScreen.insetCropHeaderZone.test.tsx`, scroll-lock layout only); `flow.catPass.test.tsx` covers "removing a cat from an edit" but not an `?edit=<id>` for a removed cat. The comment says the failure is a silent new cat on Save. A mutation that drops the `staleEdit` freeze passes.

### MVVM-T-5 — P3: Application stores and hooks mocked in screen tests

**Where:** `src/features/draft-submission/screens/cats/__tests__/CatObservationScreen.insetCropHeaderZone.test.tsx:12-31` (`jest.mock` of `useSubmissionStore` with `sel({ cats: [] })`, `useActiveCatFlow`, `useCatSubmit`, `useAbandonCatGuard`); `src/features/annotate/screens/annotate/__tests__/AnnotateScreen.buttons.test.tsx:36-47` (mocks `useTutorialStore` and all of `useAnnotatePass`) · **Basis:** test-read
These are wiring checks and the policy allows isolating a separately tested hook, but both also replace application *stores* with selector stubs; zustand's per-test reset in `jest.setup.js` makes real stores free. The Annotate fixture also has to supply `clearActiveCat` and `handleAbandonPass`, which the screen never uses (a leaky-interface symptom, MVVM-7/13). `jest.spyOn(buttonRowStyles, 'useVariants')` asserts style-variant calls rather than rendered behavior.

### MVVM-T-6 — P3: `confirmResetSubmission.test.ts` bypasses `pressDialogButton`

**Where:** `src/features/draft-submission/hooks/__tests__/confirmResetSubmission.test.ts:66-67` · **Basis:** test-read
```ts
await dialog?.buttons.find((b) => b.text === 'Start New')?.onPress?.()
```
testing.md requires `pressDialogButton(text)` from `src/test-utils/dialog.ts` (AlertHost's own dismiss-then-handler path); many sibling files use it. The same file mocks all of `lib/draft` (`discardDraft: jest.fn()`), so "clears the draft" is asserted as "mock called"; the real teardown is covered by `draft.invariant.test.ts`, which is acceptable, but then the case should say it covers wiring only.

### MVVM-T-7 — P3: Orphan-sweep rule only tested through the trigger with hand-rolled admin mocks

**Where:** `functions/src/__tests__/index.test.ts:2-24,158-209` · **Basis:** test-read
Cases drive `sweepPhotosWithoutMetadata.run(...)` with `jest.mock` of `firebase-admin/app|auth|storage`. The orphan-selection rule (no metadata, older than 7 days, per uid/submission prefix) is Model logic; extracting it (MVVM-16) makes it a table test with no mocks and leaves one thin adapter test.

### MVVM-T-8 — P3: `fetch` replaced by assignment in the upload-admission test

**Where:** `src/features/draft-submission/lib/upload/__tests__/firebaseUpload.behavior.test.ts:39` · **Basis:** test-read
`global.fetch = admission as unknown as typeof fetch` instead of the suite's MSW `server` (`src/test-utils/mswServer`, used correctly by `organizationsFlag.test.ts`). It covers `uploadAdmission.ts`, which also bypasses `authProvider` (MVVM-5).

### MVVM-T-9 — P3: Architecture test omits the rules that are only convention

**Where:** `__tests__/architecture.test.ts:1-146` · **Basis:** test-read
No case covers sub-feature isolation (membership/sharing/interactions), `modules/` -> `src/`, or the `@/functions/` import seam (MVVM-15). Its `organization` fixture path `src/features/organizations/lib/consent.ts` no longer exists (the module moved to `sharing/lib/consent.ts`); it still passes because ESLint matches by path, but the fixture should name a real file.

## Handoffs

- `duplication`: `src/features/history/hooks/useFeralReports.ts:49-63` and `src/features/draft-submission/hooks/useResumableDraft.ts:26-39` both read `getAllSubmissionCaches()`/`getCurrentCacheId()` and call `isResumableDraft(caches[0], Date.now(), currentId)`; `useFeralReports.ts:79-102` duplicates `read()` in its mount effect.
- `duplication`: telemetry property block repeated in `useNativeCameraCapture.tsx` (MVVM-7) and near-duplicated in `useCameraCapture.tsx:298-330`; `if (__DEV__) console.log('[location] consent hydrated:' ...)` in both camera hooks (`useNativeCameraCapture.tsx:311`, `useCameraCapture.tsx:336`).
- `duplication`: contact-field `maxLength` literals (MVVM-8); inline `toLocaleDateString()` in `SubmissionOrganizations.tsx:105` vs `formatDateTime`/`formatInlineDateTime`.
- `logic`: `useNoPhotosPrompt.ts:65-75` (effect latched by `pending` ref reacts to a store change instead of the removal action); `useDraftSync.ts:83-100` (mount-once effect with `eslint-disable react-hooks/exhaustive-deps` closing over the first-render `submission`); `LeaveChoices.tsx:48-52,205-215` (`reviewed` depends on `email` equality; `onLeave` failure clears `review` but not `keep`).
- `navigation-ui`: `src/features/history/components/ReportCard.tsx:84-86` navigates with literal routes from a component; `create/index.tsx:51` `LOCATION_PICKER_ROUTE` duplicates the route constants `catPass.ts` centralizes; `MembershipsScreen.tsx:56-63` builds `headerRight` inline.
- `aesthetics-tokens`: hardcoded user-facing copy outside `config/text.ts`: `camera/index.tsx:20-26`, `LegacyCameraScreen.tsx:20-30,115-130`, `NativeCameraScreen.tsx:142` (`'Capture photo'`), `annotate/index.tsx:69,77` (`'Remove photo'`, `'Long press to remove.'`), `settings/index.tsx:165` (`Organizations`), `create/index.tsx` (`Sighting`, `Reset`, `Location`, `Cats Recorded`, `Describe at least one cat…`), `ReportCard.tsx` (`None`, `Cats:`, `photo(s)`), `feralReports/index.tsx`, `sightingDetail/index.tsx`, `location-picker/index.tsx`, `useAnnotatePass.ts`, `useCatSubmit.ts`, `useRemoveCat.ts`, `useConsentPermissions.ts` alert strings; literal `opacity: 0.5` and `0.16`/`0.12` fractions in `home/index.tsx` (`EntrypointCircle`, `ViewfinderCorners`).

## Not reviewed

- Native code, `android/`, `ios/` (generated; no JS check reads them), web, assistive tech.
- Visual/token/copy quality (handed off above), logic bugs beyond what MVVM placement exposed, navigation correctness.
- `src/features/annotate/hooks/useBoundingBoxFrame.ts` gesture internals (466 lines, Reanimated worklets), `InsetCropBubble` drag math, `SightingsMap`, `SortableList`, `DateTimePicker`, `GlassSurface`: judged view-intrinsic; only their store reads were checked.
- `functions/src/organizations/*` internals beyond the entry seam (store/ledger/permissions): server-side Model, no View/ViewModel concerns.
- Test suites not named above (about 150 files) were scanned by `jest.mock` target and by subject only. No tests were run (`node_modules` absent).
- `docs/adr/0006-submission-draft-boundary.md` was read in full; the other ADRs and `ui-ux/current-state/` were not opened because no finding contradicts a UI decision record.
