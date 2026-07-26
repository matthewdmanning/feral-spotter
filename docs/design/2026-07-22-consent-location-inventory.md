# Consent/location/permission inventory — feral-spotter

State as of main @ `7bf883b` (post-merge, onboarding package removed, consent
architecture from PR #55 in place). Verified via
`grep -rn "PERMISSION_MAP|captureCurrentLocation|hasAcceptedConsent|useConsentStore|getForegroundPermissionsAsync|getCurrentPositionAsync|expo-location" src/`.

## Camera

| File | Line | What | Action |
|---|---|---|---|
| `src/lib/permissions.ts` | 10-27 | `PERMISSION_MAP.camera` mapping | declares |
| `src/screens/consent/index.tsx` | 24 | `request(camera)` | requests (consent gate) |
| `src/hooks/usePhotoSession.ts` | 109 | `check(camera)` before `launchCameraAsync` | checks |
| `src/hooks/useCameraAccess.ts` | 21, 36 | `check` on mount, `request` | checks/requests |
| `src/screens/camera/index.tsx` | 8 | consumes `useCameraAccess()`, gate UI | checks/gates |
| `app.json` | 13, 27, 50 | `NSCameraUsageDescription`, android permission, plugin entry | declares |

## Media Library

| File | Line | What | Action |
|---|---|---|---|
| `src/lib/permissions.ts` | 10-27 | `PERMISSION_MAP.mediaLibrary` mapping | declares |
| `src/screens/consent/index.tsx` | 25 | `request(mediaLibrary)` | requests (consent gate) |
| `src/hooks/useCameraCapture.tsx` | 141 | `check` then `saveToLibraryAsync` | checks, gates save |
| `app.json` | 14, 27, 50 | infoPlist/android/plugin entries | declares |

## Location

| File | Line | What | Action |
|---|---|---|---|
| `src/lib/permissions.ts` | 10-27 | `PERMISSION_MAP.location` mapping | declares |
| `src/screens/consent/index.tsx` | 26 | `request(location)` | requests (consent gate) |
| `src/lib/location.ts` | 12, 24, 29, 36 | `hasAcceptedConsent()` gate → `expo-location`'s `getForegroundPermissionsAsync`/`getCurrentPositionAsync` | consent-gated capture — never touches OS API without consent |
| `src/hooks/useCameraCapture.tsx` | 136 | `captureCurrentLocation()`, fire-and-forget on photo take | consumes |
| `src/hooks/usePhotoSession.ts` | 123 | `captureCurrentLocation()`, awaited on camera capture | consumes |
| `src/types/Location.ts` | 6 | `LocationObjectCoords` type import | declares (unused elsewhere — dead type, pre-existing) |
| `app.json` | 15, 27, 50 | infoPlist/android/plugin entries | declares |

## Disclosure flag (`src/hooks/useConsentStore.ts`)

| File | Line | What | Action |
|---|---|---|---|
| `src/hooks/useConsentStore.ts` | 23, 38-39 | `useConsentStore` (persisted, `accepted`/`acceptedVersion`), `hasAcceptedConsent()` plain check | declares + reads |
| `src/screens/consent/index.tsx` | 6, 14 | `markAccepted()` on Agree | writes |
| `src/providers/AppProviders.tsx` | 20, 31, 37 | gates `PostHogProvider` mount | reads (third-party library guard) |
| `src/lib/analytics/analytics.ts` | 16, 65 | gates `fireAnalyticsEvent` | reads (defense in depth) |
| `src/lib/location.ts` | 12, 24 | gates all location capture | reads |

## Removed (confirmed zero references remain)

Onboarding package from main's parallel effort (issues #37-44): `PermissionPrimer` components,
`/onboarding` route, `src/config/onboardingCopy.ts`, `dataAgreementAcceptedAt`-based consent store,
per-permission primer tracking (granted/declined/deferred), contextual re-priming in
`submission/create` and `submission/photos`.
