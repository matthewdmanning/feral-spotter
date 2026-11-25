# Privacy nutrition labels: data type mapping

Maps what the app collects to Apple's App Privacy questionnaire and Google Play's Data Safety form, so both stores declare the same facts. Doc only; no runtime behavior depends on it.

Transcription into App Store Connect and Play Console is manual human work. Table columns match each form's fields.

## Shared facts

- **Tracking (Apple):** No. No data is linked with third-party data for advertising, and none goes to data brokers. Facebook SDK auto-collection is off (below).
- **Service providers:** Firebase (Auth, Storage, Firestore, Functions), PostHog (analytics, Error Tracking) and EmailOctopus (email updates) process data on the app's behalf. Play does not count transfers to service providers as "sharing". Apple counts data collected by third-party partners as collected, so it appears below.
- **Encryption in transit (Play):** Yes. Firebase, PostHog and EmailOctopus are reached over HTTPS only.
- **Deletion (Play):** the `deleteAccount` callable (`functions/src/erasure/`) erases the account, Submissions, organization data and the email-list contact. No in-app entry point was found in `src/`. Play requires an in-app path and a web request path, so add both before declaring "Yes".
- **Optional choices:** usage analytics (`analyticsAccepted`) and email updates (`emailOptIn`) are separate opt-ins (`src/shared/consent/useConsentStore.ts`). Declining either never blocks the app.

## Apple App Privacy

| Data type        | Sub-type                                            | Linked to you?     | Purpose(s)                               | Evidence                                                                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------- | ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location         | Precise Location, Coarse Location                   | Linked to the User | App Functionality                        | `app.json` sets no `NSLocationDefaultAccuracyReduced`, so requests are precise. `src/features/permissions/lib/locationPermission.ts` accepts `ios.accuracy === 'reduced'`, so coarse fixes are used too. Live fix (`src/core/location/liveFix.ts`) and Photo EXIF GPS on Library picks feed the account-linked Submission location. |
| Photos or Videos | Photos or Videos                                    | Linked to the User | App Functionality                        | Camera captures and Library picks (`src/features/library-picker/hooks/useLibraryPhotoPicker.ts`, `exif: true`) upload to Firebase Storage (ADR-0005). Gallery save is write-only (`savePhotosPermission`).                                                                                                                          |
| User Content     | Other User Content                                  | Linked to the User | App Functionality                        | Cat details and Box Annotations (`src/features/permissions/copy/consentDisclosure.json`); comments and reactions on shared pins (`src/features/organizations/interactions/`, `functions/src/organizations/store.ts`).                                                                                                               |
| Contact Info     | Name, Email Address                                 | Linked to the User | App Functionality; Developer's Marketing | Account name and email from Federated Sign-In (Google, Apple, Facebook) or email Registration (`src/features/auth/lib/IAuthProvider.ts`). Name appears in organization rosters (`functions/src/organizations/membership/service.ts`). Email goes to EmailOctopus only after the email opt-in (ADR-0007, `functions/src/email/`).    |
| Identifiers      | User ID                                             | Linked to the User | App Functionality; Analytics             | Firebase UID. `syncPostHogIdentity` (`src/shared/analytics/posthogClient.ts`) sends it to PostHog via `identify(uid)`. PostHog's anonymous ID is a random per-install UUID, not a device-level ID.                                                                                                                                  |
| Usage Data       | Product Interaction                                 | Linked to the User | Analytics                                | `EVENTS` (`src/shared/analytics/analytics.ts`, 17 events), screen views by route pattern, and SDK lifecycle events (`captureAppLifecycleEvents`). Properties carry counts, statuses and settings; no email, name, coordinates or photo content. Opt-in only.                                                                        |
| Diagnostics      | Crash Data, Performance Data, Other Diagnostic Data | Linked to the User | Analytics; App Functionality             | Uncaught exceptions and unhandled rejections (PostHog `errorTracking`), handled failures via `reportError` with `error_source`, camera timing events, device model and manufacturer (`registerDeviceProperties`). Opt-in only.                                                                                                      |
| Facebook SDK     | — none collected —                                  | —                  | —                                        | `app.json`'s `react-native-fbsdk-next` block sets `isAutoInitEnabled`, `advertiserIDCollectionEnabled` and `autoLogAppEventsEnabled` to `false`.                                                                                                                                                                                    |

