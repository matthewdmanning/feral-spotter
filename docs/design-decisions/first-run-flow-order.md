---
topic: first-run-flow-order
status: active
last_reviewed: 2026-08-07
governs:
  - src/screens/intro-flow/index.tsx
  - src/screens/consent/index.tsx
  - src/screens/sign-in/index.tsx
  - src/screens/analytics-consent/index.tsx
  - src/screens/register/index.tsx
  - src/screens/home/index.tsx
derives_from: ['#162', '#163']
supersedes:
  - "PR #61's order (2026-07-27 ratified): intro-flow -> sign-in -> analytics-consent -> consent -> home. That order left the data-collection disclosure and camera/location permission priming until after registration."
---

# First-run flow order — current design state

Screen sequence a new user walks through before reaching Home, and where each gate/permission-request fires.

## Order

`intro-flow -> consent (disclosure + camera/location request()) -> sign-in -> analytics-consent -> home`

## Why consent moved ahead of sign-in

Resolved 2026-08-07 via `/grilling` (#162, #163), implemented in PR #194.

Root motivation: permissions primed too late in the old order — camera/location weren't requested until after registration, so a user who granted a real account before declining/blocking a permission ended up registered with no functional app access. Moving `/consent` (disclosure _and_ `request()` calls, not just the `request()` calls) ahead of `/sign-in` means a user who declines never has an account created in the first place.

Rejected alternative: splitting `/consent`'s `request()` calls out to fire right after onboarding while leaving the disclosure UI in place later (the literal wording of #162). Rejected because it would fire OS camera/location prompts before the user has seen or agreed to what data collection they're enabling — domain.md's Consent entry ties acceptance and permission-granting together for a reason. The whole `/consent` screen moves as one unit instead.

## Why analytics-consent did not move

Stays in its current position (after sign-in, before home), unchanged from the pre-#194 order. Reason (Matthew, 2026-08-07): analytics is optional — the app is fully usable without it — so unlike consent, there's no dead-end risk in leaving it downstream of registration. Also confirmed `analytics-consent`'s state (`useConsentStore`'s `analyticsAccepted`) has no dependency on auth state, so its position relative to sign-in is a pure UX call, not a technical constraint.

## Home's auth/consent gate

`home/index.tsx` checks consent before auth (flipped from the pre-#194 auth-first order):

```
if (!hasAcceptedConsent()) router.replace('/intro-flow')
else if (!isAuthenticated) router.replace('/sign-in')
```

Consent is a device-level grant (persisted via `useConsentStore`, `markAccepted()` fires unconditionally on "I Agree" regardless of permission grant outcome — including OS "only this time" grants or `BLOCKED`) and must survive sign-out. A consented-but-signed-out user (e.g. after logging out) lands on `/sign-in`, never back on `/intro-flow` or `/consent` — those must never fire again once consent has been granted, for the life of the app on that device.

This was a real bug in the pre-#194 gate (auth-first order sent a consented-but-signed-out user back through `/intro-flow`), not just a consequence of the reorder — caught during grilling, fixed in the same PR.

## Not covered by this doc

- Camera/location's own contextual re-priming at point of use (issue #41) if a user declines/blocks at the `/consent` step — unchanged by this decision.
- `/consent`'s decline/exit behavior (Alert -> Android app-exit) — unchanged; now fires before any account exists, which is a cleaner state to exit from but wasn't itself re-decided here.
- Punchlist item 9 (`docs/planning/2026-08-02-ui-bug-punchlist.md`, "Don't allow" on media consent exits the app unprompted) — related but separate, not resolved by this change.

## Open follow-ups

- Live on-device verification of the new order — not yet done (same outstanding status as #192/#193).
