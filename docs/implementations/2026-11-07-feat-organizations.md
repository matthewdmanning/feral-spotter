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

Remembered organizations are suggestions, never consent for another Submission. Confirmation binds location, organizations, catalog version, settings, Anonymous, injury intent, account email, and revocation revision. Restoring a draft resets confirmation. Changing a relevant value makes the checkbox unchecked. Reset/completion clears sharing with the existing Submission draft store; the permission outbox survives teardown.

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

| Test                                                       | Load-bearing behavior                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `functions/src/organizations/__tests__/domain.test.ts`     | Boundaries, holes, overlaps through containment, dateline regression, malformed catalog, minimized projections, tombstones, epochs, replay |
| `functions/src/organizations/__tests__/api.test.ts`        | Authentication, ownership, coverage/catalog rejection, projection, generation conflict retry, mutation idempotency, empty catalog          |
| `src/lib/organizations/__tests__/sharing.journey.test.tsx` | Actual form controls, overlapping selection, Anonymous, changed settings, draft restore/new Submission, account isolation, cache failure   |
| `src/hooks/__tests__/organizationSubmission.test.ts`       | Cloud ID mapping, durable anonymous grant after real submission teardown, history linkage                                                  |
| `src/hooks/__tests__/organizationOutbox.test.ts`           | Durable retry, deduplication, review-required state, flag-off revocation, user isolation                                                   |
| `src/hooks/__tests__/organizationsFlag.test.ts`            | Flags-only request, no identity/location/events, offline TTL, fail-closed evaluations                                                      |
| `__tests__/rules/storage.test.ts` additions                | Owner, another user, and unauthenticated clients cannot read/write/delete service catalog or ledger objects                                |

Native/external boundaries use existing SDK mocks. NetInfo's official Jest mock is registered globally because native reachability callbacks are unavailable under the React Native preset. Expo Crypto UUID generation is explicitly controlled in the new outbox/flag tests because its supplied mock does not return UUIDs.

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

## 2026-11-11 — refactor: UI/UX review and configurable copy

**Purpose:** Review the organization experience introduced by `f23b749` (the fetched tip of `feat/organizations`) and make all organization-facing copy configurable outside the components.

**Change:** Extracted headings, descriptions, field and checkbox labels, contact summaries, offline/loading/empty states, permission statuses, actions, confirmation dialogs, and sharing validation messages into `src/content/organizationsCopy.json`. Added a small named-placeholder formatter in `src/lib/organizations/copy.ts`. The initial disclosure now explains that delivery is unavailable before consent is requested. The initial Save-scope helper was removed after the follow-up copy review; control mechanics must not be explained in UI text. Existing design authority files were not changed.

### Configuring copy

Edit `src/content/organizationsCopy.json`, then rebuild the app. This is bundled configuration, not a remote content service. Keep the keys and placeholder names; change the text, punctuation, and placeholder order freely. Runtime organization names and account/contact values remain data. The field keys continue to map to the permission schema and must not be renamed.

- `fields` supplies disclosure labels; `shareFields` supplies complete checkbox labels. Labels are independent so languages do not have to construct a sentence by lowercasing a noun.
- `common.listSeparator` controls joined lists.
- Templates use `{organization}`, `{fields}`, `{contact}`, `{values}`, `{email}`, `{name}`, `{phone}`, and `{date}` where present. The formatter replaces values in a single pass so user-provided text containing braces is preserved.
- Dates use the device locale. Developer-only API diagnostics are not displayed as UI copy and remain in their service modules. The checkbox uses the shared vector icon vocabulary for its state indicator.
- Disclosure wording is consent-sensitive. If a future change alters what users authorize, review the disclosure version and reconfirmation policy alongside the wording.

### Review scope and verdict

Reviewed the new sharing card in Sighting creation, preferences in Settings, permissions in Settings and Sighting detail, directory states, consent invalidation, outbox status and revocation, flag-off behavior, account switching, and shared control/theme styles. This is a source and rendered-component journey review; it does not establish native visual or assistive-technology sign-off. No organization-specific current-state design document exists in this revision.

