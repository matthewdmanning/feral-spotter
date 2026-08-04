# Sprint:cat-observations — #149-#153 grill decisions (2026-08-03)

Draft only. Nothing below was sent to GitHub — no `gh`/MCP call was
made. This mirrors the shape of a GitHub MCP `update_issue` call per
issue so the diffs can be reviewed before anyone applies them.

Grilled via `/grilling` + `/domain-modeling`, current bodies pulled
read-only via `gh issue view --json` for baseline comparison.

---

## #149

```json
{
  "tool": "github.update_issue",
  "owner": "<org>",
  "repo": "feral-spotter",
  "issue_number": 149,
  "title": "Cat Observations: relabel final 'Done' to 'Finished!'; disable when cat list empty",
  "body": "Part of #148\n\n**What:** rename the final-submit button from \"Done\" to \"Finished!\".\n\n**Where:** `create/index.tsx:178-180`, on the Submission Details screen. Same button as before #130's move — the old title/punchlist wording (\"Cat Observations screen\") is stale.\n\n**Behavior:** when `cats.length === 0`, render the button disabled — visible, greyed out, not pressable. Do not remove it from the screen.\n\n**Source:** `docs/design/2026-08-02-ui-bug-punchlist.md`, Camera run item 2."
}
```

**Diff from current:** title \"hide\" → \"disable\"; body adds the #130
post-move location correction and the disabled-not-unmounted decision.

---

## #150

```json
{
  "tool": "github.update_issue",
  "owner": "<org>",
  "repo": "feral-spotter",
  "issue_number": 150,
  "title": "Cat Observation form: remove 'Look' header (Observed Cat + Edit Cat)",
  "body": "Part of #148\n\n**What:** remove the \"Look\" section header.\n\n**Where:** `CatForm.tsx:57`.\n\n**Scope:** `CatForm` is a shared component, rendered by both the Observed Cat (new-cat) and Edit Cat (existing-cat) states of `src/screens/submission/cats/index.tsx`. Remove from both, not just Observed Cat — same section, same fields, no reason the label should read differently between the two.\n\n**Source:** `docs/design/2026-08-02-ui-bug-punchlist.md`, Camera run item 3."
}
```

**Diff from current:** title scope widened from \"Observed Cat screen\"
to both states; body adds the shared-component fact and scope decision.

---

## #151

```json
{
  "tool": "github.update_issue",
  "owner": "<org>",
  "repo": "feral-spotter",
  "issue_number": 151,
  "title": "Annotation Box screen: remove duplicate 'Done', relabel primary action to 'Boxing Complete'",
  "body": "Part of #148\n\n**Correction:** the original ask (\"remove Done and Cancel\") doesn't match current code. No \"Cancel\" button exists anywhere on this screen — not in `src/screens/submission/annotate/index.tsx`, its styles, or `AnnotateCarouselItem.tsx`. Nothing to remove there.\n\n**Where:** `annotate/index.tsx`. \"Done\" appears twice, both calling the same `handleDone` (`useAnnotateStateMachine.ts:91-111`).\n\n**What:**\n- Delete the top-bar \"Done\" (`annotate/index.tsx:81-87`) — it's a plain duplicate of the bottom-nav button.\n- Keep the bottom-nav primary button (`annotate/index.tsx:170-178`, currently reads \"Done →\" / \"Finish\" on the last photo) as the sole exit. Relabel it \"Boxing Complete\" in every state — replaces both \"Done →\" and \"Finish\", same text regardless of `isLast`.\n\n**Why this is safe:** the header back arrow and swipe-to-dismiss are already disabled at the layout level (`src/app/submission/_layout.tsx:63-72`, `headerShown: false`, `gestureEnabled: false`). The bottom-nav button was already the only way off this screen; its logic doesn't change, only its label.\n\n**Source:** `docs/design/2026-08-02-ui-bug-punchlist.md`, Camera run item 4."
}
```

**Diff from current:** title and body substantially rewritten — original
premise (remove Done/Cancel) didn't survive contact with the actual
code; this replaces it with the delete-duplicate + relabel-surviving-button
plan.

---

## #152

```json
{
  "tool": "github.update_issue",
  "owner": "<org>",
  "repo": "feral-spotter",
  "issue_number": 152,
  "title": "Edit Cat screen: add missing-field validation warning (non-blocking)",
  "body": "Part of #148\n\n**What:** warn when fields are left at their defaults before saving/continuing on the Edit Cat screen. Today there's no warning at all.\n\n**Correction:** #96's color-by-pattern constraint isn't actually implemented, despite the issue being closed — `colorOptionsForPattern()` (`src/screens/submission/cats/constants.ts:79-83`) still returns every color regardless of pattern. Not a blocker for this issue, flagged for awareness.\n\n**Fields checked:** all 8 `CAT_DEFAULTS` values — age, earTipped, owned, pattern, hairLength, color, sex, healthLabel. Form state lives in `useCatForm`, save logic in `useCatSubmit.ts`.\n\n**Rule:** a plain value-equals-default check, no touched/dirty tracking. A field the user deliberately set to \"Unknown\"/\"Unsure\" looks identical to one they never touched — that's an accepted trade-off, not a bug.\n\n**Behavior:** at save/continue, if any field is still at its default, show a warning listing which ones. This never blocks — the user can always save/continue anyway (e.g. \"3 fields not set — Save anyway?\").\n\n**Source:** `docs/design/2026-08-02-ui-bug-punchlist.md`, Photo library run item 3."
}
```

**Diff from current:** body adds the #96 status correction, the exact
8-field list, and the non-blocking-warning decision (title gains
\"(non-blocking)\" for visibility).

---

## #153

```json
{
  "tool": "github.update_issue",
  "owner": "<org>",
  "repo": "feral-spotter",
  "issue_number": 153,
  "title": "Relocate 'Reset' from Edit Cat to Submission Details screen",
  "body": "Part of #148\n\n**What:** move the \"Reset\" button from the Edit Cat screen to the Submission Details screen, next to the Finished! button (#149). \"Reset\" wipes the whole submission, so it belongs on the whole-submission screen, not a single cat's form. The button's logic is correct as-is — this is a location change only.\n\n**Where it is now:** `cats/index.tsx:32-34`, calling `submit.handleReset` from `useCatSubmit.ts:95-115`.\n\n**Why it can move cleanly:** `handleReset` only touches `clearDraft` and `clearPhotos` — it has no per-cat dependencies (`form`, `existingCat`, `annotationEnabled`), even though it currently sits inside the per-cat-scoped `useCatSubmit` hook.\n\n**Where it's going:** the logic moves into `useSubmissionSubmit.ts`, next to `handleDone` — the same hook `create/index.tsx` (Submission Details) already uses, same whole-submission scope. No new hook file.\n\n**Out of scope:** the \"Clear\" button (`cats/index.tsx:28-30`, clears just the current cat's form) stays where it is.\n\n**Source:** `docs/design/2026-08-02-ui-bug-punchlist.md`, Photo library run item 7."
}
```

**Diff from current:** body adds the exact source locations, the
hook-relocation decision, and the explicit Clear-button exclusion.
