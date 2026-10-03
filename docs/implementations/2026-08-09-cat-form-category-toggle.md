# Cat Form: category-selector default state and toggle (#205)

## What shipped

- `SegmentedControl` (`src/components/atoms/SegmentedControl.tsx`) now accepts `value: T | undefined` and `onChange: (v: T | undefined) => void`. Tapping the already-selected option calls `onChange(undefined)` — options are deselectable, not a fixed-choice radio group anymore. `accessibilityRole` moved from `radio`/`radiogroup` to `button` with `accessibilityState={{ selected }}`, since a radio group's a11y contract implies exactly-one-always-selected, which no longer holds.
- `useCatForm` (`src/hooks/useCatForm.ts`) initializes all 8 fields to `undefined` on a fresh form (previously `CAT_DEFAULTS`, which pre-selected "Unknown"/"Unsure" chips for `earTipped`/`owned`/`pattern`/`sex` — the other four fields' defaults already had no matching option in their lists, so they only _looked_ correct). `handleClear` now resets to `undefined` instead of `CAT_DEFAULTS`, and its confirmation copy changed from "reset to defaults" to "will be cleared" to match.
- `useCatSubmit`'s missing-field warning (`src/hooks/useCatSubmit.ts`) now fires on `form[field] === undefined` instead of `form[field] === CAT_DEFAULTS[field]`. This is the actual behavior change #205 is for: a user who deliberately taps "Unsure" is no longer nagged about it, only fields never touched. `buildCat` substitutes `CAT_DEFAULTS[field]` for any still-`undefined` field at save time, since `ObservedCat` (the stored/uploaded shape) has no optional-category state — only the in-progress form does.
- `colorOptionsForPattern` (`src/screens/submission/cats/constants.ts`) widened to accept `CatPattern | undefined` since `form.pattern` can now be unset.

## Known limitation (not fixed here)

Re-opening a saved cat for edit shows "Unsure"/"Unknown" lit for fields the user never filled in — `buildCat`'s save-time fallback means storage has no way to represent "unset," only the draft form does. Issue #205's acceptance criterion is scoped to "a fresh Cat Form," which this satisfies; extending optionality into `ObservedCat`/the submission store was out of scope for this issue.

## Tests

- `src/components/atoms/__tests__/SegmentedControl.selectDeselect.model.test.tsx` — xstate model (`getPathsFromEvents`) covering the select/deselect/switch journeys on the atom directly.
- `src/hooks/__tests__/useCatForm.initialSelection.test.ts` — pins that a fresh form starts fully unset, and that an `existingCat` still hydrates correctly. Added because the SegmentedControl model test alone can't catch a regression to `CAT_DEFAULTS` initial state in `useCatForm` — this is the direct acceptance-criterion check.
- `src/hooks/__tests__/useCatSubmit.unsetFieldsWarning.test.ts` — the behavioral crux: warns on an all-`undefined` form, does not warn when every field was deliberately set to its "Unknown"/"Unsure" equivalent.

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint` on all changed/new files — clean
- `npx jest` — 120/120 passing (full suite, no regressions)
- Not verified on a physical device/emulator.

## Cross-branch note

`src/hooks/useCatSubmit.ts` is also touched by #206/PR #218 (the alert _message_ — bulleted list, dropped "Save anyway?" copy, lines ~122-129). This change edits the _filter_ logic (line ~118) and the header comment above it — different lines, should merge cleanly, but whichever of #205/#206 merges second should confirm both the bulleted message and the `=== undefined` filter survive.
