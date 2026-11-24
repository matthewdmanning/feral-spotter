# Code audit — duplication

Reviewed 2026-11-24 on `review/sonnet-code-audit` at `880c9b9`. Scope: `src/`, `functions/src/`, `modules/*/src/` (JS only), plus the tests that cover the findings. `node_modules` is absent, so everything is a static read; no test or typecheck result is claimed.

## Summary

- 0 P1, 11 P2, 9 P3 code findings (DUP-1 to DUP-20; DUP-16 and DUP-20 batch several small items); 5 test findings (2 P2, 3 P3). No user-visible bug came from duplication alone. The P2s are places where a change must be made in two or more spots by hand, and the copies have already drifted or will.
- Biggest copy-paste blocks: the capture lifecycle in the two camera hooks (DUP-1), the map frame/touch plumbing in the two sightings maps (DUP-2), the four edge-handle gestures in `useBoundingBoxFrame` (DUP-3), the sharing contact fields in `SharingSettings` and `LeaveChoices` (DUP-4), and the eight-field cat form (DUP-5).
- Parallel sources of truth: the cat shape (three type copies), the photo format table (three copies plus `storage.rules`), the bucket name (src vs `functions/`, "must match" comment, no test), sharing-field length limits (client literals vs server literals), and the `Stack` `screenOptions` (two copies that already differ).
- Hand-rolled library or kernel behavior: the PostHog `/flags` client (`useOrganizationsFlag`), a Zustand-style store done three times with `Set` listeners plus `useSyncExternalStore`, a query-like latest-wins store (`useOrganizationDirectoryStore`), and a local `checkbox` that re-implements `SharingCheckbox`.
- Dead duplicates: `PATTERN_OPTIONS`, `COLOR_OPTIONS`, `AUTOSAVE_*_MS`, `SHARING_FIELD_LABELS`, `OrganizationSyncError.retryable`.
- Tests: 2 policy breaks in `testing.md` (re-mocked `expo-crypto`, assigned `global.fetch`), plus duplicated setup across the four `useSubmissionSubmit.*` tests.

## Findings

### DUP-1 — P2: the capture lifecycle is written twice, one per camera backend

**Where:** `src/features/camera-control/hooks/useCameraCapture.tsx:137-153,218,245,268` and `src/features/camera-control/hooks/useNativeCameraCapture.tsx:178-187,250,253,277` · **Basis:** source · **Confidence:** confirmed
**Evidence:** both `handleTakePhoto` callbacks open with the same guard and start sequence and end with the same `finally`:
```
if (isAtPhotoLimit()) { showPhotoLimitReached(); return }
isTakingPhotoRef.current = true; setIsTakingPhoto(true); ... triggerFlash()
... startPhotoUpload() ... captureEvent(EVENTS.PHOTO_CAPTURE_FAILED, {error: ...})
finally { isTakingPhotoRef.current = false; setIsTakingPhoto(false); void flushGallerySaves() }
```
`useNativeCameraCapture`'s header says "Everything around a capture comes from useCapturedPhotoWorkflow, so the application workflow exists once rather than once per backend." The extraction stopped short: the guard, taking-photo flag, flash, error telemetry and gallery flush are still per backend. Also repeated inside this pair: the `performanceChecks ? Date.now() : null` timing, the `cameraOpenedAt` effect, and `Platform.OS === 'ios' ? 'avfoundation' : 'camerax'` four times in `useNativeCameraCapture.tsx` (lines 117, 160, 226, 260), and one 15-field telemetry spread repeated three times in that file (success, failure, device-ready).
**Human path / failure scenario:** a change to what "taking a photo" means (the burst or photo-limit rule, the flash order, the failure event) is made in one hook and not the other, so the Legacy and Native cameras diverge. Neither is tested as a pair.
**Fix:** move a `runCapture({ capture, onSuccess, failureProps })` wrapper into `useCapturedPhotoWorkflow` (the canonical module, same unit) that owns the limit check, flag, flash, `startPhotoUpload`, failure event and `flushGallerySaves`. Each backend passes only its capture call and its telemetry fields. Extract one `nativeTelemetryBase()` for the repeated spread.

### DUP-2 — P2: both sightings maps repeat the same frame, camera and touch plumbing

