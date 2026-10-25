---
status: accepted
---

# EmailOctopus for email updates

FeralSpotter sends opt-in email updates with EmailOctopus. The app does not
run its own mailing list, sender, or unsubscribe handling.

Decided 2026-10-24 by the project owner.

## Why

- The updates are broadcast news, not account messages. A newsletter tool
  fits that use.
- The tool handles unsubscribe links and list management.
- Free plan, as reported by a third-party comparison (2026): 2,500 contacts and
  10,000 emails per month. That is enough for beta. Verify current limits and
  nonprofit eligibility on the vendor's site before relying on them.
- `docs/agents/backend.md` says Firestore is not an application database. This
  decision adds no app-side store of addresses.

## Not decided yet

- How an opted-in address reaches EmailOctopus. The app has no server path
  for it today.
- Where the EmailOctopus API key lives. See `docs/agents/secrets.md`.
- How an opt-out in Settings removes the address from EmailOctopus.
- What the app records about the choice: time, copy version.

Until these are decided, `emailOptIn` is a local flag only. See
`docs/implementations/2026-10-24-feat-email-opt-in.md`.
