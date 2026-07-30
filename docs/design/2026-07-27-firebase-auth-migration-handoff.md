# 2026-07-27 — Firebase Auth migration handoff

## What happened this session

- Reversed the 2026-07-12 "Google Sign-In, not Firebase" decision (see `docs/adr/0001-firebase-auth-over-google-signin.md`). Firebase project `project-e3d5659d-bc4f-438f-88c` provisioned: Android app registered, debug SHA-1 added, Google sign-in provider enabled, OAuth clients auto-generated.
- Implemented end-to-end on branch **`issue-7-firebase-auth-migration`** (pushed, not merged, no PR): `src/lib/auth/firebaseAuthProvider.ts` wires `@react-native-firebase/auth`, sign-in screen rebuilt with failure feedback, profile screen deleted entirely (flow is now sign-in → analytics-consent). typecheck/lint/tests all pass.
- Branch **`issue-67-consent-blocked-gate-recheck`** (pushed, not merged, no PR) separately has the #63/#93/#67/#66 consent-loop and permission-sequencing fixes.
- Closed as resolved/superseded this session: #7, #8, #9, #11, #13, #36, #50, #54, #65, #66 (unverified — see below), #99, #100.
- `google-services.json` / `firebase.json` / `.firebaserc` are gitignored (contain the project ID — this repo is public). They exist locally but **won't be present on a fresh clone or CI**.

## Do this next, in order

1. **Get `google-services.json` onto whatever machine runs the next build.** It's gitignored on purpose. Either copy it from this machine or re-fetch it: `firebase apps:sdkconfig ANDROID 1:412440542557:android:52312cfc79db9597227cb4 --project project-e3d5659d-bc4f-438f-88c`, save to repo root. For CI, upload it as an EAS secret file instead of committing it.
2. **Build and run on a real device/emulator, both branches.** Neither `issue-7-firebase-auth-migration` (Firebase sign-in) nor `issue-67-consent-blocked-gate-recheck` (#63/#93/#67/#66 fixes) has been verified live — everything so far is typecheck/lint/unit-test green only. Walk the full chain: intro-flow → sign-in (real Google account) → analytics-consent → consent → home. Confirm #66's camera-consent-treated-as-denial is actually fixed by the sequential-permission-request change (same root cause as #67, never independently confirmed).
3. **Open PRs for both branches once verified**, targeting `main`. Merge `issue-67-consent-blocked-gate-recheck` first (smaller, older), then `issue-7-firebase-auth-migration`.
4. **Define Firebase Storage Security Rules.** The Cloud Run + custom GCS backend plan (old #8/#11/#36) is scrapped — uploads now go straight to Firebase Storage, gated by Security Rules instead of a custom API. Rules don't exist yet; this is now Task 3's actual remaining scope.
5. **Resolve Task 5 (PostHog).** Two live options, pick one and finish it — don't leave it half-done again: (a) merge the existing `issue-13-posthog-analytics` branch and actually verify it fires live (its own debrief flagged this as never confirmed), or (b) swap to Firebase Analytics + Crashlytics instead (assessed this session as low-moderate effort, Firebase project already set up). Facebook auth (Matthew's stated future intent) is unrelated and lower priority — file an issue for it if picked up.

## Don't

- Don't touch `PROJECT_STATUS.md` directly — see `report-status-findings` skill.
- Don't merge to `main` without Matthew's explicit go-ahead.
- Don't commit `google-services.json`/`firebase.json`/`.firebaserc` — the project ID must not land in this public repo.
