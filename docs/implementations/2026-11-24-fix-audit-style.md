# Code audit fixes — style lens

**Scope:** fix
**Issues/spec:** `docs/reviews/2026-11-24-code-audit-aesthetics-tokens.md` (STYLE-1/2/3/4/6/7, STYLE-T-2), decisions in `docs/reviews/2026-11-24-code-audit-decisions.md`
**Date:** 2026-11-24
**Branch/PR:** `fix/audit-style`

## Scope

**In scope:** STYLE-1, STYLE-2, STYLE-3, STYLE-4, STYLE-6, STYLE-7, STYLE-T-2.

**Out of scope:** STYLE-5 (not in decisions); P3s STYLE-8–10 and STYLE-T-1 (to be filed as issues). CatForm's table-driven rewrite is DUP-5 (duplication PR); here CatForm only reads its labels from `FIELD_LABELS`.

## What shipped

| Finding   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STYLE-1   | `ToggleRow` maps colors per state via `uniProps` → `switchColors(theme, value)`: off track `borderStrong`, off thumb `surface`, on thumb `accentText`.                                                                                                                                                                                                                                                                                               |
| STYLE-2   | `theme.opacity` = `pressed` 0.7, `disabled` 0.7, `busy` 0.5, `faded` 0.15. All six raw literals now read tokens (AppButton, TextButton, Home circle, shutter, cat row, cat title). TextButton disabled 0.5 → 0.7.                                                                                                                                                                                                                                    |
| STYLE-6   | `fieldSurface(theme)` in `TextField.styles.ts`: one input surface (fill, `borderWidth.control`, `borderStrong`, radius, padding). TextField and the Date/Time trigger both spread it.                                                                                                                                                                                                                                                                |
| STYLE-7   | New theme-independent `colors.onPhoto` (white) + `onPhotoHalo`. Annotate box and crosshair use them, with a 2px dark halo.                                                                                                                                                                                                                                                                                                                           |
| STYLE-3   | Copy literals moved to `text.ts`: new `errorCopy`, `annotateCopy`, `cameraCopy`, `libraryCopy`, `permissionCopy`; extended `commonCopy`, `historyCopy`, `submissionCopy`; `settingsCopy` for Settings. `formatCount(forms, count)` + `CountCopy` replace `s`-suffix plurals. `PhotoDraftNotice` uses one full sentence per case. Status enum shown through `historyCopy.statuses`. Flash a11y label from `cameraCopy.flash[mode]`, not the raw enum. |
| STYLE-4   | Removed control narration: Annotate trash tap now runs the remove flow (`handleRemovePhoto`, was long-press + "Long press to remove." alert); burst hint dropped; "— tap to set manually" and "tap Finished! …" removed; `includedNotice` keeps only the service fact; Haptic Feedback card is one toggle labelled "Haptic Feedback" (no "Vibration on Touch"); Profile Pic hint says "Choose", not "Tap".                                           |
| STYLE-T-2 | `eslint.config.js` src block: `no-restricted-syntax` bans hex/rgb literals and copy literals in copy-bearing props (`accessibilityLabel`, `title`, `label`, …) and `showAlert`/`showError`/`showSuccess` args; `react/jsx-no-literals` bans JSX text. Exempt: tests, `test-utils`, `themes.ts`, `text.ts`, `copy/`, feature `config/`, `attributes.ts`. Google TS bans moved to a shared `TS_SYNTAX` so the override keeps them.                     |

Also: `docs/DESIGN.md` U19 → partial (tap confirms; Undo not built).

## Tests

- `src/shared/config/__tests__/contrast.invariant.test.ts` — both themes: Switch tracks vs card glass, thumbs vs their track, disabled link labels at `opacity.disabled`, field edge vs fill and card, all ≥ 3:1. Failed on the pre-fix mapping (`border` track, `text` thumb, 0.5 disabled): 3 of 6.
- Updated to read copy owners: `useAnnotatePass.removeConfirm.test.ts`, `useDraftStartupStore.readyGate.test.ts`.
- Lint guard checked by hand: a `#fff` style, a literal `accessibilityLabel` and JSX text each error.

## Verification

- Run: `npm run typecheck`, `npx jest` (148 suites, 700 tests), `npm run lint` (0 errors; warnings pre-existing), `npm run format:check`.
- Unverified: no device drive. STYLE-7 halo on real photos and the Switch on Android/iOS need a device check. Glass contrast in the test is tint over `background`, no ambient gradient.
