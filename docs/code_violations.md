# Style-Guide Audit Results

Aggregated from `docs/code_violations_raw.md`. Two phases against `src/**/*.ts(x)` (108 files), rules from `docs/COMBINED_STYLE_GUIDE.md`:

- **Phase 1** (`docs/code-audit-grep-plan.md`): all 35 grep-scoped rules checked exhaustively.
- **Phase 2** (`docs/code-audit-manual-rules.md`): the 24 `Partial` rules were grep-counted, then subagent-confirmed for the top-volume and value-ranked candidates; the `Manual` rules (no grep signal) were narrowed via architecture/existence checks (e.g. no classes besides one excluded file, no enums, no decorators) and subagent-confirmed for the remaining real candidates. Phase 2 was not exhaustive — see notes below for what wasn't checked.

| Number of Violations | Rule |
|---|---|
| 8 | keep-try-blocks-focused |
| 6 | avoid-unsafe-assertions |
| 3 | document-top-level-exports |
| 1 | no-function-expressions |
| 1 | avoid-any |
| 1 | document-classes |
| 1 | use-named-exports |

**21 confirmed violations total**, across 11 files. Full detail per violation, including exact lines, is in `docs/code_violations_raw.md`.

## Notable clusters

- **`src/utils/api.ts` accounts for 6 of the 21 violations** (4 `keep-try-blocks-focused` + 2 `avoid-unsafe-assertions`) — the highest concentration of any single file, worth prioritizing if triaging by impact.
- **`keep-try-blocks-focused` (8) and `avoid-unsafe-assertions` (6) are the two largest clusters**, both from Phase 2's Manual/Partial passes, both genuine error-handling/type-safety gaps rather than style nits — bundled throwing calls with post-throw processing in one try, and unverified non-null/type assertions on data crossing a trust boundary (API responses, cached `AsyncStorage` JSON).

## Not exhaustively checked (Phase 2 scope notes)

- 16 of the 24 Partial rules had zero local grep signal and were not investigated further (no evidence to act on).
- 4 files were excluded from Phase 2 subagent checks after an earlier self-evaluation correction: `StatusIcon.tsx`, `src/screens/submission/create/index.tsx`, `DateTimePicker.tsx`, `settings/index.tsx` — any rule whose only known local evidence lived in these files was not re-verified.
- JSDoc-dependent rules (`mark-deprecations-clearly` and all JSDoc-formatting Manual rules) were excluded entirely — the codebase has zero JSDoc usage, so the answer is predetermined either way.
- A low-priority cluster of compile-time-only Manual rules (use type-only imports, use structural typing explicitly, use readonly where applicable) was identified but not checked — flagged as low stability impact, high relative cost (Manual rules require full-file reads, no grep narrowing).

## Known tooling gaps

- The `no-function-expressions` grep pattern misses *named* function expressions (e.g. `memo(function Foo() {...})`) — the one confirmed violation for this rule was found by manual inspection, not the pattern itself.
- The `avoid-assignments-in-conditions` pattern is unbounded past the `if (...)` condition's closing paren, producing false positives on unrelated `=>` tokens in the if-body. Broadened checks (while-loops, ternaries) confirmed 0 real violations exist anywhere in scope.
- The "parse numbers with `Number()`" pattern in `docs/code-audit-manual-rules.md` uses lookaround regex syntax that ripgrep's engine doesn't support; it silently matches nothing instead of erroring.
