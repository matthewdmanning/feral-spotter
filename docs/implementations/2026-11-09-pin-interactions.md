# Pin interactions

**Scope:** Feature.
**Issues/spec:** User request, 2026-11-09: anyone permitted to view a shared pin may comment and react with emojis.
**Date:** 2026-11-09
**Branch/PR:** `pin-interactions`

## Scope

**In scope:**

- [x] Comments on a shared pin: post, list (paged), delete own.
- [x] Fixed-set emoji reactions: toggle own, per-emoji counts.
- [x] Server API, Firestore storage, client hook, UI in the Shared Sightings detail card.

**Out of scope / not addressed:**

- Revocation, unsharing, owner account erasure: interactions stay stored. Another function owns their cleanup.
- Author leaving/erasure trigger: the policy entry point exists; no lifecycle caller invokes it yet.
- Editing comments, moderation, reporting, notifications.

## Intent

**Purpose:** Members viewing a shared Sighting can discuss it and signal status without leaving the app.

## Design decisions and reasoning

### One authorization question

- **Decision:** `createInteractionsExtension` takes a `PinViewAuthorizer` (`uid, organizationId, pinId → boolean`). Every action checks it, and reads check it again before responding. `features.ts` composes it: active membership plus a current share (`currentPermission`).
- **Reason:** User decision: a separate feature; the only check is permission on the pin. No membership or sharing imports in `interactions/`.
- **Affected journey/state:** Unsharing or losing membership ends access (403) at once.

### Lifecycle not owned

- **Decision:** Revocation leaves comments and reactions in place.
- **Reason:** User decision: "This code does not own that action."

### Author-exit policy injected

- **Decision:** `AuthorExitPolicy = 'retain' | 'delete'`; `applyAuthorExit(policy, uid, organizationId?)` is the entry point for the lifecycle owner. Under `retain`, names resolve at read time through an injected `AuthorNameResolver`; a non-member author shows as "Former member".
- **Reason:** User decision: don't hardcode; allow either.

### Fixed reaction set

- **Decision:** Six server-validated keys in `interactions/domain.ts` (`REACTIONS`): 👍 ❤️ 👀 😿 🙏 ✅. Toggle states the desired end state, so retries are idempotent.
- **Reason:** User decision (fixed set). Specific emojis were Claude's default choice.

### Privacy and idempotency

- **Decision:** Responses carry `author` (display name or null) and `mine`; never the author uid. A comment's id is `sha256(uid/mutationId)`; a retry returns the same comment. The client reuses a mutation id until the text changes.
- **Reason:** Matches the names-only roster and the existing idempotent-write convention.

## What shipped

- Server `functions/src/organizations/interactions/`: `domain.ts` (reactions, limits, types), `store.ts` (Firestore), `api.ts` (actions `pinComments`, `pinReactions`, `addPinComment`, `deletePinComment`, `setPinReaction`).
- `membership/store.ts`: `activeMemberName`, the composed name resolver.
- Firestore: `pinComments` (`pinId`, `organizationId`, `authorUid`, `body`, `createdAt`), `pinReactions` (`pinId`, `organizationId`, `authorUid`, `key`). Index `pinId`+`createdAt`; `body` unindexed. Rules unchanged (deny all direct access).
- Comments: 1–500 trimmed characters, oldest first, 50 per page, document-key cursor.
- Client `src/features/organizations/interactions/`: `usePinInteractions` (memory-only, 30 s refresh, cleared on blur like other shared views), `PinInteractions` component. `useOrganizationPager` gained `params` for extra request fields.
- `SharedSightingsScreen` renders `PinInteractions` in the selected Sighting card.

## Tests

**Model or flow covered:** Pin access and thread state against real emulators.

