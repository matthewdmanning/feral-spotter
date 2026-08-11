# Handoff: cats-annotate-flow — #171 done, #172/#173 next

**Branch:** `sprint/cat-annotate-flow` (base for all tickets — #170 not in `main` yet)
**This session:** `issue-171-not-in-photo-skip-button` branched off `sprint/cat-annotate-flow`, commit `72f6169`, PR [#175](https://github.com/matthewdmanning/feral-spotter/pull/175) open against `sprint/cat-annotate-flow`. **Not merged.**

## Read first

- Spec: `docs/design/grilling/2026-08-04-cats-annotate-flow-spec.md` (= #169)
- ADR: `docs/adr/0004-cats-annotate-flow.md`
- Prior handoff (full #170 context, still valid): `docs/scratchpad/handoff-2026-08-04-cats-annotate-flow.md`
- This ticket's notes: `docs/implementations/2026-08-05-cats-171-not-in-photo-skip-button.md`

## State

| #   | Title                                 | Status                                     |
| --- | ------------------------------------- | ------------------------------------------ |
| 170 | Annotate discovers cats via first box | done, merged to `sprint/cat-annotate-flow` |
| 171 | "Not in this photo" skip button       | PR #175 open, unreviewed, unmerged         |
| 172 | Cat Form drops manual photo selection | `ready-for-agent`, unblocked               |
| 173 | Cat List auto-skip when empty         | `ready-for-agent`, unblocked               |
| 174 | Inset crop real component             | blocked on #168 (needs-info)               |

## What #171 added (relevant if #172/#173 touch the same seam)

- `useBoundingBoxStore`: new `absences` record, mutually exclusive with `boxes` per `cat_id:photo_local_id` key (`markAbsent` clears the box, `addBox` clears the absence).
- `PhotoPassStatus` is now `'pending' | 'located' | 'not-in-photo'`.
- `useAnnotatePass.handleNotInPhoto()` — same advance-to-next-photo pattern as `handleConfirmBox`; mirror this if #172/#173 add another bottom-bar action.

## Before starting #172/#173

- PR #175 unmerged — rebase/merge onto latest `sprint/cat-annotate-flow` if it lands first.
- No on-device run yet this sprint (#170 or #171) — do one before calling the sprint done, not just per-ticket.
- No `useAnnotatePass`/annotate-screen test coverage exists at all — don't expect it, don't feel obligated to add it solo unless the ticket calls for it.
