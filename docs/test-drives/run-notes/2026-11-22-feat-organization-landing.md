# Test drive: feat/organization-landing

- Git: `feat/organization-landing` @ `e7d3ffcf1ca4228d37c12ddf2d5507b47a2e80d0`, plus uncommitted changes (email flag off, Organizations build flag, build and backend changes from this session).
- Device: Pixel 7, debug build, Metro over `adb reverse`.
- Backend: live Firebase (`[firebase] mode: live`).
- Build settings: GitHub `development` environment via `npm run env:pull -- development` (Organizations on).
- Logs: `docs/test-drives/logs/2026-11-22-feat-organization-landing-{build,metro}.log`.

## Results

| Check                                          | Result                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent flow                                   | Data agreement, camera and location dialogs approved. Email opt-in step skipped (`/sign-in` → `/analytics-consent`).                                                    |
| Settings                                       | No Email Updates toggle. Organizations section present.                                                                                                                 |
| Analytics before consent                       | No PostHog event.                                                                                                                                                       |
| Analytics after consent                        | No PostHog log lines at all. Not verified whether the toggle was set; the deep link to the consent screen redirects Home.                                               |
| GPS                                            | `watchPositionAsync` live; `GnssLocationProvider` active in logcat.                                                                                                     |
| Photo upload                                   | Failed first: `EXPO_PUBLIC_UPLOAD_ADMISSION_URL` unset and `admitPhotoUpload` not deployed. Passed after deploy and IAM fixes: `photo-0.jpg`, `photo-1.jpg` in Storage. |
| Submit                                         | Passed. `metadata.json` written; app returned Home.                                                                                                                     |
| Organizations on the Submission Details screen | "Organization coverage is unavailable." Expected: `organizationsApi` is not deployed.                                                                                   |

## Findings

- LogBox console errors on cold start: unhandled `PRELOAD` actions (#495). The LogBox badge covers onboarding "Next".
- Onboarding copy still mentions "Optional email updates" while the email feature is off.
- `uiautomator dump` returns a stale tree after leaving annotate; screenshots were needed on the Cat Form and later screens.
- "Done With This Cat" without a confirmed box returns to Home, not the Cat Form. Not verified whether this is intended.
- Captured photos were black (camera likely covered).

## Live backend changes made during this drive

- Deployed `admitPhotoUpload` (first Functions deploy in the project).
- Created secrets `UPLOAD_IDENTITY_KEY`, `EMAIL_API_KEY` (placeholder) and `POSTHOG_PERSONAL_API_KEY`.
- Granted the Compute default service account `roles/cloudbuild.builds.builder`, `roles/firebaseauth.admin`, `roles/storage.objectAdmin`.
- Turned off the Cloud Run invoker IAM check on `admitphotoupload` (Domain restricted sharing blocks `allUsers`).
- GitHub: `EXPO_PUBLIC_UPLOAD_ADMISSION_URL` on `production`; new `development` environment.