**Verdict:** Good privacy defaults and offline foundations, with usability gaps to resolve before a broad enabled rollout. Copy configurability and the delivery disclosure are addressed here; token corrections and reachability qualifications are recorded below. The remaining findings are review recommendations, not implemented redesigns.

All user paths below assume the operator has deployed the service/catalog and enabled the Organizations rollout. No live rollout was performed here. A test that seeds stores or replaces authentication does not, by itself, establish a human path.

| ID  | Priority / status                              | Human path and revised finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | P1 / addressed                                 | Open Sighting creation with the feature enabled. The form now states that organization delivery is unavailable before consent. Actual delivery and rescue response are not reachable in this implementation.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R2  | P1 / reachable                                 | Save a permission on device A; sign into the same account on a fresh device B; lose connectivity before its first ledger load; open Settings. `sync()` swallows the failure and an empty local ledger hides the management card and retry action. A fresh device has no local Sighting history, so the reachable entry point is Settings, not a historical Sighting detail screen. Expose load failure and retry as status/actions.                                                                                                                                                                                                                                |
| R3  | P2 / reachable, narrowed                       | Share two separate sightings with the same organization, then open Settings. Its ledger rows lack sighting identity, but saved rows have no per-sighting revoke action: choosing the wrong saved row to revoke is not possible there. The organization-wide trigger already names the organization and says “all”. Retain the indistinguishable pending-cancellation rows and generic dialog target details as P2 usability issues. Include sighting identity in pending rows and the target in confirmation. Do not assume a saved grant and a pending grant for the same sighting/organization can be independently created: `enqueue()` deduplicates that pair. |
| R4  | P2 / reachable                                 | Change sharing preferences, then use the screen footer Save; only the separate sharing action persists them. Alternatively save sharing preferences, then use footer Discard; those preferences remain saved. The mismatch is real, but explanatory Save/Discard prose is prohibited. Resolve it through save ownership or component grouping. The earlier helper text has been removed.                                                                                                                                                                                                                                                                           |
| R5  | P2 / reachable, narrowed                       | Select Share name or Share phone, leave the new field empty, save, then select an organization and turn Anonymous off. The included-field summary names an empty contact field. The added control journey verifies this without injecting malformed preferences. Missing account email is excluded from the finding: released Google and email/password sign-in supply an email; Apple/Facebook are gated and no anonymous sign-in UI exists. `email: null` remains a defensive/test fixture state, not an established released user journey.                                                                                                                      |
| R6  | P2 / consent-label concern only                | Save photo or precise-location preferences, then select an organization with Anonymous on. The label still only suppresses contact data. The reachable concern is the meaning of the consent label; an organization actually receiving identifying photos is unreachable because delivery is deferred. Consider a concise contact-specific label. Do not describe this as a current data disclosure incident or add checkbox-operation instructions.                                                                                                                                                                                                               |
| R7  | P2 / reachable                                 | Mark a cat injured, select an organization, and review the included-field summary. Injury status is in the permission record but absent from that summary. Use a concise data summary. The numeric grid implementation and server validation sequence do not belong in UI copy.                                                                                                                                                                                                                                                                                                                                                                                    |
| R8  | P2 / reachable, narrowed                       | Review a permission after catalog conflict, or retry during a slow/disconnected request. There is no busy feedback or announced outcome; local preference saving also has no receipt. Repeated sync taps do not establish duplicate grants: `syncing` coalesces requests and mutation IDs deduplicate them. Add progress/status feedback, not prose describing the internal work.                                                                                                                                                                                                                                                                                  |
| R9  | P2 / reachable, narrowed                       | For a Library pick sighting, confirm sharing, reopen the Map picker, change its location and return; alternatively save changed sharing preferences in Settings and return. Confirmation becomes unchecked and submission can require confirmation again. Use a short expired/required status and appropriate focus. Editing the obscured form beneath the confirmation dialog is not a human path; direct store mutation during a modal is only a concurrency test. Catalog/ledger refresh while a dialog is open is an external event and should be classified separately.                                                                                       |
| R10 | P2 / partially addressed; native checks open   | A user can choose large system text or a long organization name, and can open the keyboard for sharing contact fields. Replaced the font-scaled check glyph with a bounded vector icon and prevented box shrink. Shared TextButton labels now permit wrapping, and checkbox indicators align to the first text line using the runtime font scale. Keyboard visibility and physical layout remain native validation risks, not observed failures. The checkbox's disabled prop is not set by this feature's UI, so disabled-checkbox usability is not a current human-path finding.                                                                                 |
| R11 | P3 / reachable redundancy; scale risk deferred | Revoke the last active permission for an organization, then open Settings: its revoked ledger rows still produce a revoke-all action. That redundancy is reachable. A 5,000-permission screen is not a demonstrated user failure; the server admission limit alone is not a realistic-use fixture. Many legitimate sightings could eventually grow the ledger, so measure realistic account sizes before prescribing a management-screen redesign.                                                                                                                                                                                                                 |
| R12 | P3 / reachable                                 | Navigate the new cards with a screen reader after sharing multiple sightings. Card titles now have header roles; repeated actions still lack target-specific accessibility labels. Retain the action-target finding; actual VoiceOver/TalkBack behavior still needs native validation.                                                                                                                                                                                                                                                                                                                                                                             |

