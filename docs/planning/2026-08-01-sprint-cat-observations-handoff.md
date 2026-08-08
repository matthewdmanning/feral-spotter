# Sprint: cat-observations — preliminary handoff

Working file, not committed (never commit handoffs — keep as uncommitted reference).
Branch: `issue-121-sprint-camera`. Written mid-`/grill-with-docs`.

**Grilling is now complete** (as of this update) — every open item below has a confirmed decision. What remains is execution: the two pending code reverts, the `CONTEXT.md` glossary entry, a re-run of `tsc`/`jest`, and eventually `/run`-driving the app. `/advisor` reviews each change before it's made, per explicit instruction.

## Original ask

> Cat Observations Page
>
> - Remove the "Identity" and "Condition" text boxes
> - Move "Hair Length" section above "Pattern" section
> - "Color" section behavior and choices displayed is dependent on "Pattern".
> - Pattern:Color scheme will be given in a separate reference later. Plan implementation of required behaviors for now.
> - Remove "Re-review" button completely.
> - Change "Save & Review Photos" text to "Save Observation".
> - Currently "Save & Review Photos" sends users to photo screen. Change wiring to send users back to "Submission Details" page.

## Status of the 6 original items

| Item                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/Condition boxes removed | Already done, prior commit `09f02fa` (#131)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Hair Length above Pattern        | Already done, same commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Re-review button removed         | Already done, same commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| "Save Observation" label         | Already done (else-branch), same commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Save wiring → Submission Details | **Confirmed to stay as-is** — save still routes to `/submission/annotate` when `annotation_enabled` + photos exist. I built and then reverted a change that always routed back; user explicitly chose to keep the existing annotation-routing branch. Don't revisit.                                                                                                                                                                                                                                                                                                                                                  |
| Pattern→Color dependency         | `colorOptionsForPattern(pattern)` is a pass-through stub (returns full `COLOR_OPTIONS` regardless of pattern) — real mapping table still pending a reference from Matthew. Confirmed: keep pass-through, only the mapping table changes later. **Color-reset rule (decided now, implemented later, once the mapping table lands):** if Color is selected and Pattern changes to a value whose valid-color list excludes it, Color resets to `'unknown'` — not auto-snap-to-first-valid, not left untouched. Not implementable yet (no mapping table to filter against), but the rule is locked for whoever builds it. |

## New work that emerged from grilling (not in the original 6)

Triggered by the Pattern:Color "plan implementation" line — grilling surfaced that several fields had no "Unknown" concept at all, which became its own scoped sub-task this session.

**health → health_label rename (done, confirmed):**

- `HealthLevel` (numeric `1|2|3`) deleted, replaced by `HealthLabel = 'poor'|'fair'|'good'|'unknown'`.
- Field renamed `health` → `health_label` everywhere: `ObservedCat`, `CachedCat` (`submissionCache.ts`), `SubmissionApiPayload.cats[]` (`Api.ts`), form state (`healthLabel`/`setHealthLabel`).
- `healthLabel()` display-derivation helper deleted — the stored value _is_ the label now.
- Reason (advisor-flagged, user agreed): a numeric sentinel (`999`) for "Unknown" is a poison value for any future cloud-side aggregation/sort/filter on health. String label sidesteps it entirely.
- **Backend note**: this changes the outbound wire shape to the Cloud Run ingestion endpoint (`health: number` → `health_label: string`). User confirmed they control the backend and will update it — not blocked, but don't ship without that backend change landing too.

**"Unknown" as a domain value, not `undefined` (settled after 3 wrong turns — model is now locked):**

- Every Cat Observation field always holds a genuine value of its own type. `undefined` is never used anywhere in form state or `ObservedCat`. (I tried this twice — once via optional/`undefined` fields with blank-on-load, once via a "Touched" boolean flag — both explicitly rejected. Do not reintroduce either.)
- Four fields already had a real, visible "Unknown"/"Unsure" option before this sprint: **Pattern** (`unknown`), **Sex** (`unknown`), **EarTipped** (`unsure`), **Owned** (`unsure`). For these, the default _is_ that option and it renders as a normally-selected pill — exactly as it already worked pre-sprint. No change in behavior for these four.
- Four fields had no such option: **Age**, **HairLength**, **Color**, **HealthLabel**. Each type gained a same-type `'unknown'` member (`CatAge`, `HairLength`, `CatColor` widened; `HealthLabel` already includes it). `CAT_DEFAULTS` defaults these to `'unknown'`. Critically: **no pill was added to their option lists** — fields that didn't show an Unknown option before still don't. The default value simply isn't in the rendered option set, so nothing highlights. That's it — no special suppression logic needed.
- Glossary term written to `CONTEXT.md`, new `### Cat observation` section: **Unknown / Unsure** — one concept, two labels, a real first-class value not an absence. `_Avoid_`: unanswered, not-yet-selected, undefined, Touched. Advisor-reviewed before writing.
- Non-blocking glossary note for later: `CONTEXT.md`'s existing **Submission** entry already lists `observation` on its own `_Avoid_` line, and the new section is headed "Cat observation." No practical conflict (a Submission and a cat's attribute-set are different things) but worth reconciling naming someday — not now.
- Submit-time validation (warn on empty fields, "!" marker, section highlight, popup) is **Beta work, deferred**, not this sprint. When it's built, proceeding past the warning is described as "the user implicitly selects the not-sure option" — but since values are never absent now, there's nothing for that flow to coerce; it would just be a warning UI layered on top of values that already default to Unknown.

## Current diff state (uncommitted, working tree)

```
 __tests__/hooks/useCatSubmit.reset.test.ts |  2 +-
 src/components/atoms/SegmentedControl.tsx  |  2 +-
 src/components/organisms/CatForm.tsx       |  7 +++----
 src/hooks/useCatForm.ts                    | 16 ++++++++--------
 src/hooks/useCatSubmit.ts                  |  2 +-
 src/hooks/useSubmissionStore.ts            |  4 ++--
 src/lib/cache/submissionCache.ts           |  2 +-
 src/screens/submission/cats/constants.ts   | 26 ++++++++++----------------
 src/types/Api.ts                           |  2 +-
 src/types/Cat.ts                           |  9 +++++----
```

All at target state, advisor-confirmed: `useCatForm.ts`/`useCatSubmit.ts` reverted (no `undefined` anywhere), health rename, option-list pill removals, the two `SegmentedControl`/`colorOptionsForPattern` type reverts, and the `CONTEXT.md` glossary entry are all applied. `tsc --noEmit` and full `npx jest` are clean (23/23 suites, 82/82 tests) against this final state.

## Not yet done

- Grilling is complete — every open item has a confirmed decision (this doc + `CONTEXT.md` capture them).
- `/run`-driving the actual app — next step, now that grilling's done. Known non-blocker to expect: a pre-existing local draft persisted with the old numeric `health` field will rehydrate with `health_label` falling back to `'unknown'` (renders blank on edit) — not a bug, not worth migration code pre-release.
- Still genuinely pending, not this session's work: the real Pattern→Color mapping table (reference from Matthew), and the Beta submit-time validation UI (warn-on-empty, "!" marker, popup).
