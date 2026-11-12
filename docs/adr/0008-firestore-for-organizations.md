# ADR-0008: Firestore for organization data

**Status:** Accepted by explicit user instruction, 2026-11-09.

Firestore stores organization data. [ADR-0005](0005-firebase-storage-for-uploads.md) governs Submission files and upload limits; Firebase Auth provides identity.

Organization directory records, memberships, invite hashes, permission snapshots, revocation epochs, and mutation receipts use Firestore through the Admin SDK. Clients continue using the authenticated organization API. Direct Firestore access is denied by Rules.

Store one permission/membership per document. Use transactions for ownership/deletion checks, permission mutations, membership state, and idempotency receipts. Organization-wide revocation advances an epoch instead of rewriting every share. Shared views query indexed organization fields and use document-key pagination.

Consent replacement is atomic and bounded to 400 records / 8 MiB, below Firestore commit limits. Exceeding that bound leaves membership intact and permits leave-and-unshare. Normal app uploads are capped at 250 Submissions per user.

Firestore outages fail closed. Missing directories can be empty; unavailable or partially published directories return retryable errors. A recoverable catalog publication marker prevents partial directory reads. Account erasure removes organization names, memberships, permissions, receipts, and transition data, leaving only a minimal write-denial tombstone to prevent in-flight requests recreating deleted data.

Provision Firestore and publish the catalog directly. Enrollment IDs are mandatory in the membership schema.