**Where:** `src/features/history/components/SightingsMap.tsx:102-112,155-160,163-168,172-181` and `src/features/organizations/sharing/components/SharedSightingsMap.tsx:44-52,76-81,82-87,92-100` · **Basis:** source · **Confidence:** confirmed
**Evidence:** identical in both:
```
const latitude = view?.coordinates.latitude / longitude / zoom
const cameraPosition = useMemo(() => latitude == null || longitude == null ? undefined : {coordinates:{latitude,longitude}, zoom}, [latitude, longitude, zoom])
const touchActiveChange = useRef(onTouchActiveChange); useEffect(() => { touchActiveChange.current = onTouchActiveChange }, ...)
useEffect(() => () => touchActiveChange.current?.(false), [])
const handleLayout = ({nativeEvent}) => { ... if (width !== size?.width || height !== size?.height) setSize(...) }
onTouchStart / onTouchEnd / onTouchCancel on the frame View
```
The two files already differ on a detail: one gates on `Platform.OS === 'android'` for icon loading, the other returns null off iOS/Android. The shared plumbing is what drifts.
**Human path / failure scenario:** a fix to the "scroll lock must not stay on after unmount" guard (a real bug class, per the comment in both files) lands in one map and the other keeps the stuck-scroll bug.
**Fix:** add `useMapFrame(points, onTouchActiveChange)` returning `{ cameraPosition, frameProps }` in `src/shared/hooks/` beside `shared/lib/mapView.ts` (which already owns `mapViewForSpots`). Both maps spread `frameProps` onto their `View`.

### DUP-3 — P2: four edge-handle gestures differ only by axis and sign

**Where:** `src/features/annotate/hooks/useBoundingBoxFrame.ts:313-405` (left, right, top, bottom handles) · **Basis:** source · **Confidence:** confirmed
**Evidence:** each handle is a 20-line `Gesture.Pan()` with the same `maxHalfExtentForBox → clampHalfExtent → clampAspectRatio` chain. The left and right handles differ only by `-`/`+ e.translationX`; top and bottom by `-`/`+ e.translationY`, and `width`/`height` swapped. The duplicate-block scan found 7 identical consecutive lines at 313/337 and 361/385.
**Failure scenario:** a tweak to the minimum or aspect limit is made to some handles and not others, so the box can be dragged thinner from one edge than another.
**Fix:** one `edgeHandle({ axis, sign })` factory in the same file; it returns the `Gesture.Pan()`. `clampTranslate` in `panClamp.ts:31` is the same body as `clampHalfExtent(value, -m, m)` in `boxResize.ts:11`; call the latter. The worklet-tagged copies are kept so far because worklets cannot call non-worklet code; both are `'worklet'` already, so one can call the other.

### DUP-4 — P2: the sharing contact fields are built twice; one copy re-implements `SharingCheckbox`

**Where:** `src/features/organizations/sharing/components/SharingSettings.tsx:56-93` and `src/features/organizations/membership/components/LeaveChoices.tsx:65-132` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `LeaveChoices.tsx:65` defines a local
```
const checkbox = (label, checked, change) => (<Pressable accessibilityRole="checkbox" ... <CheckboxBox checked={checked} /><Text style={styles.body}>{label}</Text>)
```
that is `SharingCheckbox` (`sharing/components/SharingCheckbox.tsx`) plus a `disabled` state. The name, phone and email blocks that follow repeat `SharingSettings` almost line for line, including the literals `maxLength={200}` and `maxLength={50}`.
**Failure scenario:** an accessibility fix to the checkbox (hit size, label) reaches `SharingSettings` only.
**Fix:** add an optional `disabled` prop to `SharingCheckbox` and use it in `LeaveChoices`. Extract `SharingFieldInputs({ settings, onChange, disabled, hideContact })` under `organizations/sharing/components/` and use it in both.

### DUP-5 — P2: the 8 cat attributes are still declared by hand in the form, despite `attributes.ts` being "the single source of truth"

