# Organizations: directory and sharing permissions

**Scope:** Feature

**Issues/spec:** User-approved Organizations implementation plan and subsequent clarifications

**Date:** 2026-11-07

**Branch:** `feat/organizations`, based on `origin/main`

## Scope

- [x] Organization domain class, geographic eligibility, and offline directory cache.
- [x] One global sharing configuration in Settings; fresh confirmation and default-on Anonymous checkbox on each Submission.
- [x] Multiple overlapping organizations; sighting-level “Report an injured cat” option.
- [x] Owner-authenticated permission snapshots, durable synchronization, and individual/organization-wide revocation.
- [x] PostHog flag evaluation independent of analytics consent.

**Deferred:** Organization creation/editing, organization accounts, organization-facing APIs, data delivery, notifications, rescue dispatch, and production deployment. Nothing in this feature grants an organization access to the app or raw submissions.

## Intent and decisions

Organizations receive permission only for explicitly selected Sightings within their service boundaries. Cat count and an approximate area are mandatory when sharing; name, email, phone, cat details, precise location, and photos are opt-in settings applied uniformly to all selected organizations. Anonymous is checked on each new Submission and suppresses every contact field. Optional settings default off. Name/phone values and preferences are stored per signed-in user; email comes from that user's account.

The existing Settings screen had no name/phone sharing configuration, so this feature adds it. Sharing preferences have their own explicit Save action; the existing authentication/settings Save/Discard workflow is retained.

Remembered organizations are suggestions, never consent for another Submission. Confirmation binds location, organizations, catalog version, settings, Anonymous, injury intent, account email, and the revocation epoch of each selected organization. Revoking an unselected organization leaves the confirmation intact. Restoring a draft resets confirmation. Changing a relevant value makes the checkbox unchecked. Reset/completion clears sharing with the existing Submission draft store; the permission outbox survives teardown.

Revocation stops subsequent access; copies already received cannot be recalled. The current phase delivers no copies. Both the form and permission management explain this limitation. The injury checkbox records intent and explicitly states that it neither contacts an organization nor requests rescue.

## Implementation

### Directory and coverage

`Organizations` owns catalog refresh, caching, and coverage filtering. The canonical pure types/geographic rules live in `functions/src/organizations/domain.ts`, re-exported through `src/types/Organizations.ts`, so Functions and the app use identical predicates without expanding the Functions compilation root.

The service returns a versioned catalog; clients keep active coverage intersecting a conservative envelope around the cache center. The radius controls offline cache coverage, never sharing eligibility. Display only organizations whose actual Polygon/MultiPolygon contains the Submission location. Outer boundaries count as inside; holes and their boundaries are excluded. Dateline crossing coverage is supported. The cache envelope intentionally permits extra candidates, which are filtered by actual containment before display.

Foreground/reconnection refreshes the saved cache center without acquiring new device location. The Submission form refreshes around its own location. Cached matching coverage remains usable offline. Missing location or directory data does not block ordinary sighting submission. Cache age, retry, empty, and connection states are visible in the form. Current catalog/version/eligibility are checked again on the server before permissions are recorded.

General location is a fixed 0.01-degree grid cell (~1.1 km north/south, narrower east/west at higher latitudes). Only cell bounds are projected; the exact point and street address are absent unless precise location was explicitly selected. Cat details use an explicit attribute allowlist, excluding IDs, boxes, and photo references.

### Permission service and synchronization

`organizationsApi` is a Firebase-ID-token-authenticated POST Cloud Function. Its actions are:

| Action               | Input beyond `action`                          | Result                                                                  |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `catalog`            | None                                           | Versioned organizations plus `cacheRadiusKm`                            |
| `list`               | None                                           | The authenticated user's permissions and organization revocation epochs |
| `grant`              | `mutationId`, `organizationId`, `grant`        | Updated user ledger                                                     |
| `revoke`             | `mutationId`, `organizationId`, `submissionId` | Updated user ledger                                                     |
| `revokeOrganization` | `mutationId`, `organizationId`                 | Updated user ledger                                                     |

