# Organization membership

**Scope:** Feature. **Date:** 2026-11-09. **Branch:** `feat/organization-membership`.
**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md).

## Shipped

Invite-code requests with required display names, platform-operator approval, name-only roster, name editing, cancellation and leaving. No member administration API. Organization membership screens are independent of sharing screens; the composition root wires optional shared views. Membership documents live under the existing per-user organization prefix, so account erasure removes names and memberships. Codes are random 192-bit values stored only as SHA-256 hashes.

Leaving defaults to unsharing. Retention requires explicit field/Anonymous selection and renewed confirmation. A durable exit checkpoint plus core permission locks makes failures resumable and blocks concurrent/stale grants. Each join has a separate lifecycle ID, preventing repeated leave IDs from bypassing revocation after rejoining. Validation failures restore membership and permit another choice. Operator removal revokes retained content.

## Operator tooling

Build Functions, configure Application Default Credentials, explicitly set `GCS_BUCKET_NAME`, then use `node scripts/organization-membership.mjs invite ORGANIZATION` or `approve|reject|remove ORGANIZATION UID`. Tooling uses infrastructure credentials; no app user receives admin rights. Invite commands print the generated invite code for distribution. No live tooling was run.

## Verification

Client leave-control tests pass (2 cases); app/test/server type checks and Functions build pass. Real HTTP/Auth/Storage emulator journeys pass for approval, roster privacy, default unsharing, changed retained consent, invalid review recovery, and removal (16 total scenarios at initial verification). Final integration verification is recorded separately. No deployment or physical-device check.

## Integrated verification

Full client suite: 119 suites / 550 tests. Functions: 9 suites / 66 tests. Real HTTP/Auth/Storage organization integration: 19 scenarios, including failure checkpoints, reused leave IDs, roster privacy, shared reads, photo sanitation, and revocation. Storage Rules: 24 tests, including denial of direct membership and invite access. App/server/test TypeScript checks, Functions build, and focused client ESLint pass.

Membership and sharing were developed on separate branches and composed on `feat/organizations-integration`. The spec is saved under `docs/planning/`. No live deployment, operator actions, or physical-device checks were performed.

`membership/screens/__tests__/membership.journey.test.tsx` verifies joining, approval refresh, name editing with sharing off, and account isolation. Leave-control tests verify default unsharing and mandatory re-review after field changes.

Android and iOS Metro/Hermes exports passed to `/tmp/feral-spotter-organizations-export`. Android emitted a nonfatal warning because local `google-services.json` is absent. These checks verify JavaScript bundling, not native compilation or device layout.

## 2026-11-09 — refactor: Firestore membership and async recovery

**Purpose:** Use Firestore for organization data and make membership actions resilient to latency and partial failure.
**Change:** One membership per Firestore document, private owner identifiers, transactional account-deletion and organization-status checks, indexed/paginated name-only rosters, hashed Firestore invite records, and recoverable leave checkpoints. Loading indicators distinguish initial fetches from empty results; mutations are single-flight and reconcile ambiguous failures. A successful leave updates core permission state even if its screen was dismissed. See [sharing update](2026-11-09-feat-organization-sharing.md) and [ADR-0008](../adr/0008-firestore-for-organizations.md).

Operator tooling now requires an explicit `FIREBASE_PROJECT_ID` as well as the source-files bucket. Final integration verification is recorded after combining the feature branches.

### Firestore integration verification

- Client: 120 suites / 554 tests; Functions: 8 suites / 65 tests.
- Real Auth/Firestore/Storage integration: 24 cases. Rules: 27 tests.
- App/server/test type checks, Functions build, focused client lint, formatting, and diff checks pass. Android/iOS JavaScript exports pass; native/device checks were not performed.
- Separate follow-up branches: `feat/organization-membership-firestore` and `feat/organization-sharing-firestore`; combined implementation: `feat/organizations-firestore`. No live provisioning, deployment, or data migration was performed.

The membership journey checks initial loading versus empty/error states and foregrounding during an in-flight request. Mutation responses reconcile against the durable checkpoint before showing completion. Account-deletion guards hide roster names before physical cleanup finishes and prevent concurrent membership writes from recreating erased data.

## 2026-11-09 — refactor: greenfield organization backend

**Purpose:** Follow the user's clarification that this project has no active users or existing data.
**Change:** Enrollment IDs are required with no legacy fallback. Removed the obsolete JSON-document adapter and read invite documents directly from Firestore. Account erasure no longer attempts Storage organization cleanup.
**Verification:** Full client suite: 120 suites / 550 tests. Functions: 8 suites / 65 tests. Type checks and focused lint pass. Organization integration: 23 emulator scenarios; Rules: 24 tests. No deployment or device check. Earlier migration descriptions above record superseded implementation history.
