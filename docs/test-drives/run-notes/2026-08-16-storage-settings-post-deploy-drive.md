# Test drive: storage-settings post-merge/deploy verification

Git state: `ab2ef84d22f1b6c2e7d7e3faf4ab315f343118a8` on `main` (post-merge of
PR #276/#10). Device: Pixel 7, physical, `arm64-v8a`. `EXPO_PUBLIC_AUTH_MOCK=false`
(real Firebase Auth). Fresh `CI=1 npm run android` rebuild before driving.

## What was verified working

- `firebase deploy --only firestore:rules,storage` succeeded, both
  `storage.rules`/`firestore.rules` compiled and released to
  `project-e3d5659d-bc4f-438f-88c`.
- Full onboarding → data-usage consent → Google sign-in
  (`mattmanningclemson@gmail.com`, real account picker) → analytics-consent
  (already checked) → Home screen. No crash, no stuck state.
- Camera capture: 2 photos taken, **no native crash** — confirms `9f48681`
  (`captureEvent` reusing pre-dispose width/height) holds on-device.
- Annotate (box both photos), Cat Form (all fields set: Adult/Male/Short
  hair/Tabby/Orange/Good health, ear-tipped No, owned No) → "Put the Cat in
  a Box" saved the cat with no error.
- Submission Details → "Finished!" → confirm dialog → SUBMIT tapped, no
  crash, returned to submission screen cleanly (no error toast shown to
  user — see gap below).

## Bug found: uploads still fail `storage/unauthorized`

Both `photo_captured`-triggered background uploads
(`src/lib/upload/uploadNewPhoto.ts`'s fire-and-forget `putFile`) failed
immediately in Metro's log:

```
[uploadNewPhoto] <local_id> [Error: [storage/unauthorized] User is not
authorized to perform the desired action.]
  at uploadSubmissionPhoto (src/lib/upload/firebaseUpload.ts:73:12)
```

This is the exact symptom the storage-settings branch (PR #276) was
supposed to resolve. Ruled out as causes:

- **Not the old tester-allowlist gate** — confirmed `storage.rules` on
  `main` (post-merge) has no `allowedTester` condition at all (dropped in
  `d0a34d4`, verified via `git show` and direct file read).
- **Not a stale/undeployed ruleset** — redeployed live immediately before
  this drive, deploy output confirmed both rulesets compiled and released.
- **Not a bucket/project mismatch** — `firebase.json`'s `storage.bucket`,
  `firebaseUpload.ts`'s `BUCKET_URL`, and `google-services.json`'s
  `project_id` all agree on `feral-spotter-image-uploads` /
  `project-e3d5659d-bc4f-438f-88c`.
- **Not a broken sign-in/stale token** — real Google sign-in completed via
  the account picker this session; `firebaseAuthProvider.ts`'s
  `signInWithCredential` path (reviewed, unchanged from the
  already-fixed `d28dad3`) yields a real Firebase `User` with a real ID
  token attached to every SDK call automatically.
- **Not a rules-logic bug** — PR #276's `npm run test:rules` passed 22/22
  against the real local emulator for this exact write shape before merge.

Root cause not yet found — the delta between the emulator suite (passing)
and this live device run (failing) needs a live-instrumented recheck
(temporary logging in `firebaseUpload.ts`/rules, per the technique the
2026-08-15 continuation drive used successfully — added, verified, fully
reverted) or a direct read of the *actually-live* ruleset via Firebase
Console to rule out a deploy-target subtlety this session's CLI output
didn't surface. Flagging rather than guessing further.

## Other findings

- **GPS/location never fired**: zero `FusedLocationProvider`/
  `GnssLocationProvider`/`LocationManagerService` logcat lines the entire
  session. Submission screen showed "Location accuracy is low or
  unavailable — tap to set manually" the whole time. Not investigated
  further this session (out of scope for the storage/rules verification
  goal) — worth its own check.
- **Submit gives no visible error feedback**: tapping SUBMIT with both
  photos in a permanently-failed upload state returned to the same screen
  with no error toast/dialog telling the user anything went wrong — a
  silent failure from the user's perspective. Not filed as an issue yet.
- PostHog events were **not cross-checked this drive** — the upload
  failure became the priority; `submission_sending`/`submission_submitted`
  event verification against the expected-property table was not reached.
