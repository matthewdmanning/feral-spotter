# Organization sharing

**Scope:** Feature. **Updated:** 2026-11-09.
**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md).

## Behavior

Each Sighting requires explicit sharing consent. Sharing controls and workflows live in the sharing feature; core directory and permission stores live in organizations. Membership grants viewing access independently of the submitter's sharing choices.

Shared views show cat count, consented location precision, and permitted cat details/photos. Approximate locations appear as areas; precise pins appear only when explicitly shared. Member views exclude submitter contact fields, account identifiers, and raw Submission records.

Shared views are read-only and memory-only. Foreground views refresh every 30 seconds. Blur, backgrounding, lost connectivity, account changes, or denied access clear loaded data. Revocation prevents subsequent reads; delivered copies cannot be recalled.

## Firestore reads and photo delivery

Indexed queries return at most 50 Sightings per page, using opaque document-key cursors. Owner state is checked within a consistent read transaction. Missing or mismatched permission metadata, stale epochs, revoked permissions, deleting owners, or inactive memberships cannot grant access.

Photos use direct permission lookups and authenticated responses. Storage downloads are pinned to the checked generation, reencoded as JPEG without EXIF/XMP/IPTC, and returned without source URLs. Authorization and consent are checked before and after processing.

## Async behavior and verification

A cancellable, single-flight pager distinguishes loading, refresh, empty, offline, and failure states. Refresh retains loaded pages; failed photo requests offer an individual retry action. Requests have bounded timeouts, and account checks prevent stale responses from publishing another account's data.

Client journeys verify explicit consent, confirmation changes, pagination, and clearing after access loss. Functions tests verify actual image metadata removal and authorization denial. Emulator tests cover indexed pagination, privacy, revocation, account deletion, and concurrent permission writes.

See [combined verification](2026-11-07-feat-organizations.md#verification) for current test counts and limitations. No live provisioning or deployment was performed.
