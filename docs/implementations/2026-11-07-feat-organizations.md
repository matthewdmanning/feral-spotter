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

## 2026-11-09 — refactor

**Purpose:** follow TanStack Query's testing guidance: one client per test, injected through context.
**Change:** `AppProviders` mounts `QueryClientProvider` with `createQueryClient()` (`src/shared/lib/queryClient.ts`). Organization hooks read the client via `useQueryClient()` instead of a module singleton. Tests wrap renders with `queryWrapper()` (`src/test-utils/queryClient.tsx`); `jest.setup.js` no longer clears a shared cache. Verified: 121 suites / 551 tests, typecheck, lint. Not verified on device.

## 2026-11-11 — fix

**Purpose:** Address review findings F10/F11 without changing sharing consent,
rollout gates or persistence semantics.
**Change:** Sighting sharing sits immediately after location/time, before the cat
list. Name, email and phone content appears immediately under the corresponding
sharing choice. Organization cards share the card radius, heading role and
host-owned spacing used by their screens. The sharing Save action remains local
to its card; Settings' photo Save/Discard is now local to its own group.
Existing organization management/sharing journeys remain the interaction coverage.
See [shared layout changes](2026-10-28-ui-component-spacing-alignment.md) and the
[review](../reviews/2026-11-11-review-ui-ux.md) for the verification matrix.

## 2026-11-11 — refactor

**Purpose:** Centralize the sharing/permission strings and templates identified in SP2.
**Change:** Existing organization UI and helpers consume the organization namespace
in shared text configuration. Complete Share-field labels replace noun lowercasing.
Dynamic coverage dates retain device-locale formatting; inserted catalog/account
values use named slots and are not reinterpreted as template syntax. The existing
management journey now verifies a catalog name containing literal replacement
characters and braces survives the review dialog. Authorization, coverage,
rollout and outbox behavior are unchanged. See [shared UI work](2026-10-28-ui-component-spacing-alignment.md)
and the [review](../reviews/2026-11-11-review-ui-ux.md).

## 2026-11-12 — test: retain UI review regressions

**Purpose:** Selectively retain the review branch's UI checks after the feature-folder migration.
**Change:** Tests exercise long TextButton wrapping and enabled presses, SharingCheckbox
checked state and semantic icon styling through the shared CheckboxBox, and
SharingSettings card padding/radius with native-glass and reduced-transparency
fallback props through the real GlassSurface. They use current stores and theme
tokens without restoring obsolete components or copy catalogs. Native appearance
remains unverified. The Sighting detail permission placement is documented in the
[history note](2026-10-26-feat-reports-history-map.md).

## 2026-11-18 — rebase

**Purpose:** Rebase the organization landing work onto current main without losing the newer camera and upload safeguards.
**Change:** Preserve the organization query provider, both storage ADR amendments, paired-file cleanup checks, and persisted settings migration coverage. Main's removal of the pinch-zoom setting remains in effect. Move the JPEG/DNG manifest validation and JPEG-only projection checks into the current Firestore API emulator suite instead of retaining the obsolete API fixture suite.

**Verification:** The independently resolved endpoint passed type checking, lint (three existing import-order warnings), 137 app suites / 621 tests, the Functions build and 8 unit suites / 66 tests, 3 rules suites / 25 tests, and the current API emulator suite / 22 tests. The other three organization emulator suites passed before the test-only port. Native module sources match main; no device test drive was performed. The rebased history must match this verified endpoint before publication.

## 2026-11-23 — rebase

**Purpose:** Rebase onto main after #480–#490.
**Change:** Main's GCS-ledger revocation fix and its emulator case are dropped: the Firestore store replaced that ledger. Main's upload-quota rules test stays. Main's new functions lint passes: the leave saga reads its saved choice through `validateGrant`, not non-null assertions.

## 2026-11-23 — refactor: build flag is the master gate

**Purpose:** Main must merge with Organizations off.
**Change:** `FEATURE_FLAGS.organizations` (`EXPO_PUBLIC_ORGANIZATIONS`, default off) gates at the top:

- Root Stack: `Stack.Protected` hides every `organizations/*` route.
- `AppProviders` mounts `OrganizationsRuntime` only when on, so off sends no sync, directory or flag request.
- Screens gate their Organizations sections: Settings (entry, sharing defaults, permissions), Sighting detail (permissions), Create (sharing).
- `useOrganizationsFlag.refresh`: off → disabled, no PostHog request. On → the PostHog rollout (`Organizations`, `PinInteractions`) decides. Previously on forced enabled; off fell back to PostHog.

Leaf components keep their runtime rollout checks.

**Tests:** `organizationsFlag.test.ts` covers build-off (no request, disabled); PostHog cases run with the build flag on. `SettingsScreen.saveScope.test.tsx` checks the Settings entry follows the flag.

**Verification:** See the PR. No device drive.
