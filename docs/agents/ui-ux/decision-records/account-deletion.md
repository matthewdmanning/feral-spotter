---
topic: account-deletion
status: active
last_reviewed: 2026-11-25
governs:
  - src/features/settings/screens/settings/index.tsx
  - src/features/settings/screens/settings/AccountDeletionDialogs.tsx
  - src/workflows/account-deletion/hooks/useAccountDeletion.ts
derives_from: ['#433', '#401']
---

# Account Deletion Design Decision

## Context

- Settings screen / `SettingsScreen`: an "Account" card with a "Delete Account" button.
- Deletion guard / `AccountDeletionDialogs`: the warning, the Sightings warning and the password confirmation.

## Design Specifications

- The Account card is the last card in Settings. Its only action is "Delete Account", in the danger style.
- Pressing it opens a warning that the account will be deleted.
- The warning states what is deleted and that Sightings stay unless the user deletes them too.
- The warning states that deletion stops further use of the data it erases and does not recall data already exported, analyzed or used to train models.
- The warning has one checkbox: "Also delete my Sightings". It starts unchecked.
- With the box checked, confirming opens a second warning that the Sightings and their photos will be deleted. Photos saved on the device stay.
- Sightings are deleted if and only if the box was checked and the second warning confirmed.
- Cancel on any step closes the guard and deletes nothing.
- The user proves their identity before deletion: a password account enters its password; a provider account signs in again through the provider's own sheet. A provider failure never opens the password step.
- The password step's action names what it deletes: "Delete Account", or "Delete Sightings and Account" when the box was checked.
- While deletion runs, the guard shows a busy state and cannot be dismissed.
- After deletion the app returns to the first-run flow and shows "Account deleted". The success message appears only once nothing of the account is left on the device; otherwise the message states that some data is still on the device and will be removed.
- A failure keeps the account and shows "Could not delete account".
- When the server's answer is lost and the outcome cannot be confirmed, the app says so and checks again the next time it opens.

## Reason

- Deletion cannot be undone, so it needs a specific warning, a specific target and a deliberate confirmation.
- Deleting Sightings removes research data; the extra step makes that choice deliberate.
- The user must know the limits of deletion before choosing it.
- A rare destructive action stays away from everyday settings.
