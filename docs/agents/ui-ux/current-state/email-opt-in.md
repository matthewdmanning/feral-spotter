---
topic: email-opt-in
status: active
last_reviewed: 2026-10-24
governs:
  - src/features/permissions/communications/screens/email-opt-in/index.tsx
  - src/features/settings/screens/settings/index.tsx
  - src/shared/consent/useConsentStore.ts
derives_from: []
---

# Email Opt-In Design Decision

## Context

- First-run chain: sign-in or register, then `email-opt-in`, then `analytics-consent`.
- Settings has a "Communications" card with an "Email Updates" switch.

## Design Specifications

- The email opt-in screen comes before the analytics screen.
- The checkbox starts unchecked. Continue without a choice means "no".
- The choice never blocks the app. There is no decline warning.
- The screen has no header and no back gesture. It leaves with `router.replace`.
- The Settings switch shows the stored choice. A change applies at once. It does not wait for Save.
- The screen shows the account address masked, for example `j***@example.com`.
- A user who already chose is not asked again after sign-in.
- Settings shows the account email. It can send a verification link to a new address.
- Copy states that email goes to the address on the account. It states that the user can turn it off in Settings.

## Reason

- Email is an opt-in. The user must take an affirmative step.
- The user must be able to reverse the choice in one place, at any time.
- Asking before analytics keeps the two choices separate and in a fixed order.