A grant contains the cloud Submission ID, organization ID, catalog version, current organization epoch, disclosure version `1`, Anonymous, effective sharing settings, injury intent, and the confirmed account email when selected. The server independently loads `submissions/{verifiedUid}/{submissionId}/metadata.json`, validates coverage, derives cat count and injury intent, and creates a filtered snapshot. A changed email needs renewed confirmation. Anonymous/unselected contact values are removed before enqueueing and again during server projection.

The authoritative ledger is `organization-permissions/{verifiedUid}/ledger.json` in the default bucket. All access is through the Function's Admin SDK. Existing Storage Rules deny direct client access to this namespace and to the catalog. No application Firestore collections are added.

Storage generation preconditions provide compare-and-swap updates. Mutation IDs make retries idempotent. Individual revocation leaves a tombstone even if a grant has not arrived yet. Organization-wide revocation increments an epoch and revokes every existing grant; stale pending grants cannot restore access. Existing grants are immutable. New grants stop at 5,000 permissions or 20,000 processed mutations per user; revocations remain available after either limit.

A user-scoped persisted outbox retries on foreground/reconnection or explicit retry. Revocations take precedence; flag-off blocks pending grants while allowing revocations. A `409` marks a grant as requiring review; management can explicitly reconfirm against the latest catalog and epoch, with server coverage validation still required. Cancellation/revocation removes queued grants. Pending revocations are visibly pending until acknowledged. Sighting upload status is distinct from permission synchronization status.

### Flag behavior

The exact case-sensitive PostHog key is `Organizations`. The lightweight client calls `/flags/?v=2` with the public project token, an opaque installation UUID, and `geoip_disable: true`. It does not mount the analytics SDK, capture events, identify a user, or send contact/location properties. Existing analytics consent behavior is retained.

Missing, off, malformed, or failed evaluations default off. A successful cached flag result is usable offline for up to 24 hours. Revocation management stays available after flag-off. The flag is a rollout control, not the authorization boundary; ownership, geographic checks, and revocation are enforced independently by the service.

## Configuration and rollout

1. Create a boolean PostHog flag with key **`Organizations`**, initially disabled, using installation-based targeting. No PostHog management credential is available in this workspace, so creation in the remote project has not been performed.
2. Deploy `organizationsApi` separately when ready. Set the app's `EXPO_PUBLIC_ORGANIZATIONS_API_URL` to its HTTPS URL. Existing PostHog project token/host app configuration is reused. No deployment was performed in this change.
3. Optional Function parameters: `ORGANIZATIONS_CATALOG_PATH` defaults to `organizations/catalog.json`; `ORGANIZATIONS_CACHE_RADIUS_KM` defaults to `50`. Use the existing default Firebase Storage bucket.
4. Supply a valid versioned GeoJSON catalog through operator-controlled infrastructure. A missing catalog intentionally returns `{ "version": "empty-v1", "organizations": [] }`. Never seed fictional organizations into production. Catalog editing/provisioning tooling is deferred.
5. Increase catalog version whenever coverage, active status, or organization disclosure changes. Stale confirmations require review.
6. Enable the PostHog flag for the intended installation cohort after service/catalog verification. Turning it off stops new client grants while keeping revocation available.

No new project IDs, bucket identifiers, or credentials are committed.

## Tests

