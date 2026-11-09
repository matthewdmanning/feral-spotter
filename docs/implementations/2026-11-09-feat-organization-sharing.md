# Organization sharing

**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md)

Moved existing sharing controls and consent helpers into the sharing feature. Core directory/permission stores remain in organizations. Added member-authorized shared-Sighting pagination, map areas for approximate locations, precise pins only when consented, and read-only details. Authenticated photo delivery reencodes to JPEG without EXIF/XMP/IPTC or source URLs. Shared data is memory-only and cleared on blur, background, account change or lost access.

Tests: existing consent/management journeys; Functions `sharing/__tests__/photos.test.ts` verifies real metadata removal and authorization denial. Final verification is recorded after integration. No deployment or device check.

## Integrated verification

Full client suite: 119 suites / 550 tests. Functions: 9 suites / 66 tests. Real HTTP/Auth/Storage organization integration: 19 scenarios, including failure checkpoints, reused leave IDs, roster privacy, shared reads, photo sanitation, and revocation. Storage Rules: 24 tests, including denial of direct membership and invite access. App/server/test TypeScript checks, Functions build, and focused client ESLint pass.

Membership and sharing were developed on separate branches and composed on `feat/organizations-integration`. The spec is saved under `docs/planning/`. No live deployment, operator actions, or physical-device checks were performed.

`sharing/hooks/__tests__/sharedSightings.journey.test.tsx` verifies pagination retention during refresh and clearing on access loss/account changes. Shared pages return at most 50 Sightings, using numeric cursors rather than Storage tokens that could encode account identifiers.

V1 reads existing owner permission ledgers on demand; it does not add a separate organization index. Large deployments should add an indexed projection before increasing usage substantially. Foreground views refresh every 30 seconds; background/offline/blur clears loaded data. Revocation prevents subsequent authorized reads but cannot recall previously delivered copies.

Android and iOS Metro/Hermes exports passed to `/tmp/feral-spotter-organizations-export`. Android emitted a nonfatal warning because local `google-services.json` is absent. These checks verify JavaScript bundling, not native compilation or device layout.

## 2026-11-09 — refactor: indexed Firestore reads and loading recovery

**Purpose:** Replace bucket scans with Firestore queries and make shared views resilient to asynchronous failures.
**Change:** Indexed organization-scoped pages with opaque document-key cursors, direct photo permission lookups, live revocation/deletion checks, and authorization before/after processing. Photos remain sanitized in Storage, with generation-pinned downloads. Shared collections use a cancellable, single-flight pager with explicit loading/error/empty states; photo failures have an individual retry action. See [membership update](2026-11-09-feat-organization-membership.md) and [ADR-0008](../adr/0008-firestore-for-organizations.md). Final integration verification follows feature-branch integration.

### Firestore integration verification

- Client: 120 suites / 554 tests; Functions: 8 suites / 65 tests.
- Real Auth/Firestore/Storage integration: 24 cases. Rules: 27 tests.
- App/server/test type checks, Functions build, focused client lint, formatting, and diff checks pass. Android/iOS JavaScript exports pass; native/device checks were not performed.
- Separate follow-up branches: `feat/organization-membership-firestore` and `feat/organization-sharing-firestore`; combined implementation: `feat/organizations-firestore`. No live provisioning, deployment, or data migration was performed.

The Firestore read model supersedes the earlier bucket-scan limitation. Pages query only the requested organization and batch owner-state checks within a consistent read transaction. Missing/mismatched permission metadata, stale epochs, revoked permissions, deleting owners, and inactive memberships cannot grant access. Photo reads pin the Storage generation and recheck authorization before returning bytes.

## 2026-11-09 — refactor: greenfield organization backend

**Purpose:** Follow the user's clarification that this project has no active users or existing data.
**Change:** Removed the grant-builder compatibility re-export and moved callers to its canonical core location. Removed obsolete Storage-organization Rules tests; current Firestore permission and photo authorization coverage remains.
**Verification:** Full client suite: 120 suites / 550 tests. Functions: 8 suites / 65 tests. Type checks and focused lint pass. Organization integration: 23 emulator scenarios; Rules: 24 tests. No deployment or device check. Earlier migration descriptions above record superseded implementation history.
