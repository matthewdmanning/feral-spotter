# GitHub write conventions

Read this before your first `gh issue` or `gh pr` write in a session. A write is create, comment, close, edit or label.

These two rules were missed in a live session on 2026-08-02:

- **Close as wontfix:** apply the `wontfix` label with `gh issue edit <n> --add-label wontfix`. A "wontfix" note in the close comment is not enough.
- **Close a `wayfinder:task` issue:** append a context pointer to the Decisions-so-far section of its parent map issue. Closing the task alone is not enough.

See [issue-tracker.md](issue-tracker.md) for the `gh` commands and [triage-labels.md](triage-labels.md) for the label map.

The `PreToolUse` hook in `.claude/settings.json` tells the agent to read this file. The hook holds no copy of these rules.
