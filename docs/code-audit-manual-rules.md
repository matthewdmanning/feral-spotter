# Rules Excluded From the Grep-Scoped Audit

These rules from `docs/COMBINED_STYLE_GUIDE.md` have no reliable, judgment-free grep signal, so they're excluded from `docs/code-audit-grep-plan.md`. Checking them requires reading a full file (or full function/class) and applying design judgment, not confirming a textual match — a different process from the grep-scoped audit, not covered by this plan.

"Partial" rows have a heuristic pattern that narrows candidates but still needs judgment on every match. "Manual" rows have no useful textual signal at all — a full read is the only option.

## Semantic rules

| Rule | Grep pattern | Greppable? |
|---|---|---|
| Do not add named properties to arrays | `as any\)\.\w+\s*=` | Partial |
| Spread only compatible values | `\.\.\.\(.*&&\|\.\.\.\[.*&&` | Partial |
| Keep getters pure | `get\s+\w+\s*\(` | Manual (flags candidates only) |
| Make `toString` safe | `toString\s*\(` | Manual (flags candidates only) |
| Do not rely on static dynamic dispatch | `static\s+\w+\s*\([\s\S]*?this\.` | Partial |
| Use `readonly` where applicable | — | Manual |
| Initialize fields at declaration | — | Manual |
| Use appropriate visibility | `private [\s\S]*?\[["'\`]` | Partial |
| Prefer function declarations for named functions | `^(export )?const \w+ = (async )?\([^)]*\) =>` at top level | Partial |
| Choose arrow bodies based on return use | `\.then\(\(.*\) => \w+\(` | Partial |
| Avoid rebinding `this` | `function\s+\w*\s*\([^)]*\)\s*\{[\s\S]*?this\.` | Partial |
| Keep parameter initializers simple | `\(\s*\w+\s*=\s*\w+\+\+` | Partial |
| Use explicit enum comparisons | — | Manual |
| Parse numbers with `Number()` | `parseInt\(\|parseFloat\(\|(?<![.\w])\+\w+(?=[;)])` | Partial |
| Avoid assignments in conditions | `if\s*\([^=!<>]*[^=!<>]=[^=]` | Partial |
| Narrow caught errors | `catch\s*\(\s*\w+\s*\)\s*\{` (no `: unknown`) | Partial |
| Make switch statements exhaustive | `switch\s*\(` (then check for missing `default`) | Partial |
| Avoid unsafe assertions (`as`, `!`, `<T>`) | `\bas\s+\w+\)\.\|\w!\.\|<\w+>\w+` | Partial |
| Keep `try` blocks focused | — | Manual |

## Structural rules

| Rule | Grep pattern | Greppable? |
|---|---|---|
| Choose imports deliberately | `import \{[^}]{80,}\}` | Partial |
| Do not create static container classes | `class \w+ \{[\s\S]*?\}`, all members `static` | Manual |
| Use type-only imports and exports | — | Manual (needs type info) |
| Use parameter properties | — | Manual |
| Use computed class members only for symbols | `\[\s*["'\`]\w+["'\`]\s*\]\s*\(` inside `class` | Partial |
| Prefer interfaces for object shapes | `^type \w+ = \{` | Partial |
| Use structural typing explicitly | — | Manual |
| Choose array type syntax by complexity | `Array<[A-Z]\w*>` | Partial |
| Prefer simple types over mapped and conditional types | `Pick<\|Omit<\|Partial<\|Record<.*,.*>\s*&` | Partial |
| Use tuples only when positional meaning is clear | `\):\s*\[\w+,\s*\w+\]` | Partial |
| Keep nullable unions at use sites | `^type \w+ = .*\|\s*(undefined\|null)` | Partial |
| Prefer optional properties and parameters | `:\s*\w+\s*\|\s*undefined;` | Partial |
| Avoid return-type-only generics | `<T>\([^)]*\)\s*:\s*T\b` | Partial |

## Informational and documentation rules

| Rule | Grep pattern | Greppable? |
|---|---|---|
| Mark deprecations clearly | `@deprecated` (then check it gives real migration instructions) | Partial |
| Distinguish JSDoc from implementation comments | — | Manual |
| Format JSDoc correctly / wrap JSDoc tag descriptions | — | Manual |
| Write JSDoc in Markdown | — | Manual |
| Start method descriptions with third-person verb phrases | — | Manual |
| Document parameter properties with `@param` | — | Manual |
| Add information, not repetition | — | Manual |
| Clarify unclear call-site arguments | `\(\s*\w+,\s*(true\|false),\s*(true\|false\|["'\`])` | Partial |
| Do not define new decorators | — | Manual |

## Process-level rules (not checkable against a single snapshot at all)

No grep pattern applies — these describe review-time or whole-project judgment, not a textual pattern:

- Organize files consistently
- Preserve local consistency without violating the guide
- Separate broad reformatting from focused changes
- Treat generated code as mostly exempt
- Optimize for maintainability
- Follow conformance rules