**Where:** `src/features/draft-submission/hooks/useCatForm.ts:22-48,63-98,110-130`, `src/features/draft-submission/components/CatForm.tsx:31-80`, `src/features/draft-submission/lib/attributes.ts:1-9` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `attributes.ts` says its table is the one source for "defaults, labels, option lists and key mapping; previously each was declared separately across 6 files and drifted". The form still has an 8-field `CatFormValues`, 8 setter signatures in `CatFormActions`, 8 `useState` calls, an 8-line clear, an 8-line return, and six `SegmentedControl` blocks in `CatForm.tsx` with hand-typed labels (`label="Age"`, `"Sex"`, `"Ear Tipped"`, `"Hair Length"`, `"Owned / Domesticated"`, `"Health"`) that equal `CAT_ATTRIBUTES[*].label`. `CatForm` also takes its option lists through `lib/formOptions.ts` (DUP-14), not the table.
**Failure scenario:** adding a ninth attribute needs edits in `Cat.ts`, `useSubmissionStore.ts`, `attributes.ts`, `useCatForm.ts` (five places), `CatForm.tsx`, `formOptions.ts`, `submissionCache.ts` and `Api.ts`. A renamed label shows in the summary and `describeCat` but not on the form.
**Fix:** drive the form from `CAT_ATTRIBUTES`: one `useState<Partial<CatFormValues>>` object with `setField(key, value)`, and map the table to controls (the coat pair stays a special case). Labels come from `FIELD_LABELS`.

### DUP-6 — P2: the photo format table exists in three forms, plus `storage.rules`

**Where:** `src/shared/utils/photoFormat.ts:8-22`, `src/features/draft-submission/lib/upload/firebaseUpload.ts:61-72`, `storage.rules:119` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `UPLOAD_PHOTO_EXTENSIONS = ['jpg','jpeg','png','heic','heif']`, `UPLOAD_PHOTO_MIME_TYPES = ['image/jpeg', ...]`, and `photoContentType` `switch (extensionOf(uri)) { case 'png': ... case 'heic': ... case 'heif': ... default: 'image/jpeg' }`. Three hand-synced lists of one fact. The contract test covers only the extensions against the rules.
**Failure scenario:** a new format (for example `webp`) is added to the extension list and the rules but not to `photoContentType`, so it uploads as `image/jpeg` and the rules reject the mismatch.
**Fix:** one `PHOTO_FORMATS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: ..., heic: ..., heif: ... }` in `photoFormat.ts`; derive the extension list, MIME list and `photoContentType` from it. Extend the contract test to read it.

### DUP-7 — P2: the storage bucket name is duplicated across `src/` and `functions/` with only a comment keeping them equal

**Where:** `src/features/draft-submission/lib/upload/firebaseUpload.ts:55` and `functions/src/index.ts:48-51` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `// Must match BUCKET_URL in src/.../firebaseUpload.ts (ADR-0005).` above `const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? 'project-e3d5659d-bc4f-438f-88c.firebasestorage.app'`. The submission-layout contract test pins the layout and caps (`submissionLayout.contract.test.ts`) but not the bucket.
**Failure scenario:** a bucket move updates the app only; `onObjectFinalized` triggers watch a bucket nobody uploads to, so the submission cap claim and late-erasure cleanup silently never run.
**Fix:** put the name in `src/shared/config/submissionLimits.ts` (no imports, already loaded by the rules lane) and add it to the contract test against `functions/src/submissionLayout.ts`, or read it from one env var in both. The same file shows `MAX_PHOTO_BYTES` (20 MiB) as a literal in `functions/src/organizations/sharing/api.ts:94` rather than importing `functions/src/submissionLayout.ts:58` (P3, see DUP-20).

### DUP-8 — P2: sharing contact-field length limits are literals on both sides, unlike the other shared limits

**Where:** `functions/src/organizations/api.ts:55-57`, `src/features/organizations/sharing/components/SharingSettings.tsx:75,92`, `src/features/organizations/membership/components/LeaveChoices.tsx:114,126` · **Basis:** source · **Confidence:** confirmed
**Evidence:** server `settings.name.length > 200`, `settings.phone.length > 50`; client `maxLength={200}` and `maxLength={50}` twice each. The same module family shares `MEMBER_NAME_MAX_LENGTH` and `COMMENT_MAX_LENGTH` from `functions/src/organizations/*/domain` and imports them into the app. `MembershipsScreen.tsx:106` also hardcodes the invite-code `maxLength={32}` that `membership/service.ts:31` fixes with `{32}` in a regex.
**Failure scenario:** the server limit is lowered; the app still lets the user type 200 characters, then the save fails with a generic "invalid" error.
**Fix:** export `SHARING_NAME_MAX_LENGTH`, `SHARING_PHONE_MAX_LENGTH`, `INVITE_CODE_LENGTH` from `functions/src/organizations/domain.ts` and import them in both places, as the existing limits are.

