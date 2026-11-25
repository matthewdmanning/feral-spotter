# Backend / Firebase

Current state of this project's backend surface — Auth, Storage, uploads —
and which Firebase MCP resources and skills are approved to use. Ratified
design decisions live in `docs/adr/`; this file is the map to them plus the
bits not yet ratified.

Organization data and consent records use server-only Firestore (ADR-0008, ADR-0009). Submission metadata and photos remain in Cloud Storage; upload counts and limits retain their existing implementation.

## Current architecture

- **Auth**: Firebase Auth, Google + email/password live, Apple/Facebook
  version-gated off. See [ADR-0001](../adr/0001-firebase-auth-over-google-signin.md).
- **Photo uploads**: direct client upload via `@react-native-firebase/storage`
  to the project's default bucket (ADR-0005's 2026-10-04 amendment), path
  `submissions/{uid}/{submissionId}/{fileName}` (raw Firebase Auth uid, not
  a hash — see ADR-0005's 2026-08-16 amendment). See
  [ADR-0005](../adr/0005-firebase-storage-for-uploads.md).
- **Upload limits, no database for Submissions** (ADR-0005's 2026-11-03 amendment):
  - 10 photos per Submission: `storage.rules` accepts only the object
    names `photo-0` … `photo-9`; each photo's `upload_slot` names it. A
    slot holds one `photo-N.jpg` (any JPEG-family type, real type in
    `contentType`) and one `photo-N.dng` (#487).
  - Hard limits per person: every uid with the same verified email, through any
    sign-in method. They survive account erasure (#486, ADR-0005's
    2026-11-22 amendments):
    - 250 Submissions for life. Deleting refunds nothing.
    - 20 GiB / 5,000 live objects, summed over the person's uids.
  - Every client write (photos and `metadata.json`) needs the
    `uploadGrants` claim. Only the `admitPhotoUpload` function issues it,
    after counting the object. The app needs
    `EXPO_PUBLIC_UPLOAD_ADMISSION_URL`.
  - State: `upload-quota/persons/{personId}/ledger.json`, CAS-written.
    Pointers find the person by hashed uid and by an HMAC of the verified email
    (secret `UPLOAD_IDENTITY_KEY`). Erasure blocks new grants and preserves
    reservations for uploads still in flight. No address is stored.
  - `submissionCapReached` remains a soft per-uid claim check.
- **Final submission (cats + metadata)**: uploaded to Cloud Storage as
  `metadata.json` alongside the photos — see
  [ADR-0005](../adr/0005-firebase-storage-for-uploads.md). Not a database
  write. The client writes it to Storage, but only with an upload grant from
  `admitPhotoUpload`, like a photo.
- **Tester allowlist**: `gateTesterAllowlist` (`beforeUserSignedIn`) sets a
  tester claim at sign-in. `storage.rules` does not check it yet (#267).

## Live project can lag the repo

Rules and Functions reach the live project only by a manual
`firebase deploy`; no workflow deploys them. Before you trust a live drive,
compare the live state with the repo:

- `firebase functions:list` lists the deployed Functions.
- The Firebase Rules API (`firebaserules.googleapis.com/v1/projects/<project>/releases`)
  names the live Storage ruleset. Read it and compare it with `storage.rules`.

A repo rule that needs a deployed Function (for example the `uploadGrants`
claim from `admitPhotoUpload`) breaks every upload if the rule ships first.

## Test-drive posture: emulator by default

Test drives run against the **Firebase Local Emulator Suite**, not live
Firebase. Live-project test-driving risks real user data and produces
infrastructure-level errors that have nothing to do with the code under
test — a 412 bucket-permission error once cost a session's debugging time
at the wrong layer. Ports come from `firebase.json` as-is (Auth `9099`,
Storage `9199`, Functions `5001`, Firestore `8080`). The emulators load
the repo's `storage.rules`, not the live ruleset; the two can differ (see
"Live project can lag the repo").

From the repo root, install the Functions dependencies with
`npm ci --prefix functions` after the root `npm ci`. Select the same Firebase
project as the app's native configuration. On a fresh checkout, run
`npx firebase login` and `npx firebase use --add`, then select that project
and give it the `default` alias in the local `.firebaserc`. Use that project
ID in the upload admission URL below. The launcher uses the active Firebase
project, so if you previously switched projects, select the app's project
again with `npx firebase use default`.

Start the suite with `npm run emulators`. It builds `functions/`, then starts
Auth, Storage and Functions. Check that the Functions startup log shows the
app's project in the `admitPhotoUpload` URL.

Functions params follow the Firebase standard:

- Non-secret params (`defineString`): `functions/.env`, committed.
- Secrets (`defineSecret`): Secret Manager. The emulator reads them there
  too, unless `functions/.secret.local` overrides them. For local uploads,
  set `UPLOAD_IDENTITY_KEY` in that file to a separate local value and keep
  it stable across emulator sessions that share data.

Export these values in the shell that starts Expo. Shell values take
precedence over the GitHub values pulled into `.env.development.local`.

| Env var                              | Value                                                       | Notes                                                                                   |
| ------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_USE_FIREBASE_EMULATOR`  | `true`                                                      | Off by default, never inferred from `__DEV__`                                           |
| `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` | `localhost` (default)                                       | Use `10.0.2.2` on an Android emulator; `localhost` + `adb reverse` on a physical device |
| `EXPO_PUBLIC_UPLOAD_ADMISSION_URL`   | `http://<host>:5001/<project>/us-central1/admitPhotoUpload` | Photo and metadata uploads need a grant (#486)                                          |
| `EXPO_PUBLIC_DELETE_ACCOUNT_URL`     | `http://<host>:5001/<project>/us-central1/deleteAccount`    | Optional. Unset hides account deletion in Settings (#433)                               |
| `EXPO_PUBLIC_CONSENT_RECORDS_URL`    | `http://<host>:5001/<project>/us-central1/consentRecords`   | Optional. Unset keeps consent choices on the device (ADR-0009)                          |

On a physical Android device, tunnel the ports before you open the app:
`adb reverse tcp:9099 tcp:9099`, `adb reverse tcp:9199 tcp:9199` and
`adb reverse tcp:5001 tcp:5001`. The
tunnels are lost when the adb server restarts.

React Native Firebase changes `localhost` and `127.0.0.1` to `10.0.2.2` on
Android, unless `firebase.json` sets
`react-native.android_bypass_emulator_url_remap: true`. This repo sets it,
because `10.0.2.2` does not exist on a physical device. The SDK reads
`firebase.json` at build time, so rebuild the native app after you change it.
With the remap off, an Android emulator needs
`EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2` set explicitly.

### Verify the connection before a drive

1. Clear `EXPO_PUBLIC_AUTH_MOCK` and `EXPO_PUBLIC_UPLOADS_MOCK` for an
   end-to-end emulator drive. Check the shell and Expo env files.
2. Confirm that Expo's `EXPO_PUBLIC_UPLOAD_ADMISSION_URL` uses the emulator host,
   port and project from the table above. Auth and Storage are routed by the
   emulator flag. Upload admission uses its own URL.
3. Look for `[firebase] mode: emulator` in the app log. That line reports Auth
   mode. The Auth and Storage clients log failed emulator probes asynchronously.
   Storage connects on first use.
4. Use an emulator account with a verified email address for upload coverage.
   Upload admission rejects accounts with unverified emails. Check the
   emulator for both a photo and `metadata.json` before marking a
   capture-to-submit run as passed.

### Mock flags for UI work

- `EXPO_PUBLIC_AUTH_MOCK=true` stubs sign-in in debug builds.
- `EXPO_PUBLIC_UPLOADS_MOCK=true` skips the `metadata.json` write, photo
  metadata updates, and photo deletion. Photo byte uploads still use
  Firebase Storage and request an admission grant.

Use the emulator path above to validate sign-in, photo uploads, and Storage
rules together.

## Where a Node-side Auth/Storage/Firestore test goes

Use the existing lane — don't invent a second one:
`@firebase/rules-unit-testing` + `jest.rules.config.js` (plain-Node
`testEnvironment`) + `__tests__/rules/`, run via `npm run test:rules`.
That lane never loads the React Native native module, which is why it can
talk to a real emulator.

The root `__mocks__/@react-native-firebase/{app,auth,storage}.js` stubs are
a **hard platform requirement**, not a design choice: under Jest's RN
preset there is no native module and no bridge, so there is nothing for an
emulator to stand behind. The emulator suite cannot and does not replace
them — do not delete them. Emulator mode is a full-app test-drive concern
only.

For test-drive _mechanics_ (device setup, logging channels, per-run
checks), see [test-driving.md](test-driving.md).

## Consent records (ADR-0009)

- `consentRecords` (`functions/src/consent/`): GET returns the caller's current choices; POST records one. The uid comes from the ID token only.
- Firestore: `consentRecords/{uid}` (current), `consentRecords/{uid}/events` (append-only), `consentTombstones/{hash}` (erasure marker), and `consentTombstoneEvents/{hash}` (retained proof).
- Erasure shrinks records to a tombstone with no uid, email, platform or app version. Both collections use the `expireAt` TTL policies in `firestore.indexes.json`. Deploy the indexes with the function to enable expiration after three years.
- Client: `src/features/auth/lib/accountConsent.ts`. Emulator test: `functions/src/consent/emulator-tests/`.

## Organization Firestore boundary

Firestore stores organization data under ADR-0008. The authenticated Functions API is the only client entrypoint. Firestore Rules deny direct access, including membership/role writes. Server transactions enforce ownership, deletion guards, epochs, and idempotency; feature adapters supply member authorization.

Firestore joins the local Auth/Storage emulator lane on port 8080 (`npm run test:rules` starts all three). Use the configured local emulators for verification; an unavailable Firestore service returns a retryable error. Organization schema, indexes, and fresh setup instructions live in the implementation note and saved spec.

## Approved resources

MCP resources:

- `firebase://docs/`
- `firebase://guides/init/backend`
- `firebase://guides/init/auth`
- `firebase://guides/app_id`

For Storage/Auth work, the previously approved skills are listed below. Firestore schema, query, index, and Rules guidance is allowed for organization work under ADR-0008; Submission files and upload limits follow ADR-0005.

- `extension-to-functions-codebase`
- `firebase-ai-logic-basics`
- `firebase-app-hosting-basics`
- `firebase-auth-basics`
- `firebase-basics`
- `firebase-crashlytics`
- `firebase-data-connect`
- `firebase-hosting-basics`
- `firebase-remote-config-basics`
- `xcode-project-setup`

Firestore guidance applies to the organization backend.
