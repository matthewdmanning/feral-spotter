# Handoff: 2026-11-24 code audit → fixes

Last updated 2026-11-24. Branch `review/sonnet-code-audit` (docs only, pushed).
No code changed yet.

## State

- Five Sonnet review lenses ran over `src/`, `functions/src/`, `modules/*/src/`
  at `880c9b9`. Static only: `node_modules` absent, no tests run.
- User interviewed on every P1/P2. **Decisions are binding:**
  [2026-11-24-code-audit-decisions.md](../reviews/2026-11-24-code-audit-decisions.md).
  Where a decision differs from a report's suggested fix, the decision wins.

## References

| What                      | Where                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Decisions (start here)    | `docs/reviews/2026-11-24-code-audit-decisions.md`                                                |
| Findings, evidence, paths | `docs/reviews/2026-11-24-code-audit-{logic,navigation-ui,aesthetics-tokens,duplication,mvvm}.md` |
| Reviewer profiles         | `.claude/agents/review-*.md` (model sonnet)                                                      |
| Shared review rules       | `docs/agents/code-review-protocol.md`                                                            |
| Test policy (every fix)   | `docs/agents/testing.md` — failing-first test per bug                                            |
| UI rules                  | `docs/agents/ui-ux-standards.md`, `docs/agents/ui-ux/current-state/`                             |
| ADRs to amend             | `docs/adr/0003-time-capture-model.md` (LOGIC-1, LOGIC-4)                                         |
| Erasure context           | `docs/adr/0008-firestore-for-organizations.md`, `docs/agents/backend.md`                         |

## Next steps (in order)

1. `npm ci` so tests, typecheck and lint can run.
2. One PR per lens, each on its own descriptive branch off `main`:
   1. **logic**: LOGIC-1 (per-photo time, `unknown` when absent) → LOGIC-4
      (times only in `metadata.json`) → LOGIC-2/3/5/6. Amend ADR-0003.
   2. **navigation-ui**: NAV-1 (Data Agreement Deny + Back rule), NAV-3,
      4, 5, 6, 8; "Finished!" label; **new bug**: tapping Photo Library
      shows the consent screen again — trace it, not yet investigated.
   3. **style**: STYLE-1/2/3/4/6/7, plus the lint guard (STYLE-T-2).
   4. **duplication**: DUP-1–11.
   5. **mvvm**: MVVM-1–7, 15.
3. Test fixes ride in the PR of the lens that owns them (decisions § Tests).
4. File P3s as GitHub issues grouped by lens. Read
   `docs/agents/issue-tracker.md` and `triage-labels.md` first.
5. Each PR: implementation note per `docs/agents/documentation.md`.

## Gotchas

- New `.claude/agents/*` load only at session start; they're registered now.
- Plausible findings (NAV-2/3/6/7/8, LOGIC-5, STYLE-7) need a device check.
  Kotlin/Swift are unverified by Jest (`docs/agents/native-code.md`).
- Don't edit `ui-ux/current-state/` without user confirmation.
- User prefs: ask only load-bearing questions; ≤12-word sentences to the user.
