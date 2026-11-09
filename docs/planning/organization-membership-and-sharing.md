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

The existing authenticated POST endpoint retains `catalog`, `list`, `grant`, `revoke`, and `revokeOrganization`. It additionally supports `memberships`, `joinOrganization`, `renameMember`, `organizationMembers`, `reviewLeaving`, `leaveOrganization`, `resumeLeaving`, `sharedSightings`, and `sharedPhoto`. All member operations act on the authenticated account; no client administration action exists. Shared pages contain at most 50 Sightings and use opaque Firestore document-key cursors. Photos are authenticated JPEG data responses, never public source URLs.

Organization backend data uses Firestore through the authenticated Functions API. Collections: `organizations` and `organizationCatalog/current` for directory data, `organizationMemberships` for individual memberships, `organizationPermissions` for individual consent snapshots, `organizationInvites` for hashed codes, and `organizationAccounts/{uid}/{states,mutations}` for epochs, locks, and retry receipts. Direct client Firestore reads/writes are denied. Photos and Submission metadata remain in Storage.

Directory geometry is stored as an unindexed `coverageJson` string because Firestore does not support nested coordinate arrays. Permission payloads and pending leave choices are also excluded from indexes. Organization-wide revocation advances an authoritative epoch atomically; retained-consent replacement is bounded to 400 records / 8 MiB and commits atomically. Account deletion hides names and shares immediately through a write-denial guard, then removes data.

Initial loading, refresh, empty, offline, forbidden, and retryable failure states are distinct. Reads cancel on blur/background/account changes; mutations are single-flight, idempotent, and reconciled after lost responses. Network/database failures never become empty directories or successful changes. The server checks current ownership, active membership, organization status, consent fields, epochs, and deletion state.

## Firestore rollout and legacy import

1. Provision a native Firestore database in the existing Firebase project and grant the Functions service account the least-privilege `roles/datastore.user` database access it needs. Deploy `firestore.rules` and `firestore.indexes.json` with the new Functions code; clients continue using the existing organization API URL.
2. For existing Storage organization data, pause organization API traffic/writes, back up the source, build Functions, configure Application Default Credentials, and explicitly set `FIREBASE_PROJECT_ID` and `GCS_BUCKET_NAME`. Run `node scripts/migrate-organization-data.mjs` to inspect counts without writes; add `--apply` to import. `ORGANIZATIONS_CATALOG_PATH` optionally identifies the old catalog object. Reruns resume create-only writes; completed imports are no-ops, including after account erasure. Keep source organization objects unchanged until verification; no live import is part of local testing.
3. New catalog publication uses `node scripts/publish-organization-catalog.mjs CATALOG.json` with an explicit `FIREBASE_PROJECT_ID`. Publication blocks directory-dependent reads until complete; rerun the same input after a partial failure. No fictional organizations are seeded.
4. Verify catalog, membership, shared reads, revocation, and account deletion before restoring organization traffic. Retire old Storage organization objects only after the import is verified. Runtime code has no Storage fallback for organization data.

Firestore follow-up branches: `feat/organization-membership-firestore` and `feat/organization-sharing-firestore`, integrated on `feat/organizations-firestore`.