| Test                                                              | Load-bearing behavior                                                                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/organizations/__tests__/domain.test.ts`            | Boundaries, holes, overlaps through containment, dateline regression, malformed catalog, minimized projections, tombstones, epochs, replay                            |
| `functions/src/organizations/emulator-tests/api.test.ts`          | Real HTTP/Auth/Storage: authentication, ownership (404), 409 confirm-again cases, permanent 400s, minimization, revocation, replay, empty catalog, 429 limit          |
| `functions/src/organizations/__tests__/ledgerConcurrency.test.ts` | Concurrent first grants retry the generation conflict; narrow fake because the Storage emulator ignores `ifGenerationMatch`                                           |
| `src/lib/organizations/__tests__/sharing.journey.test.tsx`        | Actual form controls, overlapping selection, Anonymous, changed settings, draft restore/new Submission, selected-only epoch binding, account isolation, cache failure |
| `src/hooks/__tests__/organizationSubmission.test.tsx`             | Form-confirmed sharing → cloud ID grant, durable anonymous outbox after real submission teardown, history linkage                                                     |
| `src/hooks/__tests__/organizationOutbox.test.ts`                  | Store-written persistence, deduplication, cold-start drain, 409 review vs 400 pending, flag-off revocation, user isolation, review rebuild                            |
| `src/hooks/__tests__/organizationsFlag.test.ts`                   | Flags-only request, no identity/location/events, offline TTL, every non-enabled result turns an enabled flag off                                                      |
| `__tests__/rules/storage.test.ts` additions                       | Owner, another user, and unauthenticated clients cannot read/write/delete service catalog or ledger objects                                                           |

Client tests fake the organizations service at `fetch` (`src/test-utils/organizationsService.ts`), so the app's request wrapper and status mapping run. Expo Crypto UUID generation is explicitly controlled because its supplied mock does not return UUIDs.

## Verification status

- Passing: full client suite (105 suites, 491 tests); Functions suite (65 tests); Firebase emulator rules suite (39 tests); real HTTP/Auth/Storage integration journey (1 test).
- Passing: app/server TypeScript checks, Functions build, focused ESLint.
- Passing: Prettier checks for every changed source/test/documentation file and `git diff --check`.
- Unverified: physical-device layout, large text, VoiceOver/TalkBack, enabled Organizations rollout, and live Functions deployment. No native code changed.

## Follow-ups and limitations

- Organization management and delivery remain deferred. Before any photo delivery exists, sanitize embedded EXIF and Storage custom metadata when precise location is not selected; raw upload URLs must never become an organization-access mechanism.
- Contact preferences are device-local and user-scoped. The permission ledger is server-backed; preferences are not synchronized between devices.
- Revocation cannot recall downloads or screenshots. There is no delivery mechanism in this phase.
- The user-owned pre-existing `skills-lock.json` modification was preserved.

### 2026-11-07 — extension: verification without a device

**Purpose:** Complete the remaining local validation and fix failures found while exercising permissions beyond the initial targeted checks.

**Change:** Added a real HTTP/Auth/Storage emulator journey and CI execution, strengthened catalog/flag validation, and made reconfirmation and revocation robust at their failure boundaries.

- Reconfirmation now uses current global sharing preferences and the current account email. It replaces a pending mutation atomically with a new mutation ID, rejects stale dialogs/account or settings changes, and cannot resurrect a cancelled pending choice. The confirmation summary shows only selected contact values.
- Revocations remain possible when the ledger's admission limit for new grants has been reached.
- Catalog parsing rejects self-intersecting rings, repeated vertices, holes outside their exterior, and intersecting/overlapping holes. Dateline-crossing polygons and valid holes retain coverage support.
- A malformed successful PostHog response disables a previously cached enabled result; genuine network outages can still use an unexpired cached evaluation.
- `src/lib/organizations/__tests__/management.journey.test.tsx` exercises explicit Settings saving, user isolation, current-email/global-settings review, and flag-off cancellation using actual controls and stores.
- `functions/src/organizations/emulator-tests/api.test.ts` runs the actual HTTP handler with real Firebase Auth emulator tokens and Storage emulator objects. It checks unauthenticated/invalid/disabled accounts, ownership, simultaneous grants, minimized snapshots, idempotent revocation, stale-epoch denial, and ledger isolation.
- Run the new integration lane from the repository root with `npm run test:organizations:emulator`, after installing both root and Functions dependencies. It refuses non-loopback emulator endpoints before initializing Admin SDK. It uses no live Firebase credentials and does not deploy Functions.
- The existing Java/proxy-aware emulator runner accepts `--organizations`; CI's emulator job installs Functions dependencies and runs the new lane after Storage/Firestore rules tests.

**Run and passing:** `npm test -- --runInBand`, `npm test --prefix functions -- --runInBand`, `npm run test:rules`, `npm run test:organizations:emulator`, `npm run typecheck`, Functions build, focused ESLint, Prettier, and `git diff --check`. The full client run covers 491 tests across 105 suites; Functions covers 65 tests, rules 39, and the real API emulator journey 1.

**Additional verification:** Android and iOS Metro/Hermes JavaScript exports succeeded to temporary directories outside the repository. Android export emitted a nonfatal warning because the local `google-services.json` is absent. These exports verify bundling and are not native compilation or device tests.

**Still external/unverified:** physical layout, large text, assistive technology, remote Organizations flag creation and enabled-rollout behavior, live deployment, and real organization catalog data. The earlier decisions to defer organization management and data delivery remain in force.

**Read-only live check:** The configured PostHog `/flags/?v=2` endpoint returned HTTP 200 with the expected `flags` response shape. `Organizations` was absent, and evaluation therefore stayed disabled. The request used an opaque random ID with GeoIP disabled and sent no capture/identify event or user/contact/location data. Remote flag creation still requires a PostHog management credential.

### 2026-11-07 — extension: review fixes

**Purpose:** Fix review findings 3 (status classification) and 4 (confirmation reset by unrelated revocations), plus duplicated code, smells and weak tests.

**Service statuses** (`functions/src/organizations/errors.ts`, `RequestError`):

| Status | Cause                                                                     | Client effect                 |
| ------ | ------------------------------------------------------------------------- | ----------------------------- |
| 400    | Invalid grant, settings, IDs, action, organization mismatch, bad metadata | Stays pending; not for review |
| 404    | Sighting metadata absent for the verified user                            | Stays pending; not for review |
| 409    | Catalog/email/epoch changed, organization inactive, outside coverage      | Marked for review             |
| 429    | Grant admission limit reached                                             | Stays pending; not for review |
| 503    | Anything unclassified, including repeated generation conflicts            | Retried                       |

The 400/404/429 retry loop (finding 2) is unchanged.

**Confirmation binding:** the signature carries only the selected organizations' epochs. Pending revocation mutation IDs are no longer part of it.

**Structure:**

- One directory store (`useOrganizationDirectoryStore`) owns refreshes and the single staleness guard; `OrganizationsRuntime` alone handles foreground/reconnection, using the app's existing online status. Feature code no longer uses NetInfo, so the global NetInfo Jest mock was removed.
- `buildGrant` (`src/lib/organizations/sharing.ts`) is the only grant builder. The store's `prepareReview` loads catalog/epoch; `reconfirm` accepts a reviewed grant only if current choices rebuild it exactly.
- `effectiveSharingSettings`, `SHARING_FIELD_KEYS`, `CONTACT_FIELDS` and `offeredFields` are the single sources for contact suppression and field lists, server and client.
- `persistOrganizationSharing` writes through the store's own persist storage and partialize.
- `CheckboxBox` atom is shared by consent screens and organization checkboxes.
- The client grant no longer sends the unused `injured` field; the server derives injury from stored metadata.

**Found while fixing tests:**

- Adjacent repeated ring vertices were reported as self-intersection; the repeated-vertex check now runs first.
- The Firebase Storage emulator ignores `ifGenerationMatch`. The former emulator "concurrent grants" assertion passed by timing; ledger concurrency is now tested with a narrow generation fake.

**Run and passing:** client suite 105 suites / 496 tests, Functions 60, rules 39, organizations emulator lane 14, `npm run typecheck`, Functions build, ESLint on changed files, Prettier, `git diff --check`.

### 2026-11-07 — fix: consent races, account erasure, and outbox progress

**Purpose:** Address the three bugs found in review of PR #435.

**Change:** Recheck the original sharing confirmation after metadata upload and before enqueueing any grant. Withdrawing sharing or changing its settings during upload now completes the Sighting without granting the stale choice. Account erasure also removes the user's organization permission ledger, including when Sightings are retained, before deleting Auth. A grant rejected with 400/404/429 stays pending but is skipped for the remainder of that sync attempt so later grants can proceed; transport/service failures and failed revocations still stop the drain.

**Regression coverage:** The Submission journey keeps the actual form mounted during upload, exercises withdrawal and switching back to Anonymous, and checks that the Sighting completes with no stale persisted grant. Outbox coverage checks progress past a permanent rejection without retrying it in the same drain. Account-erasure coverage checks ledger removal for both Sighting choices and preserves the Auth-last failure boundary.

The account-deletion change is also recorded in the [account-erasure note](2026-11-03-ccr-c65ac557-hnxla4-account-erasure.md#2026-11-07--fix-erase-organization-permission-snapshots).

**Test iterations:** The initial consent journey failed because rendering a separate hook displaced the form as the active test render. The corrected journey calls the real `submitDraft()` lifecycle with the form mounted; all three consent cases pass.

**Verification:** Full client suite: 116 suites / 546 tests passed. Functions suite: 7 suites / 62 tests passed. App/server TypeScript checks, Functions build, focused client ESLint, Prettier on every changed file, and `git diff --check` passed. Rules/emulator integration and device checks were not rerun; nothing was deployed.

## 2026-11-09 — refactor: reusable organization permissions

**Purpose:** Keep organization permissions independent of optional membership and sharing UI.
**Change:** Added explicit viewer authorization/projection, CAS JSON helpers, permission-transition blocking and explicit consent replacement. The authenticated API accepts a feature adapter at composition time. See [spec](../planning/organization-membership-and-sharing.md).
**Tests:** `permissions.test.ts` checks private-field exclusion, revoked content, transition locks and stale-grant rejection. Verification recorded with integrated feature notes.

## 2026-11-09 — refactor: Firestore organization backend

**Purpose:** Implement the user's explicit Firestore decision and strengthen asynchronous failure handling.
**Change:** Normalized Firestore organization/permission documents, transactional mutation receipts, epoch-based revocation, deletion guards, indexed shared reads, server-only Rules, and common cancellable loading/pagination infrastructure. Supersedes Storage-only organization persistence; Submission files remain in Storage. See [ADR-0008](../adr/0008-firestore-for-organizations.md). Feature-specific wiring and final verification are recorded in the membership/sharing notes.

**Firestore verification:** App/server/test TypeScript checks, Functions build, focused client ESLint, Prettier, and diff checks pass. Full client suite: 120 suites / 554 tests. Functions: 8 suites / 65 tests. Real Auth/Firestore/Storage emulator journeys: 24 cases, including concurrency, fail-closed metadata, deletion guards, outage handling, and legacy import. Rules: 27 tests, including direct Firestore access denial. The former Storage-generation fake was replaced by real Firestore transaction concurrency coverage. Android/iOS Metro/Hermes exports pass to `/tmp/feral-spotter-organizations-firestore-export`; Android emits the existing nonfatal missing `google-services.json` warning. Native compilation, physical layout/assistive technology, live Firestore provisioning/index deployment, and live migration remain unverified.

**Rollout:** See the saved spec's Firestore rollout section. Runtime organization data never falls back to Storage. The importer defaults to dry-run, preserves old revocations/receipts, resumes create-only writes, and is a no-op after completion. Direct catalog publication uses the new Firestore publisher. No live operator commands were run. The HTTP function uses 512 MiB, concurrency 1, and a 60-second server deadline to bound photo-processing memory; client requests have a 15-second end-to-end deadline and reconcile ambiguous write outcomes.
