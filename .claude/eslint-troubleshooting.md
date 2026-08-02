# ESLint Resolver Errors

**Trigger:** `expo lint` reports `Resolve error: typescript with invalid interface loaded as resolver` across *all* TypeScript files (not just one).

This project has had stale-cache false positives after resolver package version changes. Before investigating further, run:

```bash
~/.claude/agents/scripts/eslint-resolver-diagnose.sh <any-ts-file>
```

The `eslint-resolver-stale-cache` agent also covers this diagnosis end-to-end — prefer invoking it directly over running the script manually.
