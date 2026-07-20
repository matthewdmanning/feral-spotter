# Roadmap Design Meeting — MVP / Alpha / Beta / v2.0

**Date:** 2026-07-12
**Participants:** Matthew Manning, Claude

## Milestone structure

| Milestone | Scope | Exit criteria |
|---|---|---|
| **MVP** | Android build for a small trusted tester group. Real upload to GCS (`gs://feral-segmentor-alpha`). Backend is validation-only (file type/size/MIME check + auth check, no malicious-code risk). Google Sign-In auth with a hardcoded tester allowlist. Minimal in-app consent screen. No integration with FeralSegmentor/FeralTracker. | 2-week trailing window with zero P0s (crashes, failed uploads, lost data), evidenced by PostHog data (submission funnel + capture funnel + exception capture) plus a manual QA checklist run under arranged conditions (poor network, specific devices). |
| **Alpha** | Google Play Store release (Android). Real data-transparency website page (domain already acquired, not yet hosted). Tutorial/onboarding flow. Sentry crash reporting added alongside PostHog. Auth/registration design revisited — real backend-persisted allowlist, registration screen wired to authenticated identity instead of free text. | Store listing live and passing review. |
| **Beta** | iOS support, feature parity with Alpha. | — |
| **v2.0** | Integration with FeralSegmentor (CV) and FeralTracker (ecological modeling). Out of scope before this point by explicit decision. | — |

## Decisions and rationale

1. **MVP bar** — small trusted tester group, real cloud upload required (not mocked), because real field data is needed to validate the flow. Full CV/tracker integration explicitly deferred to v2.0.
2. **Auth: Google Sign-In**, not the shared-password scheme already partially built in `src/utils/api.ts`. The `IAuthProvider` interface and `GoogleSignIn.ts` OAuth code already exist but are unwired (`src/lib/auth/index.ts` is a `NOT_IMPLEMENTED` stub). Chosen for per-tester attribution — needed to trace a weird field submission back to a specific tester/device. Password-gate code is superseded and will be removed.
3. **Platform: Android-only for MVP.** iOS becomes its own Beta milestone; Google Play Store release is the Alpha milestone. Matches existing project status language and avoids taking on App Store review/signing overhead before the core flow is proven.
4. **Backend architecture: in-repo Expo Router API route**, not a separate service repo. Confirmed via Expo SDK 56 docs that `app/*.+api.ts` files export server handlers (`GET`/`POST`) deployable as a Node server (`expo-server/adapter/http`) to Cloud Run once `app.json`'s `web.output` is set to `"server"` (currently `"static"`). Keeps client/server types (`src/types/Api.ts`) shared with zero duplication.
5. **Exit criteria: 2-week trailing window, zero P0s, backed by data — not vibes.** Field-use conditions are unpredictable, so a pure checklist isn't enough on its own; some conditions (poor network, specific devices) are arranged and checked manually, but the go/no-go signal is PostHog data. This requires closing an instrumentation gap: today PostHog (`src/lib/analytics/analytics.ts`) only fires submission-funnel events (`submission_sending/submitted/failed`); there's no capture/annotate funnel and no exception capture yet.
6. **Crash/error capture: PostHog only for MVP** (`posthog.captureException` + new funnel events). Sentry deferred to Alpha — not worth a second SDK/dashboard at tester counts small enough that people just report bugs directly.
7. **Data consent: minimal in-app screen, not a full legal disclosure.** Real GCS upload of photos + GPS location now happens in MVP (not mocked), so a disclosure is warranted, but detailed retention/legal language belongs on the website's data-transparency page (domain acquired, not yet hosted — building that page is Alpha scope, not MVP). Draft copy:

   > **Before you start**
   > FeralSpotter collects the following each time you submit a sighting:
   > - **Photos** you take of the animal
   > - **Location** (GPS) where the sighting occurred
   > - **Details you enter** about the animal (appearance, condition, etc.)
   > - **Your Google account**, so we can follow up if a submission needs clarification
   >
   > This data is uploaded to a private cloud storage bucket and used to build a dataset for feral cat population tracking and research. It is not made public and is not shared outside this project.
   >
   > By continuing, you agree to this data being collected and uploaded when you submit a sighting.
   >
   > **[ I Agree — Continue ]**

   Retention policy, precise research framing, and exact data-sharing scope are intentionally left for the website page, not the in-app screen.
8. **GCP infra: shared project with FeralSegmentor**, not an isolated project — this is infra co-location only, not the pipeline integration ruled out in decision 1. Bucket `gs://feral-segmentor-alpha` already exists. Cloud Run service and OAuth client ID are still to-do (MVP issues).
9. **Access control: hardcoded email allowlist**, checked against the cryptographically verified Google ID token — not the existing registration screen. `src/screens/register/index.tsx` is currently free-text (email typed by the user, not tied to any authenticated identity) with a no-op `registerUser()` — unsuitable as a security boundary without a redesign. Registration stays as-is (untouched, non-blocking) for MVP; revisiting auth/registration design (real backend-persisted allowlist, registration tied to authenticated identity) is flagged as Alpha-milestone work.
10. **Tutorial/onboarding flow: deferred to Alpha.** Redundant for a handful of personally-briefed testers; earns its cost once testers are strangers via Play Store.
11. **Timeline:** target date pending — user wants to see the full issue breakdown before committing to a date.

## MVP issues (dependency-ordered)

**Phase 1 — Infra foundation**
1. Provision Cloud Run service + OAuth client ID in the shared GCP project
2. Set `app.json` `web.output: "server"`; scaffold `expo-server/adapter/http` deploy pipeline to Cloud Run

**Phase 2 — Auth & backend** (depends on Phase 1)
3. Wire `src/lib/auth/index.ts` `IAuthProvider` to real Google Sign-In (`GoogleSignIn.ts`)
4. Build `app/upload+api.ts` validation route: verify Google ID token, check hardcoded tester allowlist, validate file type/size/MIME, write to `gs://feral-segmentor-alpha`
5. Update `src/utils/api.ts` to call the real Cloud Run endpoint with the ID token; remove the superseded password-gate code

**Phase 3 — App-side work** (parallelizable with Phase 2)
6. Fix #3 (no buttons on camera screen) — untouched scope, just the navigation bug
7. Build minimal consent screen (copy above), gate first submission behind acceptance, link out to the domain (not yet hosted)
8. Add PostHog capture/annotate funnel events + `posthog.captureException` at top-level error boundaries
9. Write/update the GitHub repo README to reflect actual current state (general housekeeping, non-blocking)
10. Code coverage for core features: Unit and basic integration testing.

**Phase 4 — Exit validation** (depends on Phases 1–3)
10. Define and run the manual QA checklist under arranged conditions (poor network, specific device models)
11. Run the 2-week trailing MVP window; go/no-go for Alpha based on PostHog data + checklist results

Registration-screen rework and the tutorial flow are explicitly **out of MVP scope** — Alpha milestone instead.
