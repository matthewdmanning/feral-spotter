# Camera run — 2026-08-02

Git state: branch `ci-security-and-commitlint-checks`, commit `5dcd4fa720054337d3a18916483b8c0a0946e891`.

Not implemented yet. Listed only.

1. Camera screen: repeated permissions requests when taking photos.
2. Cat Observations screen: relabel "Done" button to "Finished!"; hide button if cat list empty.
3. Observed Cat screen: remove "Look" header.
4. Annotation Box screen: remove "Done" and "Cancel" buttons.
5. Mock submission for testing.

## Photo library run

1. Submission Details screen: able to attempt submission with 0 cats.
2. Observed Cat screen: able to submit without clicking photos. Selecting photos should be an option — too small. User should be taken to Box Annotation automatically and can dismiss photos without the cat.
3. Edit Cat screen: no warning of missing fields.
4. Submission Details screen: back button shouldn't be present. Add a button at the bottom — either "Select More Photos" or "Take More Photos".
5. Home screen — from Submission Details screen: way back to Submission Details isn't obvious. UX.
6. Library Picker screen — after selecting: are previously selected photos still present?
7. Cat Observations screen: "Reset" applies to entire submission, should live on the whole-submission screen, not Edit Cat screen. Button itself works correctly.
8. Consider caching instead of deleting submission for a short time. Target: Beta or v1.
   - UUID of a submission surviving a Reset in `submission_cache_index` (stale, not cleared by Reset): `d67a43e6-2eb6-438d-b178-807d44f8eb57` — useful reference if restoring a deleted submission.
9. Media consent: clicking "Don't allow" immediately exits the app — unprompted, no warning. On "Don't allow," send user back to Home with a pop-up instead. (Possibly overlaps open issues #66/#101 — consent/permission-denial handling.)
10. Camera screen: selecting "Limited access" on the media-library permission prompt opens the library picker — unexpected on the Camera screen.
11. Camera screen: pressing "Take Photo" (shutter) causes the system media/library picker to open instead of/around the capture. Live-confirmed 2026-08-02: foreground activity became `com.google.android.providers.media.module...PhotoPickerUserSelectActivity` right after the shutter press. Root cause: `useCameraCapture.tsx`'s `takePhoto` (`keepOnDevice` gallery-save path, lines ~139-142) lazily requests `PERMISSION_MAP.mediaLibrary` on the shutter path if not yet GRANTED/LIMITED — on Android 14+, that permission's OS grant dialog itself surfaces the system Photo Picker (`ACTION_PICK_IMAGES`) when the user picks "Select photos," which visually takes over as "the library opened" with no in-app messaging. Filed as issue #140. State capture: `emulator/run-notes/2026-08-02-shutter-photopicker-state.md`.

## Design questions

1. Move the camera/location permission `request()` calls from `/consent`'s `handleAgree` to right after onboarding (before sign-in), so priming happens earlier in the chain. Tension: PR #61 explicitly removed an old `PermissionPrimer` that did this exact eager-upfront request specifically to avoid asking twice, since `/consent` already requests all three on "I Agree" — moving it earlier reopens that double-ask unless `/consent`'s own `request()` calls are also removed (keeping only its `BLOCKED`-gate check, reading OS state set by the earlier prompt).
2. Rearrange the overall first-run order — onboarding, analytics consent, Firebase auth (sign-in/register), device permissions, Home — for better UX. Current order: `intro-flow → sign-in → analytics-consent → consent (device permissions) → home`.
