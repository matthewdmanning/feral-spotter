# Test drive: Dependabot updates + no-photos prompt

- Git state: `chore-temp-deps-and-annotate` @ `60a5df3f6289d44ba0a0e3b6980233eced5f662a`
  (local temp branch: `origin/main` + Dependabot PRs #491 and #501 + `feat/annotate-empty-photos-prompt`)
- Device: Pixel 7 (physical), debug build, `arm64-v8a` only, Metro over `adb reverse`
- Backend: Firebase Local Emulator Suite (Auth, Storage, Functions), restarted after `npm ci --prefix functions`
- Account: verified email account created in the Auth emulator
- App data: cleared once mid-drive (see finding 2); a backup was taken first

## Checks

| Check                                            | Result | Evidence                                                                                        |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| Native build with new dependencies               | Pass   | `BUILD SUCCESSFUL in 5m 2s`                                                                     |
| App starts, emulator mode                        | Pass   | `[firebase] mode: emulator`, `[nav] /`                                                          |
| Fresh onboarding to home                         | Pass   | intro → disclosure → camera and location permissions → sign-in → analytics consent → `/`        |
| No analytics before consent                      | Pass   | 0 `posthog`/`[analytics]` lines in `ReactNativeJS` logcat before consent                        |
| Analytics consent unchecked                      | Pass   | 0 `[PostHog]` lines after Continue; provider logs with `debug={__DEV__}` when mounted           |
| GPS capture                                      | Pass   | `[location] watchPositionAsync resolved, subscription live`; Cat List shows "Location acquired" |
| Camera photo upload                              | Pass   | `photo-0.jpg` in the Storage emulator                                                           |
| Capture to submit                                | Pass   | `metadata.json` and `photo-0.jpg` in the Storage emulator                                       |
| Functions on new `functions/` dependencies       | Pass   | `admitPhotoUpload`, `onSubmissionSubmitted`, `gateTesterAllowlist` finished, no errors          |
| No-photos prompt: last photo removed in Annotate | Pass   | Cat List asks "No Photos to Annotate" with Upload Photos, Just Describe, Cancel Sighting        |
| No-photos prompt: Just Describe                  | Pass   | opens Cat Form (`/submission/cats`)                                                             |
| No-photos prompt: leave choice with a cat saved  | Pass   | shows Back to Cat List instead of Cancel Sighting                                               |

Metro's `start.log` got no entries this session. App logs were read from
`adb logcat -s ReactNativeJS`.

## Findings

1. **No-photos prompt asks again after Just Describe.** After Just Describe → Save, Cat List
   asks "No Photos to Annotate" again. `useNoPhotosPrompt.ts` documents re-asking only when
   the last photo went while Cat List was covered; the hook sets `pending` whenever Cat List
   is unfocused with no photos. `flow.noPhotosPrompt.test.tsx` does not cover this return.
   Needs a decision: intended or not.
2. **Stale live session blocks uploads in emulator mode.** The kept app data held a session
   from the live project. Uploads failed with `auth/invalid-refresh` (`INVALID_REFRESH_TOKEN`).
   The app has no sign-out control, while its error copy says "Sign out and sign in again".
   Cleared app data to continue.
3. **Organization coverage unavailable.** `EXPO_PUBLIC_ORGANIZATIONS_API_URL` was not set for
   this drive. Drive setup gap, not a regression.
4. **Dev-only `PRELOAD` warnings on fresh start.** `PRELOAD` for `feral-reports` and `settings`
   was not handled while the intro flow showed. The Dependabot updates change no navigation
   or runtime packages, so these are not caused by them.
5. **Screen dumps fail on Cat Form.** `uiautomator dump` returns "could not get idle state",
   so `drive.sh` reads a stale `window_dump.xml` without warning. Used screenshots there.
6. **Launcher label shows "(rc)" on this debug build.** An env file sets `APP_VARIANT=rc`.

## Follow-up drive: remaining goals of `f6263683`

- Git state: `chore-temp-deps-and-annotate` @ `60a5df3f6289d44ba0a0e3b6980233eced5f662a`
- Same device and build. Emulators and Metro restarted; app session kept.
- Library photo: `emulator_tools/push_no_exif_fixture.py` fixture.

| Goal                                             | Result        | Evidence                                                                                                       |
| ------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------- |
| Camera draft: prompt offers Take Photos          | Pass          | Last photo removed → "Take Photos, Just Describe, Cancel Sighting"                                             |
| Take Photos opens the camera                     | Pass          | `[nav] /camera`                                                                                                |
| Library draft: prompt offers Upload Photos       | Pass          | Last photo removed → "Upload Photos, Just Describe, Cancel Sighting"                                           |
| Upload Photos opens the picker                   | Pass          | System Photo Picker shown                                                                                      |
| Add a Cat with no photos asks, no Annotate       | Pass          | Prompt shown; no `[nav] /submission/annotate`                                                                  |
| Annotate Photos with no photos asks, no Annotate | Pass          | Prompt shown; no `[nav] /submission/annotate`                                                                  |
| Cat List auto-skip needs photos                  | Not reachable | Start-up cleanup deletes a draft with no photos (`draft.ts:171`); in-session returns pass `NO_AUTO_SKIP_PARAM` |

7. **Cat-only draft is deleted at restart.** Just Describe → Save → force-stop → relaunch:
   no Continue Sighting, and Sightings lists no draft. `startDraft` in `draft.ts:171` tears
   down every draft with `photos.length === 0`. Just Describe now makes such drafts, so a
   described cat is lost on restart. Not fixed.
8. **Finding 1 also occurs after Close camera.** Camera opened from the prompt, then closed
   with no capture: Cat List asks again.
9. **Cat List empty copy with no photos.** It says "Your photos are still here either way."
   when the draft has no photos.

## Fix drive: keep cat-only drafts; stop asking after Just Describe

- Git state: `chore-temp-deps-and-annotate` @ `60a5df3f6289d44ba0a0e3b6980233eced5f662a` plus
  uncommitted changes to `draft.ts`, `usePhotoStore.ts`, `useNoPhotosPrompt.ts`
- Metro on port 8083 (`--clear`). The first Metro kept port 8081 and served the old
  bundle; checked with `markDoneAddingPhotos` in the device bundle file.

| Check                                              | Result | Evidence                                                 |
| -------------------------------------------------- | ------ | -------------------------------------------------------- |
| Cat-only draft survives a restart                  | Pass   | Home shows Continue Sighting; Cat List shows cat "Adult" |
| Just Describe → Save: Cat List does not ask        | Pass   | Cat List with "Adult", "Kitten"; no dialog               |
| Add a Cat still asks                               | Pass   | "No Photos to Annotate" dialog                           |
| Restart → Continue Sighting: Cat List does not ask | Pass   | Cat List with both cats; no dialog                       |

10. **Date & Time Recorded moves to the current time.** For the cat-only draft it showed
    3:23 PM, then 3:25 PM after a restart. Not checked further.

## Dependabot verdict

No crash or regression seen from #491 or #501. App-side changes are tooling packages only
(`brace-expansion`, `compression`, `fast-uri`, `undici`, `qs`, `re2js`); the large changes are
in `functions/` (`google-gax`, `@google-cloud/firestore`, `@google-cloud/storage`), and the
emulated Functions ran cleanly. Firestore-backed paths were not exercised.
