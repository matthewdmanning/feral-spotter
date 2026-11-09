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