### DUP-9 — P2: the root and submission `Stack` share a hand-copied `screenOptions` block that has already drifted

**Where:** `src/app/_layout.tsx:70-87` and `src/app/submission/_layout.tsx:63-81` · **Basis:** source · **Confidence:** confirmed
**Evidence:** both set `headerStyle`, `headerTintColor`, an identical `headerTitle` render (`<Text style={[theme.textVariants.heading, {color: tintColor}]}>`), `headerShadowVisible: false`, `contentStyle`, `animation: 'slide_from_right'`, `gestureEnabled: true`. They differ only in `headerTitleStyle`: root uses `{ fontFamily: theme.fonts.bold, fontSize: theme.typography.lg, color }`, submission uses `{ ...theme.textVariants.heading, color }`. That is drift, not design.
**Failure scenario:** header title styling changes in one place; the submission flow's header no longer matches the rest of the app.
**Fix:** one `stackScreenOptions(theme)` in `src/shared/lib/navigation.ts` (or a sibling `shared/ui/` helper), used by both layouts. Navigation behavior itself belongs to the navigation-ui lens (see Handoffs).

### DUP-10 — P2: Organizations feature flag re-implements a PostHog flags client by hand

**Where:** `src/features/organizations/hooks/useOrganizationsFlag.ts:25-120` · **Basis:** source · **Confidence:** plausible (an intentional constraint may exist)
**Evidence:** the hook reads `Constants.expoConfig?.extra?.posthogProjectToken/posthogHost` (also read at `src/providers/AppProviders.tsx:63-66`), mints and stores its own `distinct_id` (`organizations-flag-installation`), POSTs `${host}/flags/?v=2`, parses the reply, caches `{enabled, checkedAt}` for 24 h in AsyncStorage and applies a 10 s `AbortSignal.timeout`. `posthog-react-native` and `@posthog/core` are installed dependencies and `PostHogProvider` is already mounted after consent. `docs/implementations/2026-11-21-issue-484-feature-flags.md` rejects PostHog flags for the build-time flags (provider only mounts post-consent) but does not cover this second, consent-gated mechanism. The repo now has two flag systems (`FEATURE_FLAGS` and this one), and the consent gate (`hasAcceptedConsent() && hasAcceptedAnalytics()`) is a second copy of `shouldCapture()` in `shared/analytics/analytics.ts:79`.
**Failure scenario:** the SDK's own flag cache and this hand-rolled cache disagree about a rollout, or the `/flags` payload changes shape and this parser alone breaks.
**Fix:** decide per `docs/adr/`: either use the SDK's `getFeatureFlag` / `reloadFeatureFlagsAsync` inside the consented `PostHogProvider`, or document the constraint (flag needed before the provider mounts) in an ADR and move the client into `src/shared/analytics/` next to `shouldCapture`. This needs a decision, not a mechanical change.

### DUP-11 — P2: three module-level stores hand-roll `listeners = new Set()` + `useSyncExternalStore`, outside Zustand

**Where:** `src/core/location/liveFix.ts:66,196-214`, `src/features/draft-submission/lib/draft.ts:66-82`, `src/features/draft-submission/lib/upload/uploadNewPhoto.ts:58-72` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `liveFix.ts`: `const listeners = new Set<() => void>()` plus `setState`, `subscribeLocationCapture`, `getLocationCaptureState`, `useSyncExternalStore(...)`. `draft.ts`: `let busy`, `busyListeners`, `setBusy`, `subscribeDraftBusy`, consumed with `useSyncExternalStore(subscribeDraftBusy, isDraftBusy, isDraftBusy)` in `useSubmissionSubmit.ts:45`. `uploadNewPhoto.ts`: `idleListeners`, `onQueueChange`, `notifyQueueChange`. Zustand is the app's store library. `jest.setup.js` resets every Zustand store after each test, so these three need bespoke resets (`__resetLocationCaptureForTests`, `resetHeldUploadGrants`).
**Failure scenario:** a test that forgets the manual reset leaks `busy` or the last fix into the next test.
**Fix:** `create<LocationCaptureState>()` and `create<{ busy: boolean }>()`; keep the timers and the generation counter as module variables. The `useX` hooks become selectors; `subscribe` comes free. The upload queue can expose `useUploadQueueStore` the same way.