### Reachability corrections

Excluded from current human findings: email-less released accounts, actual organization delivery, interacting with controls obscured by a modal, a disabled sharing checkbox, and per-saved-row revocation from Settings. Also excluded as defect evidence: duplicate sync/grant writes inferred from repeated taps, and treating a seeded maximum-size ledger as a demonstrated performance failure. Different sightings shared with the same organization, empty user-entered name/phone, fresh-device ledger failure, and revoked-only organizations remain reachable. Deployment prerequisites do not make a valid enabled-rollout path impossible, but none of those paths is claimed as a live-production observation.

### Semantic-token audit

Scope: every new organization component and its stylesheet, the added integration in Settings / Sighting creation / Sighting detail, and the shared AppButton, TextButton, TextField and GlassSurface used by the feature. Reviewed role meaning as well as whether an expression references a token; substituting an unrelated token with the same numeric value is not compliance.

| Area                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization cards   | Added missing `radius.xl`; used `layout.cardPadding` and `layout.sectionGap`, with smaller spacing inside related control groups. Removed card-local vertical margins because the host layout already supplies spacing. The native Android GlassSurface reads the passed radius, so this also corrects square organization cards.                                                                                                                                                               |
| Heading hierarchy    | Changed organization card headings from screen-level `textVariants.title` to `textVariants.heading`, matching other Settings/detail cards. Body and supplementary copy retain `body` / `bodySmall` and `colors.text` / `colors.muted`.                                                                                                                                                                                                                                                          |
| Touch target         | Replaced literal 48 with `controlHeight.touchTarget`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Checkbox geometry    | Added the missing semantic `controlSize.checkbox` and `borderWidth.control` tokens in the theme definitions, replacing local 24 / 24 / 2 literals. These roles had no existing equivalent; icon size and photo-frame border tokens would be misleading aliases. `radius.sm` and `colors.borderStrong` are retained.                                                                                                                                                                             |
| Checked state        | Kept `colors.accent` for the fill/border; replaced page-background foreground with `colors.accentText`. The check is now the project's CheckIcon at `iconSize.sm`, replacing a bold text glyph. `flexShrink: 0` is a structural constraint, not a missing visual token.                                                                                                                                                                                                                         |
| Shared controls      | AppButton uses accent/on-accent, secondary/on-secondary and danger/on-danger roles. TextButton tone roles, TextField input/text/border roles and GlassSurface theme tint/fallback roles are correct. Their existing raw stroke widths (1 / 1.5), disabled opacity (0.5 / 0.7), and AppButton's pressed transform are baseline literals, not introduced by this feature. They remain candidates for a separate shared-control token migration. Transparent fill is intentional absence of paint. |
| Host screens         | Existing palette, typography, spacing, radii and safe-area calculations use their intended roles. Existing Settings divider/footer widths and the Sighting creation pressed opacity are baseline literals. Percentage dimensions, responsive max width and cat-image dimensions are layout/content constraints, not substitutions for checkbox or spacing tokens. No new raw styles were introduced by the organization integrations.                                                           |
| Contrast calculation | On-accent icon/fill is 6.50:1 dark and 6.48:1 light. Body/surface is 12.73:1 / 17.19:1, supplementary text/surface 9.65:1 / 9.38:1, and checkbox border/surface 5.20:1 / 4.50:1. These are calculations from the actual theme values against solid fallback surfaces, not measurements of native glass compositing.                                                                                                                                                                             |
| Coverage             | Visual values in the organization stylesheet use theme tokens, runtime font-scale geometry or React Native's native hairline width. Structural flex/alignment values are not visual tokens. Typography spreads, hierarchy and the icon's semantic size/color were reviewed manually. No raw palette values or custom font weights remain in organization components. This is a source/props audit, not native pixel validation.                                                                 |

