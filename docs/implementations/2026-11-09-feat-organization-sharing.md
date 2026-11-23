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

## 2026-11-09 — extension

**Purpose:** Viewers can comment on and react to shared pins.
**Change:** Shared Sighting data stays read-only; the detail card adds the pin interactions thread. See [pin interactions](2026-11-09-pin-interactions.md).

## 2026-11-10 — fix

**Purpose:** Review findings: a failed background refresh blanked loaded results; polling reloaded every loaded page.
**Change:**

- `useOrganizationPager` clears pages only when access is lost (`isAccessLost`: 401/403/404); other failures keep them beside the error.
- Auto-refresh (30 s) runs only while one page is loaded; after "load more", refresh is manual. TanStack refetches every loaded page in sequence.
- `sharedPhoto` pins the Storage generation as returned, without `Number()` conversion.
- Test: `sharedSightings.journey.test.tsx` asserts a 503 refresh keeps both pages; it failed before the fix. Pin interactions use the same pager: [pin interactions](2026-11-09-pin-interactions.md).

## 2026-11-12 — fix

**Purpose:** Integrate the pin comment composer into the native Shared Sightings screen.
**Change:** The host scroll view allows handled child taps while the on-screen keyboard is open, so Post receives the first tap. Pin interaction identity includes the account and organization as well as the Sighting. The pager exposes access-loss state for the [interaction controls](2026-11-09-pin-interactions.md) to clear local receipts and disable writes. Native keyboard placement is unverified because `adb` is unavailable.

## 2026-11-15 — extension

**Purpose:** Allow privacy management directly from an individual organization's landing screen.
**Change:** OrganizationPermissions accepts an organization filter applied to saved permissions and pending actions. Scoped views show included fields, per-sighting revoke buttons and an empty state. Bulk revocation also covers pending-only grants. Confirmations name the organization and distinguish one sighting from all sightings; callbacks ignore confirmations from a different signed-in account. Revocation remains available with the sharing rollout disabled and shows pending connection until acknowledged. These controls manage existing permissions; new sighting sharing choices remain in the Submission flow. See [membership landing screen](2026-11-09-feat-organization-membership.md).

**Verification:** Organization landing, membership and permission-management journeys passed (3 suites, 7 tests). The new privacy journey checks organization filtering, Cancel preserving queued grants, confirmed revocation preserving another organization's grant, pending connection feedback and account-switch isolation. Native device layout remains unverified; no emulator or adb is installed.

Type checking, targeted ESLint, Prettier and whitespace checks passed.

## 2026-11-15 — refactor

**Purpose:** Keep privacy actions spaced within each saved or pending permission group.
**Change:** Permission row wrappers use the shared `permissionGroup` style with `layout.stackGap`, so nested Review and Cancel actions retain their own spacing independently of the outer card. See [membership UI review fixes](2026-11-09-feat-organization-membership.md) for shared token and copy changes.

**Verification:** Organization landing, membership, leave and permission-management journeys passed (4 suites, 9 tests); type checking passed. Native device spacing remains unverified because no emulator or adb is installed.

## 2026-11-15 — fix

**Purpose:** Fix the branch review findings for Shared Sightings, sharing permissions and organization screens.
**Change:**

- Cat details render through `describeCat` as labelled rows ("Ear Tipped: Yes"), not schema keys. Counts use plural copy ("1 cat").
- The map frames every pin and area with `mapViewForSpots` (moved to `src/shared/lib/mapView.ts`). Its camera, markers and polygons are memoized on values, so selection and polling no longer reset a pan. Map touches pause page scroll. Areas use the `mapArea` theme tokens, a translucent fill over light tiles.
- Selected-sighting details are a `GlassSurface` card directly below the map. Photos load one at a time.
- Permission labels and revoke dialogs name a sighting by its share date (`confirmedAt`), not its id.
- Copy for Shared Sightings, Members, pin interactions and service errors lives in `organizationCopy`. `interactions/copy.ts` is removed. All organization text uses the scaled `Text` atom.
- Tokens: `layout.mapHeight` (shared with the Reports map), `layout.photoPreviewHeight`, `controlHeight.touchTarget` for reaction chips, and a tighter `permissionGroup` gap. Refresh and timeout intervals are `ORGANIZATION_REFRESH_INTERVAL_MS` and `ORGANIZATION_REQUEST_TIMEOUT_MS`.
- `OrganizationQueryStatus` replaces the sign-in, offline, loading, error and Refresh block that four screens each repeated.
- `useVisibleQueryScope` counts visible screens per query and removes data one tick after the last one leaves. Before this, opening an organization dropped the shared memberships query and fetched it again.
- `MemberCard` closes its leave choices on a status change through state, not a remount key.

**Tests:** `SharedSightingsScreen.test.tsx` checks readable cat details, the singular label and one-at-a-time photo requests. `organization.journey.test.tsx` checks that opening an organization reuses the list's query; it failed before the fix.

**Verification:** `npm run typecheck`, ESLint (0 errors), Prettier and `npx jest` (137 suites, 612 tests) passed. Map framing, pan stability, scroll pausing, both themes and glass remain unverified on a device: no emulator or adb here.
