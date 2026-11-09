# Organization membership and sharing

## Behavior

- Signed-in users enter an invite code and a required display name (1–80 trimmed characters), then await platform-operator approval. Members cannot administer organizations.
- Active members see a names-only roster and organization-shared Sightings. No member contact details or account identifiers are exposed.
- Joining never shares Sightings automatically. Shared views respect explicit consent, location precision, anonymity, and revocation. Member views exclude submitter contact fields. Photos are sanitized before delivery.
- Leaving defaults to unsharing all existing content and cancelling pending grants to that organization. Alternatively, explicitly reconfirm existing sharing fields and Anonymous for all retained shares. Failures remain incomplete and retryable. Other organizations are unaffected.
- Operator removal unshares by default. Rejoining never restores revoked content. Account deletion removes membership and roster names.

## Boundaries

`src/features/organizations/` owns the directory, core permission records, validation, persistence, projection, and revocation, with no membership dependency.

`sharing/{components,hooks,lib,screens}/` owns existing consent controls, sharing preferences/workflows, synchronization, and shared-pin/detail screens.

`membership/{components,hooks,lib,screens}/` owns joining, approval status, names, roster, and leaving. It invokes core permissions, not sharing screens. Server feature modules follow the same dependency direction; the composition root connects membership authorization to shared reads.

## Delivery

Common base: `feat/organization-core`. Separate feature branches from that base: `feat/organization-sharing` and `feat/organization-membership`. Integrate both for final verification. Preserve unrelated working changes.

## Verification

Verify authorization, name-only roster, consent filtering, sanitized photos, account isolation/deletion, default unsharing, changed retained permissions, failed/retried leaving, and stale-grant races. Core directory/permissions work without membership; membership works with sharing disabled; shared-pin screens can be removed independently. Run client/Functions tests, emulator integration, type checks, and formatting checks. No deployment is included.

## Implemented API

The existing authenticated POST endpoint retains `catalog`, `list`, `grant`, `revoke`, and `revokeOrganization`. It additionally supports `memberships`, `joinOrganization`, `renameMember`, `organizationMembers`, `reviewLeaving`, `leaveOrganization`, `resumeLeaving`, `sharedSightings`, and `sharedPhoto`. All member operations act on the authenticated account; no client administration action exists. Shared pages contain at most 50 Sightings and use numeric continuation positions. Photos are authenticated JPEG data responses, never public source URLs.

Membership data lives in `organization-permissions/{uid}/memberships.json`. Operator-generated invite codes are stored hashed in `organization-invites/`. Existing Storage Rules deny direct client access to both namespaces.
