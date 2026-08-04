# Platform-dependent consent management — implementation plan

Issue: #12 ("Consent screen"). Branch: `matthewdmanning/issue12`.

## Context

The app-level disclosure screen (register → `/consent` → home-tabs, `src/screens/consent/`) already
ships. That screen is platform-*independent* — an AsyncStorage flag (`src/lib/consent.ts`) plus a
static "I Agree" gate. What it does *not* yet handle is the platform-dependent layer underneath it:
the actual OS camera/photo-library permission grants that "I Agree" is supposed to trigger. Two
distinct consents exist and must not be conflated:

|Layer|What it is|Platform-dependent?|
|-|-|-|
|Data-collection disclosure|User agrees FeralSpotter collects photos/GPS/details/Google account|No — AsyncStorage flag, same copy, both platforms|
|OS permission grant|Camera / photo-library access actually granted by iOS or Android|Yes — different config, prompts, denial recovery per OS|

This plan covers the second layer, and switches the codebase's permission check/request calls onto
`react-native-permissions` — a single unified API replacing three separate ad-hoc permission
surfaces currently in the codebase (vision-camera's own hook, `expo-media-library`'s
`requestPermissionsAsync`, `expo-image-picker`'s `requestCameraPermissionsAsync`).

**No "ConsentManager" module.** `react-native-permissions` already *is* the unified permission
manager — `check()`/`request()`/`openSettings()` plus a `RESULTS` enum that includes `BLOCKED`
(the one thing the three existing libraries don't agree on). It's stateless by design; adding a
wrapper class around it that just forwards to `check`/`request` would be a facade with no behavior
of its own. The only thing that genuinely needs to persist is the disclosure-accepted flag, which
already exists (`src/lib/consent.ts`) and needs one addition: a version number, so the flag can be
invalidated later if the disclosure copy changes materially. Call sites use
`react-native-permissions` directly.

## Why react-native-permissions

Today, three libraries each expose their own permission status shape:

- `react-native-vision-camera` — `useCameraPermission()` → boolean `hasPermission`, no
  granted/denied/blocked distinction.
- `expo-media-library` — `requestPermissionsAsync()` → `{status, canAskAgain}`.
- `expo-image-picker` — `requestCameraPermissionsAsync()` → `{status, canAskAgain}`.

None of these agree on how to represent "permanently denied" (Android BLOCKED / iOS re-ask-never),
so denial recovery has to be hand-rolled per call site. `react-native-permissions` unifies this into
one `check()`/`request()` API returning `RESULTS.GRANTED | DENIED | BLOCKED | LIMITED | UNAVAILABLE`
plus a single `openSettings()`. It **replaces the permission check/request calls only** — the
capture/save/pick calls themselves stay on vision-camera / expo-media-library / expo-image-picker,
since react-native-permissions doesn't do camera capture or file I/O.

Not yet a dependency — add `react-native-permissions`.

## `src/lib/consent.ts` — persistence (unchanged shape, one addition)

Same AsyncStorage pattern as `src/lib/firstLaunch.ts`, still the only persisted consent state:

```ts
const KEY = "has_accepted_consent";
const CONSENT_VERSION = 1; // bump when disclosure copy changes materially

export async function hasAcceptedConsent(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return false;
  const { version } = JSON.parse(raw);
  return version === CONSENT_VERSION;
}

export async function markConsentAccepted(): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION }));
}
```

Persistence mechanism: on-device AsyncStorage key-value write. Survives app restarts and
backgrounding; cleared only by app uninstall or the user manually clearing app storage. Not synced
to any backend — registration (`registerUser()` in `src/screens/register/index.tsx`) is still a
placeholder stub with no server call, so a reinstall or new device always re-triggers consent. If a
server-backed account system lands later, this is the point where the flag would also need to sync
server-side rather than live only in AsyncStorage.

> **Note:** the accepted-consent record (flag + version + timestamp) should eventually be written to
> the cloud storage bucket alongside submission data, not just kept on-device — this is the
> auditable proof that a given user agreed to a given disclosure version, and on-device-only storage
> can't serve that purpose (lost on reinstall, unreadable by anyone but the device). Blocked on the
> same auth/backend work that's blocking Google sign-in (`src/lib/auth/index.ts` is still a stub) —
> tracked here, not built in this plan.

## `src/lib/permissions.ts` — small constants module (DRY, not a manager)

The only genuinely shared logic: mapping app-level permission names to platform-specific
`react-native-permissions` constants, so call sites don't each hand-roll `Platform.select`:

```ts
import { Platform } from "react-native";
import { PERMISSIONS, type Permission } from "react-native-permissions";

export type AppPermission = "camera" | "mediaLibrary";

export const PERMISSION_MAP: Record<AppPermission, Permission> = Platform.select({
  ios: {
    camera: PERMISSIONS.IOS.CAMERA,
    mediaLibrary: PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY, // add-only: saveToLibraryAsync only writes
  },
  android: {
    camera: PERMISSIONS.ANDROID.CAMERA,
    mediaLibrary: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES, // API 33+; older APIs don't need a runtime
                                                           // permission for MediaStore inserts
  },
})!;
```

Call sites import `check`/`request`/`openSettings`/`RESULTS` directly from `react-native-permissions`
and pass `PERMISSION_MAP.camera` / `PERMISSION_MAP.mediaLibrary`.

## Findings (verified via context7 docs + app.json read)

`app.json` `plugins` array currently has: `expo-router`, `expo-splash-screen`, `expo-secure-store`,
`@react-native-community/datetimepicker`. Neither vision-camera, expo-media-library, nor
expo-image-picker have explicit entries, and none of them will supply react-native-permissions'
`iosPermissions` Podfile wiring — that's a separate, required plugin entry.

1. **iOS `Info.plist` usage-description strings are missing entirely.** This is independent of
   which JS library calls `request()` — iOS ties the prompt to the `Info.plist` key, not the
   caller. Without `NSCameraUsageDescription` / `NSPhotoLibraryAddUsageDescription`, iOS terminates
   the app the moment any permission request fires. This is the one crash-risk item; fix first.

2. **`react-native-permissions` Expo plugin not yet added.** Needs an explicit plugins-array entry
   (`iosPermissions: ["Camera", "PhotoLibraryAddOnly"]`) so its config plugin wires the iOS Podfile
   `setup_permissions` step during prebuild.

3. **`expo-media-library` / `expo-image-picker` plugin entries become unnecessary.** Once all
   permission check/request calls route through `react-native-permissions`, these libraries are
   only used for their non-permission APIs (`saveToLibraryAsync`, `launchCameraAsync`,
   `launchImageLibraryAsync`) — no need for their own permission config plugins once
   `react-native-permissions` + manual `Info.plist` keys cover the same OS strings. Simpler
   `app.json`, one less place permission copy can drift out of sync with the consent screen.

## Plan

### 1. Add dependency + fix `app.json` (do first — the crash-risk item)

```bash
npx expo install react-native-permissions
```

Add to `app.json`:

```json
"ios": {
  "icon": "./assets/expo.icon",
  "infoPlist": {
    "NSCameraUsageDescription": "FeralSpotter uses your camera to capture cat sighting photos for the population-tracking dataset.",
    "NSPhotoLibraryAddUsageDescription": "FeralSpotter saves sighting photos to your library when \"keep photos on device\" is enabled."
  }
},
"android": {
  ...existing...,
  "permissions": ["android.permission.CAMERA", "android.permission.READ_MEDIA_IMAGES"]
},
"plugins": [
  "expo-router",
  ["react-native-permissions", { "iosPermissions": ["Camera", "PhotoLibraryAddOnly"] }],
  ...existing plugins...
]
```

Requires a new dev-client / prebuild — a JS-only change won't apply these to a running native
build. Verify via `npx expo prebuild --no-install` (generates `ios/`/`android/` — do not commit
them if the project doesn't already track native dirs; check `git status` after) and inspect
`ios/*/Info.plist`, `ios/Podfile` (for the `setup_permissions` block), and
`android/app/src/main/AndroidManifest.xml` for the injected keys.

### 2. Wire call sites onto `react-native-permissions` + `PERMISSION_MAP`

- `src/screens/consent/index.tsx` — `handleAgree` calls `request(PERMISSION_MAP.camera)` and
  `request(PERMISSION_MAP.mediaLibrary)`, plus `markConsentAccepted()`.
- `src/screens/camera/index.tsx` — replace vision-camera's `useCameraPermission()` gate with
  `check(PERMISSION_MAP.camera)` (live check on mount, same as today's `hasPermission` re-check)
  driving the same `styles.gate` UI; the `<Camera>` component itself is untouched.
- `src/hooks/useCameraCapture.tsx:130-132` — replace `MediaLibrary.requestPermissionsAsync()` with
  `check(PERMISSION_MAP.mediaLibrary)` before `saveToLibraryAsync` (drift check — covers the
  "revoked after consent" gap); only call `request` here if somehow still unrequested.
- `src/hooks/usePhotoSession.ts:105-110` — replace `ImagePicker.requestCameraPermissionsAsync()`
  with `check(PERMISSION_MAP.camera)` (already granted from the consent screen in the normal flow;
  this becomes a drift check, not a first-ask).

### 3. Android hardware back-button bypass (gate integrity bug)

`gestureEnabled: false` / `headerBackVisible: false` in `src/app/_layout.tsx` block iOS swipe-back
and the header button — they do **not** block Android's hardware/gesture-nav back button, which
still pops the `consent` route. Since navigation into consent used `router.replace`, a user who
backs out lands in the app fully un-consented.

Fix: reuse the existing `useBackHandler` pattern (already used in `src/hooks/usePhotoSession.ts`)
inside `src/screens/consent/index.tsx` — intercept hardware back and no-op instead of letting it
pop the stack.

### 4. `handleAgree` must branch on permission result, per platform

`RESULTS.BLOCKED` (Android: "don't ask again" / second denial; iOS: any denial, since iOS never
re-prompts) is where `openSettings()` is the only recovery path — `RESULTS.DENIED` means the OS may
still show its own prompt on a later `request()` call. On `BLOCKED`, show the same gate pattern
already built in `src/screens/camera/index.tsx` (`styles.gate`, "Open Settings" button) instead of
silently continuing to home. `markConsentAccepted()` still fires regardless of the OS-permission
outcome — that's the disclosure-acknowledgment layer, independent of whether the OS grant
succeeded; the OS-permission gate re-surfaces later (camera screen, photo picker) exactly as it
does today if the user never grants.

## Out of scope

- Settings-screen consent review/revoke UI — no persisted snapshot is built for it in this plan;
  such a screen would call `check()` live rather than reading cached state.
- Google-account consent — auth provider is still a stub (`src/lib/auth/index.ts`), nothing to gate
  yet.
- Live GPS capture — location *permission* (when-in-use only, requested from the consent screen
  alongside camera/media library — see `src/lib/permissions.ts`) is now in place, but no
  `expo-location` capture call exists anywhere in the codebase yet; GPS is still EXIF-only/passive
  from photo metadata. Wiring an actual `getCurrentPositionAsync()` call into the submission flow
  is separate follow-up work.

## Files touched

- `package.json` — add `react-native-permissions`
- `app.json` — infoPlist, android.permissions, plugins array
- `src/lib/consent.ts` — add `CONSENT_VERSION`
- `src/lib/permissions.ts` — new, `PERMISSION_MAP` constants only
- `src/screens/consent/index.tsx` — back-handler guard, direct `react-native-permissions` calls,
  branch on permission result, Settings fallback UI
- `src/screens/camera/index.tsx` — permission source swapped to `react-native-permissions`
- `src/hooks/useCameraCapture.tsx`, `src/hooks/usePhotoSession.ts` — permission source swapped to
  `react-native-permissions`, drift-checked instead of blindly re-requested

## Verification

- `npx expo prebuild --no-install` then inspect generated `Info.plist` / `Podfile` /
  `AndroidManifest.xml` for the new keys (don't commit native dirs unless the project already
  tracks them).
- Manual: fresh install → register → consent → deny camera → confirm Settings-fallback UI shows,
  not a silent continue.
- Manual: grant then revoke camera permission in OS Settings → open camera screen → confirm the
  gate re-triggers → take/save a photo path → confirm the media-library drift check surfaces an
  error instead of silently dropping the save.
- Android only: on consent screen, press hardware back → confirm it does not leave the screen.