### DUP-12 — P3: three organization queries repeat the same visibility-scoped query recipe

**Where:** `src/features/organizations/hooks/useOrganizationPager.ts:31-48`, `src/features/organizations/membership/hooks/useMemberships.ts:50-83`, `src/features/organizations/interactions/hooks/usePinInteractions.ts:67-87` · **Basis:** source · **Confidence:** confirmed
**Evidence:** each builds `['organizations', uid, ...]`, calls `useVisibleQueryScope(key, !!uid && online && ...)`, then `useQuery({ queryKey, enabled: visible, gcTime: 0, refetchInterval/staleTime: ORGANIZATION_REFRESH_INTERVAL_MS, queryFn: ({signal}) => organizationRequest(..., uid, {signal}) })` with a hand-made shape check.
**Fix:** `useOrganizationQuery({ key, request, parse, enabled })` in `organizations/hooks/`; the three become thin callers. `useOrganizationDirectoryStore` (`useOrganizationDirectory.ts:28-67`) also hand-rolls what TanStack Query provides here: a `latestRefresh` counter so only the newest request lands, plus `loading` / `refreshFailed`. It differs by persisting offline, so it may stay; note it and keep the reason in the file.

### DUP-13 — P3: `SharedPhoto` re-implements a query with `useEffect`, `AbortController`, `active` flag and a retry counter

**Where:** `src/features/organizations/sharing/screens/SharedSightingsScreen.tsx:40-80` · **Basis:** source · **Confidence:** plausible
**Evidence:** `useState('')` for image and error, `const [attempt, retry] = useState(0)`, an effect that builds an `AbortController`, calls `organizationRequest`, and guards every setter with `if (active)`. This is `useQuery({ gcTime: 0, ... })` with `refetch` for retry. The "one at a time" loading order is the only part TanStack does not give; keep it in `SharedPhotos`.
**Fix:** `useQuery` with `enabled` driven by the `settled` count.

### DUP-14 — P3: `formOptions.ts` is a pass-through layer with two dead exports and a cast

**Where:** `src/features/draft-submission/lib/formOptions.ts:23-47` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `PATTERN_OPTIONS` and `COLOR_OPTIONS` have no consumers (the scan found none outside the file; `CatForm.tsx` imports six options plus `COAT_GROUPS`). `CAT_DEFAULTS` and `COAT_GROUPS` are re-exports of `attributes.ts`. `optionsFor` uses `as unknown as AttributeOption<T>[]`. The header path (`lib/cats/formOptions.ts`) is stale.
**Fix:** delete the file; `CatForm` imports from `attributes.ts` (or is driven by the table, DUP-5). Move `shownCoatValue` next to `COAT_GROUPS`.

### DUP-15 — P3: the same normalised-box shape is declared five times

**Where:** `src/shared/types/BoundingBox.ts:9`, `src/shared/lib/geometry/cropProjection.ts:33` (`NormalisedBox`), `src/shared/lib/geometry/imageRect.ts:8` (private `NormalisedBox`), `src/shared/lib/submissionCache.ts:57` (`CachedProfileBox`), `src/shared/types/Api.ts:43-48` · **Basis:** source · **Confidence:** confirmed
**Fix:** define `NormalisedBox` once in `shared/types/BoundingBox.ts`; `BoundingBox extends NormalisedBox`; the others import it. The same goes for the cat fields (`ObservedCat` in `useSubmissionStore.ts:29`, `CachedCat` in `submissionCache.ts:39`, `SubmissionApiPayload['cats']` in `Api.ts:28`): derive the string-valued ones with `Omit<ObservedCat, ...>` so a new field appears once. The latitude/longitude pair is likewise declared as `MapPoint`, `SpotCoordinates`, `SubmissionLocation`, `CapturedLocation` and `DirectoryCache` fields; `MapPoint` (lowest level) should be the one.

### DUP-16 — P3: a handful of copies sit inside one file or one family

