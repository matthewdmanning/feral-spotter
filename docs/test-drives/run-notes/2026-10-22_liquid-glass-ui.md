# Test drive: liquid-glass-ui (2026-10-22)

- Branch: `liquid-glass-ui`
- Commit: `becf993` (refactor(ui): shared components, no duplicates, logic out of views)
- Device: Pixel 7 (physical, arm64-v8a)
- Metro: `CI=1`, tunneled with `adb reverse tcp:8081 tcp:8081`

## Setup findings

- The dev client opened Metro at the LAN IP and failed with
  `java.net.NoRouteToHostException: Host unreachable`. A USB tunnel for port 8081
  and a `localhost` deep link fixed it.
- Gradle build: `BUILD SUCCESSFUL in 11m 14s`. JS bundle: 2861 modules, 48 s.

## Screens seen

| Screen                                  | Capture                                    | Result                                               |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| Onboarding page 1, "Every feral counts" | `2026-10-22_liquid-glass-home.png`         | Ambient gradient, glass Previous/Next buttons render |
| Onboarding last page, "Almost ready"    | `2026-10-22_liquid-glass-onboarding-2.png` | Renders                                              |
| "Before You Start" consent              | `2026-10-22_liquid-glass-onboarding-3.png` | Renders; text body on gradient                       |

## User journey through submission (live Firebase, `[firebase] mode: live`)

Home → Take Photos → capture → Done (1) → annotation walkthrough (5 pages) →
box confirm → cat details → Save → Submission Details → Finished! → Submit.
The upload completed (`RNFBStorageTask: destroyed completed task`), and Reports
lists 1 submission with the status "Submitted". Captures: `2026-10-22_liquid-glass-journey-*.png`.

| Screen     | Defect                                                              |
| ---------- | ------------------------------------------------------------------- |
| Camera     | Flash button draws two glyphs on top of each other                  |
| Annotation | "← Previous" breaks mid-word; "Done With This Cat" wraps to 4 lines |
| Annotation | "Remove photo" button sits under the dev-tools gear                 |
| Reports    | Card truncates the time to "..."; dev-tools gear covers "1 total"   |

- PostHog's first event comes after `/analytics-consent` (Metro log order).
  The opt-out path was not tested.
- The user tapped through consent, sign-in, and analytics consent on the device.
- The test submission is in live storage and Firestore. Delete it.

## Open checks

- One Next tap moved from page 1 to page 4. The taps may have landed during a
  page animation. Repeat with one tap and one capture per page.
- The Android back key did not leave the consent screen. Confirm that this is intended.
- Not driven: Upload Photos path, Settings, the analytics-consent opt-out check.
