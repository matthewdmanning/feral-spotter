# Issue #371 Home visual check — 2026-09-25

- Device: Pixel 7, Android 17; installed FeralSpotter development build.
- Checkout: parent `main`; journey docs submodule `issue-371-improve-app-journey`. Both worktrees had unrelated changes, which were left intact.
- Metro: Expo dev client on port 8081 with USB reverse. Existing app data was preserved.
- Scope: launched the installed app and inspected Home. No photo, Submission, or user data was created.
- Result: [Home capture](../screen-captures/issue-371-home-2026-09-25-pixel7.png) shows Take Photos and Upload Photos with equal size, fill, and prominence. The development overlay gear is visible. The maintainer chose Take Photos as the visual primary after this review.
- Submission grouping and interaction timing were not device checked. No completion, consent, GPS, or PostHog behavior was tested in this pass.
