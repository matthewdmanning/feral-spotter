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

## 2026-11-10 — fix

**Purpose:** Review findings: a leave retry reusing an aborted mutation id stayed at 409; removal during a stuck leave left grants blocked.
**Change:**

- Each leave attempt gets a server-assigned `exit.attempt`; the block token and ledger receipts include it, so an aborted attempt's receipts never satisfy a retry.
- Operator removal releases a still-held leave block after revoking.
- Tests: `leave.model.test.ts` adds a corrected review reusing the rejected mutation id, and removal during a directory update followed by rejoin and a new share; both failed before the fix.

## 2026-11-15 — extension

**Purpose:** Give each organization a dedicated membership landing screen.
**Change:** Organizations list cards now link to `/organizations/[id]`. The new screen loads the signed-in user's membership and shows the organization name, status, display-name editing and leave/resume controls. Active members can open Members and, when the Organizations rollout is enabled, Shared Sightings. The existing member card is shared by both screens. Copy lives in `organizationCopy.overview`; no profile fields or backend contracts were added.

The screen distinguishes sign-in, loading, offline, error and missing-membership states. A journey test opens the landing screen from the list, refreshes pending membership to active, toggles the sharing rollout, and switches accounts to verify names and controls are cleared.

**Verification:** `npm run typecheck` passed. ESLint passed for the changed TypeScript files; Prettier and `git diff --check` passed. The new organization journey and existing membership journeys passed (2 suites, 4 tests). Native layout, keyboard behavior, themes and glass remain unverified: this environment has no Android emulator or `adb` available.

## 2026-11-15 — extension

**Purpose:** Make membership display names read-only and expose organization privacy through deliberate button actions.
**Change:** Membership cards show the display name as text; the rename field and Save action are removed from both the list and landing screen. The landing screen has a Privacy settings button opening permissions scoped to that organization, including after leaving. Opening the panel changes no permission; revocations require explicit confirmation. Account or organization changes reset the panel. New members still choose a display name when requesting membership. See [organization sharing](2026-11-09-feat-organization-sharing.md) for permission changes.

**Verification:** Membership, organization landing and permission-management journeys passed (3 suites, 7 tests), including read-only names and confirmation cancel/commit with sharing off. Native device layout remains unverified; no emulator or adb is installed.

Type checking, targeted ESLint, Prettier and whitespace checks passed.

## 2026-11-15 — refactor

**Purpose:** Resolve the organization UI review findings for semantic tokens, spacing, copy ownership and text scaling.
**Change:** Membership screens use `layout.gutter` and `layout.sectionGap`; shared organization cards use `layout.stackGap`, and checkbox targets use `controlHeight.touchTarget`. Membership, leave and loading text now uses the shared Text component and its configured font-scale ceiling. Membership labels, authored statuses, leave disclosure, errors and confirmation summaries live in `organizationCopy` in `src/shared/config/text.ts`. Existing field-label owners are reused rather than assembling sentences from schema labels. The generic overview guidance was removed and the privacy description shortened to the membership-name visibility fact. Copy is bundled TypeScript configuration: development reloads apply edits; distributed builds require a rebuild. See [organization sharing](2026-11-09-feat-organization-sharing.md) for permission-group spacing.

**Verification:** Type checking passed. Organization landing, membership, leave and permission-management journeys passed (4 suites, 9 tests). Native layout at narrow widths and enlarged text, keyboard behavior and native glass remain unverified: this environment has no emulator or adb.

## 2026-11-15 — extension

**Purpose:** One read-only account name for every organization; scannable, reorderable membership cards.
**Change:**

- Name source: the Firebase Auth profile name. `joinOrganization` reads it with `getAuth().getUser(uid)` and ignores any client `displayName`; a nameless account gets 400. Each join renames the account's other memberships, so every roster shows the same current name. `renameMember` is removed. Email Registration collects the name (`updateProfile`), and the auth provider re-notifies listeners because Firebase reports sign-in before the name is set.
- `MembershipSummary` drops `displayName` and adds `memberCount` (active members, Firestore `count()`) and `location` (`{ label, center }`). `label` is the new optional catalog field `organizations[].location`; cards fall back to the coverage bounding-box center, formatted with `COVERAGE_CENTER_FRACTION_DIGITS`.
- List cards show name, status, member count, location, View, and Leave/Cancel request. Members and Shared Sightings moved to the organization screen. The join form has no name field; joining is disabled for a nameless account.
- Arrange (header right, two or more memberships) swaps the list for draggable name cards with Save and Cancel pinned below. The held card lifts by `interaction.dragScale`. Save stores the order per uid on the device (`useMembershipOrderStore`); new memberships follow saved ones. `react-native-reorderable-list` could not be installed here, so `src/shared/ui/molecules/SortableList.tsx` uses a pan responder like InsetCropBubble.

**Tests:**

- `flow.memberships.test.tsx`: no name entry, nameless accounts cannot join, card contents, and Arrange drag with Cancel discarding and Save persisting.
- `flow.organization.test.tsx`: coverage-center fallback text.
- `firebaseAuthProvider.test.ts`: Registration names the account and re-reports it.
- `validateRegistration.test.ts`: blank name blocks Registration.
- `api.emulator.test.ts`: the Auth name is required and the client name ignored; count and fallback location; a profile rename reaches every roster.

**Verification:** `npm run typecheck`, ESLint (0 errors), Prettier, `npx jest` (136 suites, 611 tests), functions unit tests (65) and `npm run test:organizations:emulator` (4 suites, 44 tests) passed. Drag feel, native layout, both themes and glass remain unverified: no emulator or adb here.
