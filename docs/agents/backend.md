# Backend / Firebase

Current state of this project's backend surface — Auth, Storage, uploads —
and which Firebase MCP resources and skills are approved to use. Ratified
design decisions live in `docs/adr/`; this file is the map to them plus the
bits not yet ratified.

Organization data uses server-only Firestore (ADR-0008). Submission metadata and photos remain in Cloud Storage; upload counts and limits retain their existing implementation.

## Current architecture

- **Auth**: Firebase Auth, Google + email/password live, Apple/Facebook
  version-gated off. See [ADR-0001](../adr/0001-firebase-auth-over-google-signin.md).
- **Photo uploads**: direct client upload via `@react-native-firebase/storage`
  to the project's default bucket (ADR-0005's 2026-10-04 amendment), path
  `submissions/{uid}/{submissionId}/{fileName}` (raw Firebase Auth uid, not
  a hash — see ADR-0005's 2026-08-16 amendment). See
  [ADR-0005](../adr/0005-firebase-storage-for-uploads.md).
- **Upload limits, no database** (ADR-0005's 2026-11-03 amendment):
  - 10 photos per Submission: `storage.rules` accepts only the object
    names `photo-0` … `photo-9`; each photo's `upload_slot` names it.
  - 250 Submissions per uid: `functions/` counts the uid's `metadata.json`
    objects and sets the Auth custom claim `submissionCapReached`, which
    `storage.rules` checks.
- **Final submission (cats + metadata)**: uploaded to Cloud Storage as
  `metadata.json` alongside the photos — see
  [ADR-0005](../adr/0005-firebase-storage-for-uploads.md). Not a database
  write, not a separate Cloud Run/Functions endpoint.
- **Tester allowlist**: not enforced yet (#267).

## Test-drive posture: emulator by default

Test drives run against the **Firebase Local Emulator Suite**, not live
Firebase. Live-project test-driving risks real user data and produces
infrastructure-level errors that have nothing to do with the code under
test — a 412 bucket-permission error once cost a session's debugging time
at the wrong layer. Ports come from `firebase.json` as-is (Auth `9099`,
Storage `9199`); emulator mode needs **no change** to
`storage.rules`, so it exercises the actually-deployed
rules.

Start the suite (`firebase emulators:start`), then set:

| Env var                              | Value                 | Notes                                                                                   |
| ------------------------------------ | --------------------- | --------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_USE_FIREBASE_EMULATOR`  | `true`                | Off by default, never inferred from `__DEV__`                                           |
| `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` | `localhost` (default) | Use `10.0.2.2` on an Android emulator; `localhost` + `adb reverse` on a physical device |

On a physical Android device, tunnel both ports before you open the app:
`adb reverse tcp:9099 tcp:9099` and `adb reverse tcp:9199 tcp:9199`. The
tunnels are lost when the adb server restarts.

React Native Firebase changes `localhost` and `127.0.0.1` to `10.0.2.2` on
Android, unless `firebase.json` sets
`react-native.android_bypass_emulator_url_remap: true`. This repo sets it,
because `10.0.2.2` does not exist on a physical device. The SDK reads
`firebase.json` at build time, so rebuild the native app after you change it.
With the remap off, an Android emulator needs
`EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2` set explicitly.

Wired in `src/features/auth/lib/firebaseAuthProvider.ts` (`connectAuthEmulator`) and
`src/features/draft-submission/lib/upload/firebaseUpload.ts` (`connectStorageEmulator`). Both log the
active mode at startup and **fail fast** if the flag is set but the suite
isn't reachable — they never silently fall through to live Firebase. Read
that startup line before trusting any auth/upload observation: mock,
emulator and live are three different modes and their logs look alike.

`EXPO_PUBLIC_AUTH_MOCK` / `EXPO_PUBLIC_UPLOADS_MOCK` still exist as a
third, fully-offline mode for UI work. They skip Firebase entirely, so
they can never verify rules or real Auth/Storage behavior — don't reach
for them when the backend is what's under test.

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

## Organization Firestore boundary

The user explicitly authorized Firestore for organization data on 2026-11-09, superseding the previous project-wide prohibition for this scope. See ADR-0008. The authenticated Functions API is the only client entrypoint. Firestore Rules deny direct access, including membership/role writes. Server transactions enforce ownership, deletion guards, epochs, and idempotency; feature adapters supply member authorization.

Firestore joins the local Auth/Storage emulator lane on port 8080. Never silently fall back to Storage or a live database when Firestore is unavailable. Organization schema, indexes, and fresh setup instructions live in the implementation note and saved spec.

## Approved resources

MCP resources:

- `firebase://docs/`
- `firebase://guides/init/backend`
- `firebase://guides/init/auth`
- `firebase://guides/app_id`

For Storage/Auth work, the previously approved skills are listed below. Firestore schema, query, index, and Rules guidance is allowed for organization work under ADR-0008; it does not authorize migrating Submission storage or upload limits.

- `firebase:extension-to-functions-codebase`
- `firebase:firebase-ai-logic-basics`
- `firebase:firebase-app-hosting-basics`
- `firebase:firebase-auth-basics`
- `firebase:firebase-basics`
- `firebase:firebase-crashlytics`
- `firebase:firebase-data-connect`
- `firebase:firebase-hosting-basics`
- `firebase:firebase-remote-config-basics`
- `firebase:xcode-project-setup`

The prior project-wide Firestore skill prohibition is superseded for organization work only.