**Where / Fix:**
- `src/shared/lib/mapView.ts:37` and `src/features/history/lib/history.ts:46` both define `const toRad = (deg) => (deg * Math.PI) / 180`; `functions/src/organizations/domain.ts:181` inlines the same. Export `toRad` from `mapView.ts` (lower level) for the first two.
- `src/features/draft-submission/lib/upload/submissionLayout.ts:33-45,47-58`: `photoObjectPath` and `rawPhotoObjectPath` repeat the same 5-line slot check and error text. Extract `assertSlot(slot)`.
- `src/features/permissions/hooks/useConsentPermissions.ts:59,90`: `markAccepted(); router.replace(routeAfterDeviceConsent())` twice. Extract `acceptAndContinue()`.
- `src/features/annotate/hooks/useAnnotatePass.ts:95-104,113-122`: the "scroll to next photo else finish" block is in both `handleConfirmBox` and `handleNotInPhoto`. Extract `advance()`.
- `src/features/auth/screens/register/index.tsx:62-72` and `src/features/auth/screens/sign-in/index.tsx:60-70`: the email `TextField` (7 props) and password field are identical. Extract an `EmailField` in `features/auth/components/`.
- `functions/src/organizations/membership/service.ts:170-176,188-194`: the "remove `exit` if still ours" updater is written twice. Name it once.
- `functions/src/organizations/store.ts:78-82,118-122`: the `updating` check and its "Please retry." text appear in `readCatalog` and `readOrganization`.

### DUP-17 — P3: the `code` error accessor and the Firebase `user-not-found` swallow are copied in `functions/`

**Where:** `functions/src/uploads/adapters.ts:25`, `functions/src/organizations/errors.ts:16`, `functions/src/index.ts:113`, `functions/src/erasure/adapters.ts:68` · **Basis:** source · **Confidence:** confirmed
**Evidence:** `const code = (error) => (error as {code?: unknown} | null)?.code` is `errorCode` verbatim; `if ((error as {code?: string}).code === 'auth/user-not-found') return` is written twice.
**Fix:** move `errorCode` to `functions/src/errors.ts` (shared by `uploads/`, `erasure/`, `organizations/`) and add `ignoreUserNotFound(fn)`.

### DUP-18 — P3: the GCS read-at-generation / compare-and-set write exists three times

**Where:** `functions/src/uploads/adapters.ts:54-73` (`ledgerStore.read`), `:207-235` (`updateErasurePointer`), `functions/src/organizations/sharing/api.ts:91-100` · **Basis:** source · **Confidence:** plausible
**Evidence:** `getMetadata → Number(metadata.generation) → file(path, {generation}).download()` and `save(JSON.stringify(x), {resumable:false, contentType:'application/json', preconditionOpts:{ifGenerationMatch}})`, each with its own 404/412 handling and a retry loop capped by `LEDGER_WRITE_ATTEMPTS`. This is project-specific (GCS has no CAS library), so only a local helper is warranted.
**Fix:** `readJsonAtGeneration(file)` and `saveJsonIf(file, value, generation)` in `uploads/adapters.ts`, used by both stores.

### DUP-19 — P3: dead duplicates

