# Consent records (ADR-0009)

**Scope:** feature + fix
**Issues/spec:** ADR-0009; owner decisions 2026-11-25 (before Beta; minimal record, three years)
**Date:** 2026-11-25
**Branch/PR:** `claude/posthog-logging-best-practices-mhw8jo`

## Scope

**In scope:**

- [x] Fix: a second account no longer inherits the first account's analytics and email choices.
- [x] Server records of every consent choice; current choices restored on sign-in.
- [x] Erasure shrinks records to a three-year pseudonymous tombstone (Firestore TTL).

**Out of scope / not addressed:**

- In-app account deletion entry point (open item in the nutrition labels doc).
- Legal review of the retention period.
- Restoring the disclosure on a new device: OS permissions must be granted there anyway.

## Intent

**Purpose:** prove consent (GDPR Art. 7(1)), stop cross-account consent leaks, and stop re-asking returning users.

## Design decisions and reasoning

### Scope per kind

- **Decision:** the disclosure stays device-scoped; analytics and email choices are bound to `choicesUid`.
- **Reason:** the disclosure precedes sign-in (`useEntryGate`), so it has no account. The later choices do.
- **Affected journey/state:** sign-out then another sign-in; reinstall; upgrade.

### Restore before routing

- **Decision:** `useAuthAttempt` awaits `syncAccountConsent` (bind, restore, then send) before `nextConsentRoute()`, with a 4 s cap (`RESTORE_TIMEOUT_MS`).
- **Reason:** routing first would show the analytics screen to a user whose answer is about to arrive. Offline, the user is asked; the new answer becomes a newer record.

### Upgrade

- **Decision:** persist version 1. Saved v0 answers get `choicesUid = LEGACY_CHOICES_UID`; the first account bound adopts them and records them. A signed-out device clears them.
- **Reason:** an upgrade must not re-ask its signed-in user.

### Queue

- **Decision:** `pendingRecords` (cap 50) is sent in order, one at a time, stopping at the first failure. 400 drops the record; 410 (erased account) drops all. Another account's unsent records are dropped on rebind.
- **Reason:** order keeps history truthful; the server also refuses to let an older choice replace a newer current one.

## What shipped

- `functions/src/consent/consentRecords.ts` — validation, handler, tombstone rules.
- `functions/src/consent/firestoreConsentDb.ts` — Firestore adapter.
- `functions/src/index.ts` — `consentRecords` function; erasure port wired.
- `functions/src/erasure/eraseAccount.ts` — `consents.retire` before the Auth user.
- `firestore.indexes.json` — TTL on `consentTombstones.expireAt`.
- `src/shared/consent/useConsentStore.ts` — `acceptedAt`, `choicesUid`, `pendingRecords`, `bindChoicesTo`, `restoreChoices`, migration.
- `src/features/auth/lib/accountConsent.ts`, `src/features/auth/components/AccountConsentRuntime.tsx` — client sync; mounted in `AppProviders`.
- `src/features/auth/hooks/useAuthAttempt.ts` — awaits sync before routing.
- `EXPO_PUBLIC_CONSENT_RECORDS_URL` — `constants.ts`, release workflow, backend and builds guides.

## Tests

| Test file                                                                  | What it verifies                                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/auth/lib/__tests__/accountConsent.test.ts`                   | No inheritance across accounts; restore skips the screens; ordered resend after an outage; 410 drops the queue; v0 upgrade adopts choices. |
| `functions/src/consent/__tests__/consentRecords.test.ts`                   | Token uid only; malformed choices refused; auth refusals; erased account gets 410; tombstone minimal, three years; retry merges once.      |
| `functions/src/consent/emulator-tests/firestoreConsentDb.emulator.test.ts` | Late older choice stays history; erasure leaves only the tombstone with a TTL Timestamp.                                                   |
| `functions/src/__tests__/eraseAccount.test.ts`                             | Consent retirement runs before the Auth user is deleted; its failure keeps the account.                                                    |

Mutation check: removing the choice reset in `bindChoicesTo` fails the inheritance test.

**Not tested:**

- `AccountConsentRuntime` effects: glue over tested functions.
- Live Functions deploy and TTL activation.

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`; `npx tsc --noEmit -p functions`
- [x] App tests: `npx jest`
- [x] Functions tests: `npm test --prefix functions`
- [x] Emulator: `npx firebase emulators:exec --project demo-consent --only firestore "cd functions && npx jest -c jest.emulator.config.js src/consent --runInBand"`
- [x] Lint and format on changed files

**Unverified:**

- No device drive; no deployed function.

## Follow-ups and known limitations

- [ ] Deploy `consentRecords` and `firestore.indexes.json`; set the GitHub variable `EXPO_PUBLIC_CONSENT_RECORDS_URL`.
- [ ] Counsel to confirm three-year retention.
- Same-device users who share an account see each other's choices by design: choices are per account.

## 2026-11-25 — PR review fixes

**Purpose:** Keep consent reads and writes scoped to the active account through session restoration, request retries and erasure.

**Change:** Entry routes await a shared, bounded restore. Consent requests check the account around token retrieval, and acknowledgements remove the specific queued record. The server deduplicates retried events, checks the erasure marker in the append transaction and gives each retained event its own TTL document. Deploy both consent TTL policies. [PostHog review fixes](2026-11-25-posthog-logging-best-practices.md#2026-11-25--pr-review-fixes)
