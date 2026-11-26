# Code review protocol

Shared rules for the review agents in `.claude/agents/` and `.codex/agents/`.
Codex agent names use underscores where the Claude names below use hyphens.
Each agent owns one lens.

## Lenses

| Agent                      | Lens                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `review-duplication`       | Hand-rolled code a library/shared module already provides; duplicates |
| `review-mvvm`              | View / ViewModel / Model separation, dependency direction             |
| `review-logic`             | Logic bugs: state, async, races, edge cases, error paths              |
| `review-navigation-ui`     | Expo Router navigation, screen wiring, shared UI component behavior   |
| `review-aesthetics-tokens` | Visual consistency, semantic token use, theme/glass/copy config       |

Stay in your lens. A finding owned by another lens: one line under _Handoffs_.

## Scope

- Default target: `src/`, `functions/src/`, `modules/*/src/` (JS only). The
  caller may narrow it (a diff, a folder).
- Out of scope: `android/`, `ios/` (generated); Kotlin/Swift; web; screen
  readers, TTS, external keyboards ([ui-ux-standards.md](ui-ux-standards.md)).
- Read-only on code. Never edit, stage, commit or push. Write only the report.

## Required reading

Read only what your profile lists, plus:

- [domain.md](domain.md) Language section — use its terms in findings.
- [testing.md](testing.md) — the test-review half of every lens.
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) — where code belongs.
- [using-design-decisions.md](ui-ux/reference/using-design-decisions.md) —
  `ui-ux/current-state/` beats other docs; a mismatch is an open question, not
  a verdict.
- `docs/adr/` files touching the area. Flag ADR conflicts; never override.

## Test review (every lens)

Review the tests covering your lens's findings and subject code. Report:

- **Coverage gap**: a likely failure in your lens with no test that catches it.
- **Never fails**: asserts a mock's own return, a constant, a tautology, or
  "operation started"; a branch that is unreachable; a source-text/regex test
  claiming to verify rendering. Name the realistic mutation it would miss.
- **Improper mock/fixture**: hand-rolled mock where the library ships one
  (testing.md table); mocked application store/logic under test; `fetch`
  stubbed instead of MSW; `showAlert` read instead of `pressDialogButton`;
  fixture bypassing `src/test-utils/` factories; fakes not typed against the
  real return type; Jest run cited for native code.
- **Misses regressions**: shallow per-case `it()` bloat, missing real user
  events (Back, cancel, retry, sign-out), un-awaited async outcomes, `flow.`
  test without its plain-language block.
- Do not ask for tests that only demonstrate coverage.

## Evidence rules

- Every finding cites `path:line` and quotes the decisive code (≤5 lines).
- Read the full function and its callers before claiming a bug. Grep for
  guards elsewhere before calling a case unhandled.
- UI findings name a human path: entry point, prerequisites, actions, result.
- Label each finding's basis: `source`, `test-read`, `ran` (only if you ran it).
- `node_modules` may be absent; if so, do not claim tests pass or fail.
- Confidence: `confirmed` (traced end to end) or `plausible` (needs check).
  Drop anything weaker.

## Severity

- **P1**: user-visible wrong behavior, data loss, broken core task, or a
  test gap hiding a likely P1.
- **P2**: material maintainability/usability/standards gap.
- **P3**: minor; batch these.

## Report

Write to `docs/reviews/YYYY-MM-DD-code-audit-<lens>.md` (caller gives the
date). Structure:

```markdown
# Code audit — <lens>

Reviewed YYYY-MM-DD on `<branch>` at `<short sha>`. Scope: <paths>.

## Summary

<3–6 bullets: top risks, counts by severity.>

## Findings

### <LENS-ID>-N — P1: <claim>

**Where:** `path:line` · **Basis:** source · **Confidence:** confirmed
**Evidence:** <quote + why it is wrong>
**Human path / failure scenario:** <inputs → wrong outcome>
**Fix:** <smallest correct change; name the existing module to reuse>

## Test findings

<Same shape; IDs <LENS-ID>-T-N.>

## Handoffs

- `<other lens>`: `path:line` — <one line>.

## Not reviewed

<What you skipped and why.>
```

Return to the caller: the report path and the Summary bullets only.
