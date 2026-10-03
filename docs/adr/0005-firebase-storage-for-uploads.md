---
status: implemented — issue #266 ("Connect to storage")
---

# Firebase Storage SDK for photo uploads, not the custom `upload+api.ts` route

Issue #10 built a validation-only Expo API route (`src/app/upload+api.ts`): the client
POSTs multipart form data, the route verifies a Google ID token against a tester
allowlist, validates MIME type/size (`src/lib/upload/fileValidation.ts`), enforces a
per-submission photo count cap, then writes to GCS via `@google-cloud/storage` with
Application Default Credentials. None of this is wired to a screen yet.

Decided 2026-08-13: switch to `@react-native-firebase/storage`'s `putFile`, uploading
directly from the client to the bucket, to get resumable uploads with built-in
pause/resume/retry — the custom route's one-shot multipart POST has no resilience
story for the spotty field network conditions this app runs in. This extends the
Firebase adoption started in [ADR-0001](0001-firebase-auth-over-google-signin.md)
(Auth) to Storage.

iOS is not blocked by this choice: `@react-native-firebase/storage` wraps the native
Firebase SDKs on both platforms (Android and the Firebase Apple/Swift SDK on iOS), so
it carries forward cleanly whenever ADR-0001's "Android-only for now" restriction
lifts.

## Resolved: target bucket

Corrected 2026-08-13 — `gs://feral-segmentor-alpha` (the MVP milestone description's
bucket name) is not the target; the real bucket is `gs://feral-spotter-image-uploads`.
Confirmed via `gcloud storage buckets list --project=project-e3d5659d-bc4f-438f-88c`:
it's already linked to this Firebase project, alongside the Firebase default bucket
(`project-e3d5659d-bc4f-438f-88c.firebasestorage.app`) and an unrelated
`feral-vision-smoke` bucket. Addressed as a non-default bucket:
`getStorage(getApp(), 'gs://feral-spotter-image-uploads')`. `upload+api.ts` and
`functions/src/index.ts` both default `GCS_BUCKET_NAME` to this value now.

## Resolved: photo-count enforcement moves to a Firestore counter

Storage Rules have no primitive for counting sibling objects under a prefix —
`resource` in a `write` rule is scoped to the single object at that same path, not a
folder listing, and `request.resource` describes only the incoming write. Confirmed
against current Firebase docs (`firebase.google.com/docs/storage/security/*`), not
assumed.

Design landed 2026-08-13, scoped **per submission** (matches `MAX_PHOTOS` in
`src/config/constants.ts`, not a per-user lifetime total):

- **Object path**: `submissions/{uid}/{submissionId}/{fileName}` — `uid` is the
  signed-in Firebase Auth uid directly. See the 2026-08-16 amendment below;
  this superseded an interim hashed-path design that lived here 2026-08-13
  through 2026-08-16.
- **Counter**: Firestore doc `/submissions/{submissionId}`, field `photoCount`,
  maintained by `functions/src/index.ts`'s `onSubmissionPhotoUploaded` /
  `onSubmissionPhotoDeleted` Storage triggers (Admin SDK, bypasses rules — the
  recommended path over letting the client update the counter directly).
- **Gate**: `storage.rules` uses the cross-service `firestore.get()`/`firestore.exists()`
  functions (default Firestore database only, max 2 Firestore reads per rules
  evaluation) to check `photoCount < 10` before allowing a write. The
  `firestore.exists(...) == false` branch is required — without it the _first_ photo
  of a new submission is denied, since the counter doc doesn't exist until the
  Cloud Function creates it after that first write lands.
- **Known race**: the counter increments _after_ the object finalizes, not
  synchronously with the write. Two uploads issued close enough together can both
  read `photoCount` before either increment lands, both pass the rule, and leave the
  submission at 11 photos instead of 10. The hard synchronous gate the old
  `upload+api.ts` route had (`getFiles({ prefix })` counted at request time) doesn't
  carry over exactly — this trades a strict cap for resumable uploads.
- **Firestore access**: `firestore.rules` allows the owning user read-only access to
  their submission doc; all writes are `false` (Cloud-Function-only).

Tester allowlist enforcement is still open — not addressed by this change. Custom
claims or a Firestore-backed lookup would extend the same `firestore.get()` mechanism,
but that isn't designed here.

## Amendment 2026-08-16: dropped the uid hash, raw uid in the object path

The salted-hash scheme above (`uidHash = sha256(USER_ID_HASH_SALT + uid)`,
`ownerUidHash` field) is reverted. `storage.rules`, `firestore.rules`,
`firebaseUpload.ts`, and `functions/src/index.ts` all now use the raw
Firebase Auth `uid` directly — path segment `submissions/{uid}/...`,
Firestore field `ownerUid`.

Reasoning (Matthew, 2026-08-16): a Firebase Auth uid is already an opaque,
third-party-issued identifier, not PII on its own — hashing it added no
real privacy benefit over what Firebase Auth already provides. Having the
raw uid in the object path is also useful on its own: it lets a future
"delete my data" request locate a user's objects directly, without needing
to recompute the same salt+hash the client used.

This also incidentally resolves an unverified risk the original design
carried: whether the rules language's `hashing.sha256().toHexString()`
byte-for-byte matched `expo-crypto`'s `digestStringAsync` output was never
confirmed (the rules test suite couldn't run locally at the time — JDK 17
vs. firebase-tools' JDK 21 requirement). That's moot now; there's no
cross-language hash to agree on.

## Amendment 2026-08-24: no metadata, no photo

Policy, decided alongside [#292](https://github.com/matthewdmanning/feral-spotter/issues/292):
**a photo object with no submission metadata referencing it has no reason to
exist and is deleted.** A photo uploads as soon as it is captured, before the
user has committed to submitting anything, so an abandoned or Reset draft
leaves objects in the bucket that no `metadata.json` will ever point at. Those
are the orphans this closes.

Enforcement is two-layered, because neither layer alone is sufficient:

- **Scheduled server-side sweep** — the authority. Deletes photo objects with
  no referencing metadata after a grace period. It is the only layer that
  catches a client that was killed, went offline permanently, or was
  uninstalled mid-draft.
- **Client best-effort delete on teardown** — an optimisation, not a guarantee.
  It reclaims the common case immediately instead of waiting for the sweep.

Note that `storage.rules` denies client deletes today: on a delete
`request.resource` is null, so both `isValidMetadataWrite()` and
`isValidPhotoWrite()` error and the rule fails closed. The client layer
therefore needs an explicit delete rule before it can do anything at all.

Implementation is filed as
[#293](https://github.com/matthewdmanning/feral-spotter/issues/293); the draft
teardown seam this hangs off is
[ADR-0006](0006-submission-draft-boundary.md). This closes the residual gap
this ADR left open: the bucket has a defined lifetime rule for photo objects,
not just an upload path.

## Considered Options

- **Keep the custom `upload+api.ts` route** — rejected: no resumable/retry story,
  which is the reason for this change.
- **Firebase Storage SDK, direct client upload** (chosen) — resumable, works
  offline-to-online, reuses the Auth investment from ADR-0001. Trade-off: allowlist
  and count-cap enforcement need to be re-homed (see above) before this can fully
  replace the route.
