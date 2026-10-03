# Run notes: photo-upload clean retest (post storage-deploy-target fix)

Git state: `main` @ `6bed8695a6c2784500f33affb4b571100d152c5d`.
Device: Pixel 7 physical, `panther`, `EXPO_PUBLIC_AUTH_MOCK=false` (real auth).

## Goal

Test-drive the fix from `docs/scratchpad/2026-08-16-storage-deploy-target-fix-handoff.md`
(storage.rules deploy-target fix) and re-attempt the clean retest that
handoff asked for: fresh photo, no app kill, isolate whether #277's
kill/resume hypothesis explains the remaining `storage/unknown` error.

## storage-rules deploy fix: unverified, not confirmed

The prior handoff's session claimed "storage-rules bug fully closed" pending
this retest. **Retract that pending state — do not mark it closed.** No
upload has ever completed past the error below, so the rules path
(`isValidPhotoWrite()` etc.) has never actually been exercised in this
session. No `storage/unauthorized` was observed, but that's consistent with
failing earlier in the request pipeline, not with rules passing.

## #277 (kill/resume) hypothesis: falsified as *necessary*, but wrong bug entirely

Reproduced 3x this session, every time on a **fresh photo, zero app
kill/resume**:

1. Photo `c55dd83f-25fd-4343-aee8-a4963ef3b745` (after Reset + New Sighting)
2. Photo `5dae91e5-b455-468f-8f82-cdf4b239960b`
3. Photo `384b5869-557a-424f-85ea-62433ed9d876` (captured with `adb logcat
   --pid` running for full native detail — see below)

All three failed within ~3-5s of capture with the same JS-level error:
`[storage/unknown] The server has terminated the upload session` at
`firebaseUpload.ts:52` (inside `putFile(...).on('state_changed', ...)`).

**#277's kill/resume theory does not explain this.** What's true instead:
kill/resume is not a *necessary* precondition. The underlying bug is
different from what #277 describes — see root cause below.

## Root cause found (native logcat, not the JS-level string)

`adb logcat --pid=<app pid>` unfiltered (Metro's JS log throws away the HTTP
status — this is why #277 misdiagnosed it) shows the real server response
for repro #3:

```
StorageException has occurred.
An unknown error occurred, please check the HTTP result code and inner exception for server response.
 Code: -13000 HttpResult: 412
The server has terminated the upload session
java.io.IOException: {  "error": {    "code": 412,    "message": "A required
service account is missing necessary permissions. Please resolve by visiting
the Storage page of the Firebase Console and re-linking your Firebase bucket
or see this FAQ for more info: https://firebase.google.com/support/faq#storage-accounts.
If you recently made changes to your service account, please wait a few
minutes for the changes to propagate through our systems and try again."  }}
```

This is a **GCP permissions issue on the bucket**, unrelated to `storage.rules`
content and unrelated to #277's app-lifecycle theory. Also unrelated to
app code — checked `firebaseUpload.ts` end to end (hardcoded `BUCKET_URL`
holds the documented-correct bucket, not a bug) and `src/lib/cache/`'s three
overlapping cache systems (`clearAllStores()` in `storage.ts` would wipe
`photo-store` if it were ever called, but it has zero callers repo-wide —
Settings' actual "Clear Cache" wires to a different function,
`clearCache()` in `src/utils/cache.ts`, which never touches photo data).
Neither can produce a server-side 412 naming a missing service account.

**Corroborated:**
1. The verbatim 412 server message above (official Firebase-authored text).
2. Official docs (`firebase.google.com/docs/storage/web/start`): "newly
   created [default] buckets have the default access control set to allow
   Firebase," while importing an existing bucket into Firebase "requires
   manually granting access via gsutil" to the Firebase Storage service
   agent. `feral-spotter-image-uploads` is exactly the imported case — it
   was never given that manual grant.

**Correction to an earlier framing in this same note:** this is *not*
"bucket never imported/linked into Firebase" — queried
`firebasestorage.googleapis.com/v1beta/projects/{project}/buckets` directly,
both buckets ARE registered at the Firebase Storage registration layer.
Registration and the access grant are separate pieces of state; the custom
bucket has the former without the latter.

## Fix applied this session: switched the app to the default bucket

Per the docs above, the default bucket needs no manual grant — cheaper and
lower-risk than a permissions mutation on `feral-spotter-image-uploads`. Changed:
- `src/lib/upload/firebaseUpload.ts:33` — `BUCKET_URL` now
  `gs://project-e3d5659d-bc4f-438f-88c.firebasestorage.app`.
- `.firebaserc` (gitignored, machine-local) — the `feral-uploads` storage
  deploy target now points at the default bucket instead of
  `feral-spotter-image-uploads`.

**Still needed from Matthew (deploy is classifier-blocked for Claude Code
this session, same as the original storage-rules fix):**
- `firebase deploy --only storage` to push `storage.rules` to the default
  bucket. Until this runs, uploads will fail on rules instead of the 412 —
  the app now points at a bucket whose live ruleset was never targeted by
  this repo's rules before.
- Heads up: the default bucket already holds unrelated content —
  `cloud-run-sources/feral-model-source-ultralytics/...` (ML build
  artifacts) and an existing `feral-spotter-uploads/` prefix. No path
  collision with `submissions/{uid}/...`, but it's a shared bucket now, not
  a dedicated one.

**Verify after the rules deploy:** capture one fresh photo and confirm the
upload completes — per the emulator-testing note below, do this against the
Firebase emulator rather than live Firebase from here on.

**Testing-posture note:** per project direction, Firebase Auth + Storage
emulators are the standard for app-behavior test-driving going forward —
this session's live-Firebase capture was a one-time exception to confirm a
*deployed/permissions* fact the emulator can't model (it fakes Storage
locally and never touches real bucket permissions). Once the pending
storage-rules deploy (see "Still needed from Matthew" above) is applied,
don't re-drive this specific finding against live Firebase again; verify
future upload behavior against the emulator instead.

## Not checked this session

- PostHog consent-off gate (test-driving.md's every-run check): consent was
  already granted from a prior session and persisted; didn't re-trigger the
  onboarding/consent-revoke flow to test the negative path — out of scope
  for a photo-upload retest. PostHog events (`camera_opened`,
  `photo_captured`, etc.) fired normally with consent on.
- Location capture: not explicitly checked this session (no
  `watchPositionAsync` log line seen in this run's slice — worth a look next
  time if location-tagging is in scope).

## Screen dumps / raw logs

`docs/test-drives/logs/2026-08-17-screen*.xml`,
`2026-08-17-metro-start.log`, `2026-08-17-logcat-pid.log`.