**Where / Fix (delete each after a final grep):**
- `src/shared/config/constants.ts:126,129` `AUTOSAVE_TEXT_MS`, `AUTOSAVE_INSTANT_MS`: no references anywhere.
- `functions/src/organizations/domain.ts:429` `SHARING_FIELD_LABELS`: no references; the live labels are `organizationCopy.sharingSettings.shareFieldLabels` in `src/shared/config/text.ts:270`.
- `src/features/organizations/lib/api.ts:13` `OrganizationSyncError.retryable`: never read in `src/`. The server already sends `retryable` in its body; the client re-derives a different status list (`[0,408,429,502,503,504]` vs the server's `429||503`).
- `src/shared/config/unistyles.ts` `AppTheme` type export: no references.
- `src/features/draft-submission/lib/formOptions.ts` `PATTERN_OPTIONS`, `COLOR_OPTIONS` (see DUP-14).

### DUP-20 — P3: other small parallel definitions

**Where / Fix:**
- `functions/src/organizations/sharing/api.ts:94`: `20 * 1024 * 1024` where `MAX_PHOTO_BYTES` exists in `functions/src/submissionLayout.ts:58`. Import it.
- `src/shared/lib/storage.ts:29-33`: `asyncStorage` is a field-for-field pass-through of `AsyncStorage` (`getItem`/`setItem`/`removeItem`). Zustand's `createJSONStorage(() => AsyncStorage)` accepts it directly. Keep only if the seam is wanted.
- Emulator connect + "is it reachable" ping + identical error text in `src/features/auth/lib/firebaseAuthProvider.ts:66-79` and `src/features/draft-submission/lib/upload/firebaseUpload.ts:105-122`. Extract `connectEmulator(label, port, connect)` into `src/shared/lib/`.
- Hard-coded `'Open Settings'` at `src/features/permissions/screens/consent/index.tsx:37` and `src/features/library-picker/hooks/useLibraryPhotoPicker.ts:65` while `navigationCopy.openSystemSettings` exists (`src/shared/config/text.ts:30`).
- Hand-built plurals ("cat/cats", "photo/photos", "field/fields") at `SightingsMap.tsx:88,177`, `ReportCard.tsx:59`, `useSubmissionSubmit.ts:142-148`, `useCatSubmit.ts:125`, while `memberCountLabel` and `catCountLabel` do it through copy config (`one`/`other`). Route all through `formatCopy` plurals.
- `src/features/draft-submission/components/DateTimePicker.tsx:39-42` formats with `toLocaleDateString()` while `shared/utils/formatDateTime.ts` is the shared formatter (a different, en-US format). Confirm that is intended.
- Two camera-permission libraries read the same OS permission: `cameraPermission.ts` (VisionCamera) for consent and `NativeCameraScreen.tsx` (`ImagePicker.useCameraPermissions`). The adapter's header still says "camera/index.tsx's own live gate uses vision-camera's useCameraPermission()".
- Three `PermissionGate` adapters (`location`, `library`, `gallerySave`) share a check-then-request skeleton; only the `isUsable` and library calls differ. A `gate(get, request, isUsable)` factory would hold it. Low value; `camera` already differs by design.

## Test findings

### DUP-T-1 — P2: `draftUploads.test.ts` re-mocks `expo-crypto`

**Where:** `src/features/draft-submission/lib/upload/__tests__/draftUploads.test.ts:26-27` · **Basis:** test-read · **Confidence:** confirmed
**Evidence:** `jest.mock('expo-crypto', () => ({ randomUUID: () => \`id-${++mockId}\` }))`. `testing.md` ("Shared fixtures"): "`jest.setup.js` gives `expo-crypto`'s `randomUUID` real unique ids. Don't re-mock the module." The local mock also drops every other real export.
**Fix:** delete the mock and `mockId`; pin ids with `jest.mocked(randomUUID).mockReturnValue(...)` where a test needs a fixed id.

### DUP-T-2 — P2: `firebaseUpload.behavior.test.ts` assigns `global.fetch`

**Where:** `src/features/draft-submission/lib/upload/__tests__/firebaseUpload.behavior.test.ts:25-40` · **Basis:** test-read · **Confidence:** confirmed
**Evidence:** `global.fetch = admission as unknown as typeof fetch` with a hand-built `{ ok, status, json }` object cast to `Response`. `testing.md`: "Don't stub or assign `globalThis.fetch`"; answer with an MSW handler on `src/test-utils/mswServer.ts`. The cast also hides any real `Response` behavior the admission client relies on.
**Mutation it misses:** the code under test reading `response.headers` or `response.json()` differently would still pass.
**Fix:** `server.use(http.post(UPLOAD_ADMISSION_URL, ...))`; observe the request with `jest.spyOn(globalThis, 'fetch')` if the call arguments matter.

### DUP-T-3 — P3: four `useSubmissionSubmit.*` test files repeat the same mocks and seeding

**Where:** `src/features/draft-submission/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts:24-45`, `.inFlight.test.ts:26-50`, `.reset.test.ts:20-48`, `.submitFlow.test.ts:27-51` · **Basis:** test-read · **Confidence:** confirmed
**Evidence:** each re-declares the same `jest.mock` factories (`expo-router` router stub, `@/src/core/location/liveFix`, `@/src/features/draft-submission/lib/analytics`, `.../firebaseUpload`) and the same `useAuthStore.setState({ user: {uid:'uid-owner'}, isReady: true })` / `usePhotoStore.setState({ photos: [], source: null, submissionId: 'sub-1' })` / `useUIStore.setState({ dialog: null })` seeding. Each also has a local `cat(id)` and `photo(id)` wrapper around `observedCat` / `submissionPhoto`. `useSubmissionSubmit.reset.test.ts:29-34` also mocks `@/src/shared/lib/submissionCache` (the app's own storage module) although AsyncStorage's Jest mock is installed, so the cache write path under test is not real.
**Fix:** a `seedSubmittableDraft()` helper in `src/test-utils/` for the seeding; keep each `jest.mock` call in its file (they are hoisted per file) but let the cache run against the AsyncStorage mock. Fold `.reset` into `confirmResetSubmission.test.ts` if it only checks "cats and photos cleared".

### DUP-T-4 — P3: `summarizeCat.test.ts` hand-writes a full `ObservedCat`

**Where:** `src/features/draft-submission/lib/__tests__/summarizeCat.test.ts:10-22` · **Basis:** test-read · **Confidence:** confirmed
**Evidence:** `const cat = (patch) => ({ local_id: 'c', age: 'unknown', ear_tipped: 'unsure', ... })` where `observedCat` in `src/test-utils/catFixtures.ts` reads the defaults from `CAT_ATTRIBUTES`. A new required field means editing this literal as well. (`testing.md`: "Prefer the factories: one place to add a new required field.")
**Fix:** `observedCat({ ...patch })`.

### DUP-T-5 — P3: tests read the `showAlert` spy instead of pressing the dialog

**Where:** `src/features/permissions/screens/consent/__tests__/ConsentScreen.test.tsx:90,184,202`, `src/features/auth/screens/sign-in/__tests__/SignInScreen.test.tsx:48,82`, `src/features/draft-submission/hooks/__tests__/useCatSubmit.unsetFieldsWarning.test.ts:52,71,121`, `src/features/draft-submission/hooks/__tests__/useRemoveCat.test.ts:37,55` · **Basis:** test-read · **Confidence:** plausible
**Evidence:** `jest.spyOn(ui, 'showAlert').mockImplementation(() => {})` then `expect(ui.showAlert).toHaveBeenCalled...`. `testing.md` ("Dialogs"): "Don't read `showAlert` mock calls or stub `showAlert` to auto-press"; use `pressDialogButton`. "An alert was requested" would pass with the wrong dialog text or a button that does nothing. This overlaps the logic lens; it is listed here only because the spies stand in for the shared dialog host.
**Fix:** read `useUIStore.getState().dialog` or press via `pressDialogButton(text)` and assert the resulting store or route.

## Handoffs

- `aesthetics-tokens`: `src/shared/config/themes.ts:340-352,434-442` repeat `cameraBackground`, `flashEffect`, `onCamera`, `onCameraScrim`, `onCameraBorder` verbatim in the dark and light themes (the file's own comment says they are "the same color in both themes by design"); check whether a shared constant is wanted. Hard-coded `'Open Settings'` and the plural strings in DUP-20 are also copy-config questions.
- `navigation-ui`: `src/app/_layout.tsx:70` vs `src/app/submission/_layout.tsx:63` `headerTitleStyle` differ (DUP-9); whether that is deliberate belongs there. `src/shared/types/index.ts` is a re-export barrel while `PROJECT_STRUCTURE.md` forbids barrels (types only, so no runtime cost; confirm).
- `mvvm`: `src/features/draft-submission/hooks/useSubmissionSubmit.ts:80-115` runs Firebase Auth (`getAuth`, `reload`, `sendEmailVerification`) and verification alerts inside a hook, bypassing `authProvider`; `src/features/organizations/membership/hooks/useMemberships.ts:12` and `src/features/organizations/interactions/hooks/usePinInteractions.ts:22` import types from `@/functions/...` (shared contracts, fine) but `register/index.tsx:13` imports a constant the same way.
- `logic`: `src/features/permissions/hooks/useConsentPermissions.ts:36-37` calls `Location.requestForegroundPermissionsAsync()` directly instead of `locationPermission.request()`, so the "already granted" shortcut is skipped; `usePinInteractions.ts` feedback/receipt reconciliation (lines 100-190) is dense and shares state through refs, worth a trace.

## Not reviewed

- `android/`, `ios/`, Kotlin, Swift, web, and `modules/*/src/` internals beyond a type glance (no JS duplicates found there in the time allowed).
- Screen, route and navigation behavior; styles and tokens (other lenses).
- `docs/`, scripts and `__tests__/rules/` content other than where they pin a duplicated constant.
- Not every test file under `src/` was read: only the tests covering the findings above, plus a repo-wide grep for `global.fetch`, `jest.mock` of installed libraries, `showAlert` spies and local `photo`/`cat` factories. Nothing was run; `node_modules` is absent, so no pass or fail claim is made.
- The `functions/` emulator tests and `functions/src/**/__tests__`.
