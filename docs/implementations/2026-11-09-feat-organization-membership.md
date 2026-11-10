# Organization membership

**Scope:** Feature. **Updated:** 2026-11-09.
**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md).

## Behavior

Signed-in users enter an invite code and a required display name, then await platform-operator approval. Ordinary members have no administrative permissions. Active members see a names-only roster and may open explicitly shared Sightings through the [sharing feature](2026-11-09-feat-organization-sharing.md).

Membership supports name editing, pending-request cancellation, and multiple organizations. Joining does not share Sightings or contact details. Display names are trimmed and limited to 1–80 characters.

Leaving defaults to unsharing all the user's content from that organization. Keeping existing shares requires explicit field selection, Anonymous choice, and fresh confirmation. Durable exit checkpoints and core permission locks make failures resumable. Each enrollment has a required identifier, preventing reused leave IDs from bypassing revocation after rejoining. Validation failures preserve membership and permit another choice. Operator removal revokes shared content.

## Data and authorization

Firestore stores one membership document per user and organization. Owner identifiers and enrollment IDs are private; roster responses contain display names only. Invite codes have 192 bits of randomness and are stored as SHA-256 hashes.

Transactions check account-deletion guards and organization status. Roster queries are indexed and paginated. Deletion guards hide names before physical cleanup finishes and prevent concurrent writes from recreating erased data.

The membership feature invokes core permission operations without importing sharing screens. The composition root supplies active-member authorization for shared views.

## Loading and operator tooling

Initial loading, empty results, offline status, and errors have distinct UI states. Mutations are single-flight, and ambiguous failures reconcile against the server checkpoint. Acknowledged permission changes update core state even if the membership screen was dismissed. Reads cancel when the screen closes or the account changes.

Build Functions, configure Application Default Credentials, and set `FIREBASE_PROJECT_ID` and `GCS_BUCKET_NAME`. Use `node scripts/organization-membership.mjs invite ORGANIZATION` or `approve|reject|remove ORGANIZATION UID`. The tool uses infrastructure credentials; it grants no app user administrative rights.

## Verification

The membership journeys cover joining, approval refresh, name editing with sharing off, account isolation, loading/error states, and foregrounding during an in-flight mutation. Leave-control tests cover default unsharing and renewed review after field changes. Server integration covers approvals, roster privacy, removal, revocation, retry checkpoints, and enrollment isolation.

See [combined verification](2026-11-07-feat-organizations.md#verification) for current test counts and limitations. No live operator commands or deployment were performed.
