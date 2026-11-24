# Code audit fixes — navigation and UI lens

**Scope:** fix
**Issues/spec:** `docs/reviews/2026-11-24-code-audit-navigation-ui.md` (NAV-1, 3, 4, 5, 6, 8; NAV-T-1, 3, 4), decisions in `docs/reviews/2026-11-24-code-audit-decisions.md`
**Date:** 2026-11-24
**Branch/PR:** `fix/audit-navigation-ui`

## Scope

**In scope:** NAV-1, NAV-3, NAV-4, NAV-5, NAV-6, NAV-8, the "Finished!" label, the Photo Library → consent report (investigated).

**Out of scope:** NAV-2 and NAV-7 (unchanged by decision); P3s NAV-9–16 and NAV-T-2/5/6 (filed as issues).

## What shipped

| Finding   | Change                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NAV-1     | `useBackHandler` answers only while its screen is focused (`useIsFocused`); `useDraftExitPrompt`'s own focus check removed. Data Agreement before consent: first Back ignored, second Back shows Consent's Decline warning ("Permissions Required", then exit); new Deny button does the same (`useDataAgreementDecline`, `consentDisclosure.json` `denyLabel`). Opened from Settings after consent: plain Back, no Deny. |
| NAV-3     | Home Continue and the Sightings resume card use `router.navigate('/submission/create')`. Other push sites and NAV-2 unchanged.                                                                                                                                                                                                                                                                                            |
| NAV-4     | `controlWidth.compact` (96) and `ButtonRow width="compact"`; Annotate's three buttons fit side by side at 1.0× on 360dp and stack at the reflow scale.                                                                                                                                                                                                                                                                    |
| NAV-5     | `useFeralReports` returns `status: loading \| failed \| ready`. Loading shows a spinner, not "No sightings yet". A failed read puts an error card with Retry over the map. An empty map shows the last known position, else `FALLBACK_MAP_CENTER` (Great Sphinx, 29.9753, 31.1376) (`useEmptyMapCenter`, `mapViewForPoint`).                                                                                              |
| NAV-6     | `DialogShell` backdrop is a `KeyboardAvoidingView` (`padding`); its ScrollView keeps taps while the keyboard is up.                                                                                                                                                                                                                                                                                                       |
| NAV-8     | `computeEntrypointDiameter` takes the measured entrypoint area; both circles and the minimum gap fit it. Home's content sits in a ScrollView that grows to the screen and scrolls past it.                                                                                                                                                                                                                                |
| Finished! | Submission Details' submit button reads `submissionCopy.finishedLabel` ("Finished!"), matching `cat-list-empty-state.md`. Retry copy names the button.                                                                                                                                                                                                                                                                    |

## Photo Library → consent screen (user report)

Traced, not reproduced; no fix shipped. No JS path from `usePhotoEntrypoints.library.open` → `pickFromLibrary` reaches `/consent` or `/intro-flow`: the only writers are `useEntryGate` (Home), `intro-flow` finish and `useConsentPermissions`. On Android 13+ `getMediaLibraryPermissions` is empty, so no OS prompt repeats either. Leading hypothesis: Android kills the process while the legacy document chooser (`legacy: true`) is in front, and the cold restart runs Home's entry gate. Needs a device drive (`docs/agents/test-driving.md`) with logcat across the picker round trip.

## Tests

- `flow.dataAgreementBack.test.tsx` (real router, Android Back dispatch over every real subscriber) — first Back ignored, second declines, Onboarding's slide unchanged; Deny declines; consented user goes back (NAV-T-1). Fails on the pre-fix code.
- `CreateScreen.backPrompt.model.test.tsx` — now drives the real `useBackHandler` instead of a stand-in.
- `ButtonRow.test.tsx` — three compact buttons on 360dp: side by side at 1.0, stacked at reflow (NAV-T-3).
- `FeralReportsScreen.test.tsx` — loading shows no empty state; failed passes Retry to the map. `useFeralReports.status.test.ts` — rejected read → failed, retry → ready (NAV-T-4).
- `SightingsMap.empty.test.tsx` — empty map centres on the device position, else the fallback.
- `entrypointDiameter.test.ts` — area-bound diameter, room left, floor kept.
- Home/Sightings tests assert `router.navigate` for resume.

## Verification

- Run: `npm run typecheck`, `npm test` (690 tests), ESLint on changed files.
- Unverified on device: NAV-6 keyboard overlap, NAV-8 sizing on a short phone at 2.0× text, NAV-4 label wrapping at 96dp, the empty map's native camera, the Photo Library report.
