# 2026-11-03 — account erasure pipeline (server half of #433)

## What shipped

- `functions/src/erasure/eraseAccount.ts`: `eraseAccount({ uid, email, deleteSightings }, ports)`, ordered email → analytics → organization data → Sightings (only if `deleteSightings`) → Auth user. Ports: `EmailListProvider`, `AnalyticsEraser`, `SubmissionStore`, `AccountStore`.
- `functions/src/erasure/adapters.ts`: PostHog bulk delete by distinct id with events and recordings; Storage delete of the uid's folder (trailing-slash prefix); Auth delete treating "user not found" as done.
- `functions/src/erasure/deleteAccount.ts` + `deleteAccount` callable in `index.ts`: uid and email from the token; refuses without a sign-in in the last 5 minutes. PostHog host, project and key come from deployment parameters (`POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, secret `POSTHOG_PERSONAL_API_KEY`).
- `EmailListProvider.remove()`; EmailOctopus "Delete contact" by MD5 of the lowercase address.

API facts were read from the EmailOctopus v2 and PostHog persons docs via Context7 (their hosts are not reachable from this session).

## Tests

- `functions/src/__tests__/eraseAccount.test.ts`: order for both choices; Auth user kept when an earlier step fails; unauthenticated, missing choice and stale sign-in refused before any step.
- `functions/src/email/__tests__/email.test.ts`: contact id is the MD5; 404 counts as removed.

## Not done

- The app side: deletion guard UI (needs its decision record, #401), re-authentication, the callable call, device cleanup (app cache, consent choices, `posthog.reset()`), keeping the media library untouched.
- Deployment and parameter values.

## Verification

`functions` tsc and jest (32 passed). Nothing deployed or called against a live service.

## Organization data erasure

Firestore account-deletion guards immediately hide organization names and shares and prevent new writes. Cleanup removes memberships, permission snapshots, receipts, and transition data for either Sighting-deletion choice. Optional Sighting deletion follows, and Auth deletion runs last. A failed cleanup leaves Auth available for retry.

See [organization permissions and erasure](2026-11-07-feat-organizations.md#permissions-and-erasure). Integration tests cover deletion guards and retry behavior; adapter tests verify Firestore cleanup on each attempt. No live erasure or deployment was performed.