### Strengths retained

- Optional fields start off, Anonymous starts on for each new sighting, and remembered organizations do not authorize a new grant.
- Confirmation is bound to account, location, settings, catalog and revocation revision; restored drafts require confirmation again.
- Cached coverage is filtered by the sighting location, with separate no-location, loading, empty, stale/offline and failed-refresh copy. Ordinary submission remains available without sharing.
- Permission and sighting upload states are separate. Revocation remains available with the rollout flag off; pending revocation is explicitly distinguished from server acknowledgement.
- Shared theme tokens support both appearances; checkbox targets have a 48dp minimum and labels can wrap. Native contrast, layout and focus still need a device pass.

### Validation

- Passed: 5 focused suites, 14 tests covering sharing and management journeys, submission teardown, outbox retry and rollout flags. The sharing journey now also verifies the delivery disclosure is visible before confirmation.
- Passed: `npm run typecheck` (app and server), focused ESLint with no remaining warnings, changed-file Prettier checks, and `git diff --check`.
- A TypeScript AST inspection found no remaining English text nodes or multiword string literals in the organization components; catalog/account values and the visual checkbox mark remain runtime data/state.
- Browser launch was attempted with mock authentication/uploads. With this revision's locked dependencies installed, Expo refused web startup because `react-native-web` is absent. No web support was added as part of this mobile feature review. `adb` is also unavailable, so native light/dark appearance, 200% text, keyboard navigation, TalkBack and VoiceOver remain unverified.
- Initial reuse of the main checkout's installed dependencies was invalid for this older branch (React Native Testing Library 14 versus the branch's 13); those results are not counted as feature regressions. The passing results above used this worktree's locked dependencies. No live service mutation, rollout change or deployment was performed.

## 2026-11-11 — refactor: reachable-state review, copy rule and semantic tokens

**Purpose:** Remove unreachable or overstated UX scenarios, prohibit component-mechanics explanations in project copy, and check semantic token usage throughout the organization UI and its shared dependencies.

**Change:** Rewrote the findings above with explicit human paths and exclusions. Added `docs/code_standards/UI_COPY.md` and a required-read entry in the agent instruction index. Removed Save-scope and checkbox-default explanations, shortened offline/reconfirmation/status text, and removed server-validation narration. Retained concise data-consent and service-availability facts. Corrected card hierarchy/radii/spacing, touch target and checkbox size/stroke/foreground tokens; replaced the text check mark with the project vector icon. All organization strings remain in `organizationsCopy.json`. Existing authoritative design files were not edited.

