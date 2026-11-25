---
status: accepted
---

# Firestore consent records

Consent choices are recorded server-side in Firestore, through one Cloud Function. The device copy stays as the gate's cache.

Decided 2026-11-25 by the project owner: build before Beta; keep a minimal record for three years after erasure.

## Why

- GDPR Art. 7(1): the controller must be able to show consent was given. A device flag proves nothing.
- Device-only choices leaked: sign-out kept them, so the next account inherited the analytics and email choices.
- A reinstall or new device asked again. Restoring saved choices removes that friction.
- Firestore is already provisioned, server-only (ADR-0008). Custom claims hold no history; PostHog exists only after the analytics opt-in; Storage JSON is poor for per-account reads.

## Decision

- Kinds: `data_collection` (the disclosure), `analytics`, `email_updates`. Each record: granted, disclosure version, device time, server time, platform, app version.
- `consentRecords/{uid}` holds current choices; `events/` under it is append-only. A late older choice joins history, never current.
- The `consentRecords` function: GET current, POST one. The uid comes from the verified ID token. Rules deny clients.
- Scope: the disclosure belongs to the device (accepted before sign-in) and is recorded for each account that signs in on it. Analytics and email choices belong to one account. Binding another account, or none, clears them locally; sign-in restores them from the server before routing.
- The client queues choices and sends them in order; offline, it retries. A signed-out account's unsent choices are dropped.
- Erasure (#433): last step before deleting the Auth user. The records become `consentTombstones/{sha256(uid)}`: kind, granted, version and times only. Firestore TTL deletes it three years later (GDPR Art. 17(3)(e): defending legal claims). An erased account's token gets 410, so in-flight requests cannot recreate records.
- EmailOctopus keeps its own double opt-in proof (ADR-0007).

## Consequences

- Deploy `firestore.indexes.json` (TTL policy) with the function, or tombstones never expire.
- `EXPO_PUBLIC_CONSENT_RECORDS_URL` unset keeps today's device-only behavior, minus the account leak.
- Supersedes ADR-0007's open item "What the app records about the choice".
- Not legal advice: counsel should confirm the retention period before Beta.
