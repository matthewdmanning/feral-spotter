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
- `consentRecords/{uid}` holds current choices and a server `revision`, raised by every recorded choice; `events/` under it is append-only. Device time is evidence only, never the order. A revocation always becomes current. A grant replaces a revocation only if its device had seen that revocation (`basedOnRevision`); otherwise it is history.
- The `consentRecords` function: GET current choices and revision, POST one choice (answers the new revision). The uid comes from the verified ID token. Rules deny clients.
- Scope: the disclosure belongs to the device (accepted before sign-in) and is recorded for each account that signs in on it. Analytics and email choices belong to one account. Binding another account, or none, clears them locally. Every session refreshes them from the server: sign-in waits for it before routing, and analytics waits for it, since a cached grant may have been revoked on another device. A kind with an unsent local choice keeps the local value. Choices from before account scoping have no known owner: an upgrade keeps the device disclosure and drops them, then restores the account's own or asks again.
- The client queues choices and sends them in order. Each request has a deadline; failures retry with bounded backoff while the same account stays active. A signed-out account's unsent choices are dropped.
- Erasure (#433): last step before deleting the Auth user. A pseudonymous marker in `consentTombstones/{hash}` blocks new writes before the active records are read. `consentTombstoneEvents/{hash}` holds the minimal history, with kind, granted, version, timestamps and a link to the marker. Both collections expire through Firestore TTL three years after erasure began (GDPR Art. 17(3)(e): defending legal claims).
- EmailOctopus keeps its own double opt-in proof (ADR-0007).

## Consequences

- Deploy `firestore.indexes.json` (TTL policy) with the function, or tombstones never expire.
- `EXPO_PUBLIC_CONSENT_RECORDS_URL` unset keeps today's device-only behavior, minus the account leak.
- Supersedes ADR-0007's open item "What the app records about the choice".
- Not legal advice: counsel should confirm the retention period before Beta.