| Test file                                                                                       | What it verifies                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/organizations/emulator-tests/pinInteractions.model.test.ts`                      | Outsiders refused; exact response keys (no uid); retried comment stored once; repeated reactions count once; unsharing refuses access but keeps data; departed author unnamed; `delete` policy removes their comments. |
| `src/features/organizations/interactions/components/__tests__/pinInteractions.journey.test.tsx` | Reaction toggle and selected state; lost post response retried with the same mutation id (one comment); text kept on failure, cleared on success; delete shown only on own comments.                                   |

Both tests were checked against a planted fault: an always-true authorizer fails 3 emulator journeys; a fresh mutation id per attempt fails the client journey.

**Not tested:**

- 50+ comment pagination (same cursor pattern as shared Sightings).

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`; `cd functions && npx tsc --noEmit -p .`
- [x] Unit/model tests: `npx jest` (121 suites / 551 tests); `cd functions && npx jest` (8 / 65)
- [x] Emulator: `npm run test:organizations:emulator` (4 suites / 40 tests)
- [x] Lint: `npx eslint src/features/organizations`
- [x] Formatting: `npx prettier --check` on changed files

**Unverified:**

- Device/simulator UI pass; Rules lane (`npm run test:rules`, rules unchanged); live deployment and index build.

## Graveyard: pivots and corrections

### Glossary gap

- **Finding:** "Pin" is not in `docs/agents/domain.md`; code and the sharing spec say "shared pin".
- **Impact:** This note uses "pin" for a shared Sighting as shown on the organization map.
- **Resolution:** Left for `/domain-modeling`.

## Follow-ups and known limitations

- [ ] Lifecycle owner calls `applyAuthorExit` on leave/removal/erasure with the chosen policy.
- [ ] Cleanup owner for interactions on unshared pins.
- Comments under `retain` survive account erasure until a caller applies `delete`.

## Implementation updates

## 2026-11-10 — fix

**Purpose:** Review findings: a deleted comment broke the next page; comments had no quota.
**Change:**

- Comment cursor is `<createdAt>_<id>` and pages by `startAfter` values, so deleting the cursor comment keeps the next page reachable.
- `COMMENT_LIMIT` (1000) stored comments per account, counted in `organizationAccounts/{uid}.commentCount`; deleting frees room; over the limit returns 429, shown as a comment-limit message.
- A failed reactions refresh keeps loaded counts unless access is lost (401/403/404). Shared pager change: [organization sharing](2026-11-09-feat-organization-sharing.md).
- Tests: `pinInteractions.model.test.ts` adds 51-comment pagination with the cursor comment deleted, and the quota; both failed before the fix.

## 2026-11-12 — fix

**Purpose:** Address the pin interaction UI/UX review: protect pending drafts, show reliable outcomes, and keep failures beside their actions.
**Change:**

- The composer retains its submitted text and becomes read-only while posting; only a confirmed success clears it. Retries retain the same mutation ID, including after a visibility interruption.
- Confirmed comments outside the loaded pages appear in a separate Posted group beside the composer, with their own Delete action. Loading their page removes the receipt without duplicating the comment or changing the oldest-first cursor order.
- Receipt state clears when visibility, account, pin, availability, or access changes. Late write responses cannot restore cleared receipts or reaction data.
- Reactions wait for their initial data, offer a local retry after failure, and retain known values through temporary background failures. Lost access hides the thread and reactions and disables writes.
- Posting, reaction, deletion, and thread errors appear beside the affected controls. A successful post remains confirmed when the subsequent thread refresh fails; reaction/deletion requests no longer show a posting spinner.
- Native scroll tap handling and account/pin identity are supplied by the [Shared Sightings host](2026-11-09-feat-organization-sharing.md).
- App-owned labels and statuses for this component now come from `interactions/copy.ts`; these are build-time configuration and require a new app build to change.

Regression coverage: `pinInteractions.feedback.test.tsx` exercises delayed posting, 50+ comment receipts and deduplication, initial reaction loading, temporary failure and lost access, independent action errors, and late-response/retry identity. The original retry/delete journey also checks posting-error placement. The three initial regression scenarios failed against the pre-fix implementation.

Verified: all 11 organization client suites / 36 tests; `npm run typecheck` (app, server, and tests); ESLint on changed interaction, pager, and host code; Prettier on changed files; `git diff --check`.

Native device layout, on-screen keyboard placement, and 2.0× text remain unverified: `adb` is unavailable in this environment. No web integration or external keyboard support was added.
