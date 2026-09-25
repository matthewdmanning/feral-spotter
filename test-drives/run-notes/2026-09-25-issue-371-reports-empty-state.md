# Issue #371 Reports empty-state check — 2026-09-25

- Device: Pixel 7, Android 17; installed FeralSpotter development build.
- Parent checkout: `main` at `ee8b72db409302236b0ed93bda3c7a398eb4c682`; docs checkout: `issue-371-improve-app-journey` at `bf69ed687258d85bca7e329e394d9339668d981a`. Both worktrees had unrelated changes, left intact.
- Metro: Expo dev client on port 8081 with USB reverse. Existing app data was preserved. `.env.local` has `EXPO_PUBLIC_AUTH_MOCK=false`; `EXPO_PUBLIC_USE_FIREBASE_EMULATOR` was unset, so this was a live-backend build.
- Scope: opened the Reports tab and inspected its empty state. No photo, Sighting, draft, or backend record was created.
- Result: [Pixel 7 capture](../screen-captures/2026-09-25_sightings-empty-state.png) shows “Feral Reports” in the title and tab, “No reports yet,” and “Submissions appear here as you create them.” This confirms the user-facing vocabulary finding U15/#380 in the rendered app. The card remains legible in the current dark theme.
- Limits: no non-empty list, Submission screen, cold first run, upload, consent, location, or analytics behavior was tested. No visual change was implemented.
