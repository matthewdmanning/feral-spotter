# Organization sharing

**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md)

Moved existing sharing controls and consent helpers into the sharing feature. Core directory/permission stores remain in organizations. Added member-authorized shared-Sighting pagination, map areas for approximate locations, precise pins only when consented, and read-only details. Authenticated photo delivery reencodes to JPEG without EXIF/XMP/IPTC or source URLs. Shared data is memory-only and cleared on blur, background, account change or lost access.

Tests: existing consent/management journeys; Functions `sharing/__tests__/photos.test.ts` verifies real metadata removal and authorization denial. Final verification is recorded after integration. No deployment or device check.

## Integrated verification

Full client suite: 119 suites / 550 tests. Functions: 9 suites / 66 tests. Real HTTP/Auth/Storage organization integration: 19 scenarios, including failure checkpoints, reused leave IDs, roster privacy, shared reads, photo sanitation, and revocation. Storage Rules: 24 tests, including denial of direct membership and invite access. App/server/test TypeScript checks, Functions build, and focused client ESLint pass.

Membership and sharing were developed on separate branches and composed on `feat/organizations-integration`. The spec is saved under `docs/planning/`. No live deployment, operator actions, or physical-device checks were performed.

`sharing/hooks/__tests__/sharedSightings.journey.test.tsx` verifies pagination retention during refresh and clearing on access loss/account changes. Shared pages return at most 50 Sightings, using numeric cursors rather than Storage tokens that could encode account identifiers.

V1 reads existing owner permission ledgers on demand; it does not add a separate organization index. Large deployments should add an indexed projection before increasing usage substantially. Foreground views refresh every 30 seconds; background/offline/blur clears loaded data. Revocation prevents subsequent authorized reads but cannot recall previously delivered copies.