## Google Play Data Safety

| Data type                                         | Collected  | Shared                                  | Ephemeral processing | Required or optional        | Purpose(s)                            | Evidence                                                                                                                                                                                                                  |
| ------------------------------------------------- | ---------- | --------------------------------------- | -------------------- | --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location: Approximate location, Precise location  | Yes (both) | No — own Firebase backend               | No — persisted       | Required                    | App functionality                     | `expo-location`'s bundled manifest merges `ACCESS_COARSE_LOCATION` with `ACCESS_FINE_LOCATION`, so both must be declared. `locationPermission.ts` rejects coarse-only grants on Android (`android?.accuracy !== 'fine'`). |
| Photos and videos: Photos                         | Yes        | No — own backend                        | No — persisted       | Required                    | App functionality                     | `READ_MEDIA_IMAGES` (`app.json`); Library picks and camera captures upload to Firebase Storage.                                                                                                                           |
| App activity: Other user-generated content        | Yes        | No — own backend                        | No — persisted       | Required                    | App functionality                     | Cat details, Box Annotations, pin comments and reactions.                                                                                                                                                                 |
| Personal info: Name, Email address, User IDs      | Yes        | No — own backend and providers          | No — persisted       | Required                    | App functionality; Account management | Firebase Auth; organization rosters show the name.                                                                                                                                                                        |
| Personal info: Email address (email updates)      | Yes        | No — EmailOctopus is a service provider | No — persisted       | Optional (email opt-in)     | Developer communications              | `functions/src/email/`, ADR-0007. Double opt-in for unverified addresses.                                                                                                                                                 |
| App activity: App interactions                    | Yes        | No — PostHog is a service provider      | No — persisted       | Optional (analytics opt-in) | Analytics                             | Events and screen views (`src/shared/analytics/`). Linked to the Firebase UID.                                                                                                                                            |
| App info and performance: Crash logs, Diagnostics | Yes        | No — PostHog is a service provider      | No — persisted       | Optional (analytics opt-in) | Analytics; App functionality          | PostHog Error Tracking and `reportError`; camera timing events; device model.                                                                                                                                             |
| Device or other IDs                               | No         | No                                      | —                    | —                           | —                                     | Facebook SDK auto-collection off; PostHog's anonymous ID is per-install, app-generated. Re-check if any SDK adds an advertising ID.                                                                                       |

Apple's "Coarse Location" and Google's "Approximate location" are declared on both stores for different reasons. iOS uses reduced-accuracy fixes. Android declares Approximate because `expo-location` merges `ACCESS_COARSE_LOCATION`, even though the app rejects coarse-only grants.

## Re-audit when

- A permission is added to `app.json` (iOS `infoPlist`, Android `permissions`).
- A config plugin is added: its native manifest may merge permissions the app never declared.
- An event, property or super property is added in `src/shared/analytics/`, or a `reportError` call passes `extra`. Check for PII.
- PostHog options change in `src/shared/analytics/posthogClient.ts` (session replay, touch autocapture, `personProfiles`).
- A Facebook SDK auto-collection flag becomes `true`.
- A sign-in provider, account-linked model, or organization data type is added.
- `src/features/permissions/lib/locationPermission.ts` or `cameraPermission.ts` changes which accuracy or status is accepted.
- A new service provider receives user data.

## Open items before transcription

- Ship an in-app account-deletion entry point and a web request path, then declare deletion.
- Confirm PostHog's and EmailOctopus's DPAs restrict use to processing on the app's behalf; that is what makes "Shared: No" hold.

## Sources

- developer.android.com/privacy-and-security/declare-data-use (Play Data Safety guidance, including the service-provider exemption)
- developer.apple.com/app-store/app-privacy-details/ (Apple App Privacy guidance)
- Code reads: `app.json`, `node_modules/expo-location/android/src/main/AndroidManifest.xml`, `src/features/permissions/copy/consentDisclosure.json`, `src/features/permissions/lib/locationPermission.ts`, `src/features/library-picker/hooks/useLibraryPhotoPicker.ts`, `src/features/auth/lib/IAuthProvider.ts`, `src/shared/analytics/analytics.ts`, `src/shared/analytics/posthogClient.ts`, `src/shared/consent/useConsentStore.ts`, `functions/src/email/`, `functions/src/erasure/`, `functions/src/organizations/membership/service.ts`
