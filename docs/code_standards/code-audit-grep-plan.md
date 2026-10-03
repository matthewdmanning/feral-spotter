# Grep-Scoped Rule Audit Plan

How to run a style-guide audit (`docs/COMBINED_STYLE_GUIDE.md` against `src/**/*.ts(x)`) without loading the full codebase and the full rule set into context at the same time.

## Why

Feeding a subagent "all 108 files + all ~60 rules" makes it read every file in full against every rule — the context grows with files × rules and nothing is ever evicted mid-run (a subagent can't selectively forget part of its own context; only the harness's automatic compaction can, and that's coarse, not rule-aware). The fix is to shrink what's fed in per step: one rule (or a small related group) and only the code that plausibly violates it.

## Method

1. **Work rule-by-rule (or small rule group), not file-by-file.** For each rule in the table below, run its grep pattern(s) across `src/**/*.ts` and `src/**/*.tsx`.
2. **Capture snippets, not files.** Run the grep itself with a fixed context window — 3 lines before and 3 lines after each match (ripgrep: `rg -B 3 -A 3 '<pattern>'`) — so only that window ever enters context. Never open the matched file directly; the grep output (file path, line number, and its own captured context lines) is the only representation of that file the subagent sees.
3. **Feed the subagent only:** the rule's heading + one-sentence intent (from the style guide) and the batch of matched snippets for that rule. Not the other rules, not unmatched files.
4. **Subagent confirms each snippet** — grep is a coarse textual signal, not the rule itself, so the subagent must confirm each match is a real violation (matching the rule's "Bad" example intent) vs. a false positive (e.g. `==` inside a string literal, `any` inside a comment).
5. **Write confirmed violations immediately** to a running results file (`docs/code_violations_raw.md`: `file | line | rule`) before moving to the next rule. Don't carry prior rules' snippets forward in context.
6. Once every rule has been processed, aggregate `docs/code_violations_raw.md` into `docs/code_violations.md`: `| Number of Violations | Rule |`, sorted descending.

## Rule → grep pattern table

Only rules with a reliable, unambiguous textual signal are included — no rule here requires judgment calls beyond "does this match confirm the pattern."

### Semantic rules

| Rule | Grep pattern |
|---|---|
| Use `const`/`let`, never `var` | `\bvar\s+\w+` |
| Do not use the `Array` constructor | `new Array\(` |
| Iterate objects safely (no bare `for...in`) | `for\s*\(\s*(const\|let)\s+\w+\s+in\s+` |
| Do not use function expressions | `=\s*function\s*\(\|[^\.]function\s*\(` |
| Wrap callbacks when signatures may differ | `\.map\(parseInt\)\|\.map\(Number\)` |
| Use stable references for removable handlers | `\.bind\(this\)` |
| Prefer rest and spread over `arguments`/`apply` | `\barguments\b\|\.apply\(\|Array\.prototype\.slice\.call` |
| Avoid redundant boolean coercion | `!!\w` |
| Prefer `for...of` for arrays | `for\s*\(\s*(const\|let)\s+\w+\s+in\s+\w+\)` |
| Use exceptions for exceptional conditions | `throw\s+["'\`]\|Promise\.reject\(["'\`]` |
| Explain empty catch blocks | `catch\s*\([^)]*\)\s*\{\s*\}` |
| Use strict equality | `[^=!<>]==[^=]\|[^!]!=[^=]` |
| Do not instantiate primitive wrappers | `new (String\|Boolean\|Number)\(` |
| Do not use `const enum` | `\bconst enum\b` |
| Remove `debugger` statements | `\bdebugger\b` |
| Do not use dynamic code evaluation | `\beval\(\|new Function\(` |
| Do not modify built-ins | `\.prototype\.\w+\s*=` |
| Avoid `any` | `:\s*any\b\|<any>\|\bas any\b` |
| Avoid `{}` as a general type | `:\s*\{\}` |

### Structural rules

| Rule | Grep pattern |
|---|---|
| Use ES modules (no `require`/namespaces) | `\brequire\(\|module\.exports\|/// <reference` |
| Use sensible import paths | `from ["']\.\.(/\.\.){3,}` |
| Use named exports | `export default` |
| Do not export mutable bindings | `export let ` |
| Prefer module-local functions over private static methods | `private static ` |
| Omit unnecessary constructors | `constructor\s*\(\s*\)\s*\{\s*\}\|constructor\s*\(\s*\)\s*\{\s*super\(\);?\s*\}` |
| Do not use ECMAScript `#private` fields | `#\w+` |
| Do not manipulate prototypes | `\.prototype\.\w+\s*=` |
| Use meaningful index signatures | `\[key:\s*string\]` |

### Informational / documentation rules

| Rule | Grep pattern |
|---|---|
| Document top-level exports | `^export (function\|class\|const)` not preceded by `/**` |
| Document classes for use | `^export class \w+` not preceded by `/**` |
| Do not duplicate TS types in JSDoc | `@param\s*\{` |
| Place documentation before decorators | `@\w+\([\s\S]*?\)\s*\n\s*/\*\*` |
| Do not suppress compiler errors broadly | `@ts-ignore\|@ts-nocheck\|@ts-expect-error` |
| Put JSDoc tags on separate lines | `@param.*@param` on one line |
| Treat generated code as exempt | `@generated\|DO NOT EDIT` (identifies exempt files) |

Rules requiring judgment (design intent, code structure, semantic correctness) or lacking any reliable grep signal are excluded from this audit entirely rather than approximated.
