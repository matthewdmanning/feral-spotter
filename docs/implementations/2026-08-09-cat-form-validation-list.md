# Cat Form: missing-field validation as a list (#206)

## What shipped

- `useCatSubmit.handleSave`'s missing-field warning (`src/hooks/useCatSubmit.ts`) now renders unset field names as a bulleted list (`• Age\n• Sex\n...`) instead of a comma-joined single line.
- Removed the redundant `— Save anyway?` suffix from the alert message body — the `Save anyway` button already conveys that option (per #152's original design, this was just leftover copy).

`Alert.alert` has no rich list widget, so "formatted as a list" is expressed as newline-separated bullet lines in the plain-text message body — the closest native equivalent.

## Tests

No new test — this is a copy/formatting change to an existing `Alert.alert` call, not a new business-logic branch. Existing `useActiveCatFlow.model.test.ts` and `CatObservationScreen.insetCropHeaderZone.test.tsx` (which exercise the surrounding cat-save flow) pass unchanged.

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint src/hooks/useCatSubmit.ts` — clean
- `npx jest` — 111/111 passing (full suite, no regressions)
- Not verified on a physical device/emulator.