**Tests:** Added a SharingCheckbox rendering regression for on-accent foreground and bounded vector size (failed before the change, then passed). Added a sharing journey using actual settings controls to establish the empty-name state without inventing an email-less account. **Validation:** 9 focused suites / 39 tests passed, including the new reachable empty-name journey and checkbox rendering regression, organization submission/outbox/flag tests, shared button/surface tests, and theme-mode tests. App/server TypeScript checks, focused ESLint, changed-file Prettier and `git diff --check` passed. Semantic role and fallback-surface contrast checks cover both palettes. Native glass, physical layout and assistive-technology validation remain unavailable for the reasons above.

## 2026-11-11 — refactor: organization layout, alignment and native glass

**Purpose:** Improve component placement, padding, text hierarchy and visual grouping while preserving the project's native glass surfaces and concise-copy rule.

**Change:**

- Settings groups sighting-data preferences and contact preferences under short configurable headings. Each contact input/value now sits directly under its corresponding checkbox and aligns with the checkbox label. Sharing cards sit after Communications and before Authentication.
- Sighting detail places organization permissions immediately after the sighting summary, before potentially long cat details. Sighting creation keeps sharing after cat information and before the pinned submission actions.
- Cards use 16dp theme padding, 24dp between major groups, 8dp within control groups and 4dp between related summary text. Native hairline dividers separate consent/permission sections and footer actions. Permission names use the label role; statuses use subordinate text on a separate line. Empty permission lists do not create blank sections in the reachable revocation-only state.
- Checkbox indicators align with the first text line, including runtime font scale; the label keeps flexible width. TextButton labels now permit shrinking/wrapping inside the card. All targets retain the shared 48dp minimum. Card and group headings expose header semantics; the Settings navigation action is a link.
- All three organization cards still render `GlassSurface kind="card"`, with theme tint and `radius.xl`, over each host screen's `AmbientBackground`. Internal groups remain transparent; there are no nested glass layers or opaque card-local fills. Android uses LiquidGlassView, iOS uses Expo GlassView where available, and accessibility/unsupported/fatal-backdrop states retain the shared theme-surface fallback. No simulated browser blur was introduced.
- Only short section headings were added to `organizationsCopy.json`. Removed unused combined-row templates after separating names and statuses. No explanatory component-mechanics copy was added.

**Tests:** `TextButton.test.tsx` guards the resolved label style that allows long organization actions to wrap; it failed before the fix. `SharingSettings.glass.test.tsx` renders the real sharing card and checks native tint, the Android native `glassCornerRadius`, card padding and the reduced-transparency fallback. Existing organization journeys and shared GlassSurface platform/failure tests also pass. These tests inspect JS/native props, not GPU rendering.

**Validation:** 10 focused suites / 30 tests passed. App/server TypeScript checks, focused ESLint, changed-file Prettier and `git diff --check` passed. Physical narrow-screen layout, large-text rendering, keyboard occlusion, TalkBack/VoiceOver and actual glass compositing remain unverified: this revision lacks web support and the environment has no Android device/emulator tools. The source audit and rendered-component tests do not substitute for that device pass.

Related scoped notes: [shared buttons](2026-08-26-issue-328-button-consolidation.md), [Sighting detail](2026-10-26-feat-reports-history-map.md).

## 2026-11-11 — fix: semantic styling for organization controls

**Purpose:** Align organization card geometry, hierarchy and checkbox indicators with the project theme and native glass vocabulary.

**Change:** Added checkbox-size and control-border tokens; used the shared card radius, section spacing, typography and touch target. Replaced the text check mark with the bounded project vector icon using on-accent color, preserved box width and aligned it to the first label line using runtime font scale. Added transparent grouping and native hairline styles for the following screen layout changes.

**Validation:** The checkbox rendering regression passed after failing on the old glyph. Both palette foreground/fill combinations exceed 6:1 calculated contrast. App/server TypeScript, focused ESLint and Prettier passed in the complete reviewed worktree. Native physical layout and glass compositing remain unverified.
