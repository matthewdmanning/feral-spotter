# Organizations: directory and permissions

**Scope:** Feature. **Updated:** 2026-11-09.
**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md).
**Architecture:** [Firestore organization data](../adr/0008-firestore-for-organizations.md).

## Current behavior

- The organization directory provides versioned geographic coverage and a device cache. Coverage checks support overlapping organizations, polygon holes, boundaries, and the dateline.
- Sharing is explicit for each Sighting. Cat count and an approximate area are included; name, email, phone, cat details, precise location, and photos are optional. Anonymous defaults on and suppresses contact fields.
- Saved preferences suggest choices; each Sighting requires fresh confirmation. Location, organization, catalog, account, or relevant permission changes require review.
- The case-sensitive PostHog flag `Organizations` controls sharing availability. Flag evaluation is independent of analytics consent. The flag is not an authorization boundary; revocation remains available when sharing is off.
- Membership and sharing are separate subfeatures. Core organization permission stores contain no membership or sharing-screen logic. The composition root connects active membership to shared-view access.

## Firestore data

Organization data is accessed through the authenticated Functions API and Admin SDK. Firestore Rules deny direct client reads and writes.

- `organizations` and `organizationCatalog/current`: directory records and catalog version. Geometry is stored as unindexed `coverageJson`.
- `organizationPermissions`: one consent snapshot per owner, organization, and Submission, keyed by an opaque hash.
- `organizationAccounts/{uid}`: admission counters and the account-deletion guard; `states` and `mutations` subcollections contain epochs, transition locks, and idempotency receipts.
- `organizationMemberships` and `organizationInvites`: individual memberships and hashed invite codes, owned by the membership feature.

Submission metadata and photos use Cloud Storage. Member views use explicit projections; raw Submission records and source photo URLs are never returned.

## Permissions and erasure

The server verifies Firebase ID tokens, ownership, organization availability, coverage, current consent, and revocation state. Member-facing reads also require active membership. Shared reads use indexed queries, document-key pagination, and consistent owner-state checks.

Permission writes and retry receipts commit transactionally. Individual revocation records a tombstone; organization-wide revocation advances an epoch. Stale or concurrent grants cannot restore access. Retained-consent replacement commits atomically within 400 records / 8 MiB.

Account erasure immediately blocks organization writes and hides names and shares. It then removes memberships, permissions, receipts, and transition data, before optional Sighting deletion and final Auth deletion. Only a minimal write-denial tombstone remains.

Revocation stops subsequent access. Copies already received cannot be recalled.

## Async behavior and setup

User-scoped permission synchronization persists pending actions, prioritizes revocations, and requires renewed review after relevant changes. Initial loading, refresh, empty, offline, forbidden, and retryable failure states are distinct. Reads cancel on blur, background, or account changes. Mutations are single-flight and reconcile ambiguous responses against durable server state.

The client deadline is 15 seconds. The HTTP function uses 512 MiB, concurrency 1, and a 60-second deadline. Photo delivery rechecks authorization and strips embedded metadata. Functions builds clean generated output before compiling.

See the spec's [fresh Firestore setup](../planning/organization-membership-and-sharing.md#fresh-firestore-setup). Publish the actual catalog with `scripts/publish-organization-catalog.mjs`; no fictional organizations are seeded. A publication marker prevents partially updated directories from being read.

## Verification

- Client: 120 suites / 550 tests; Functions: 8 suites / 65 tests.
- Auth/Firestore/Storage integration: 23 scenarios; Rules: 24 tests.
- App/server/test type checks, Functions build, focused lint, formatting, and diff checks pass.
- Live provisioning, deployment, native compilation, and physical-device checks were not performed.

Feature details: [membership](2026-11-09-feat-organization-membership.md) and [sharing](2026-11-09-feat-organization-sharing.md).
