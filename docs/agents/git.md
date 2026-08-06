# Git mechanics

Lessons about raw git/GitHub mechanics — not `gh` issue-tracker conventions (see [issue-tracker.md](issue-tracker.md) for those) and not commit/branch/PR _hygiene_ (see the global CLAUDE.md git-workflow rules for that).

## Learned the hard way

1. **GitHub squash-merge takes its subject from the PR title, not from any commit message on the branch.** Fixing a commit subject via force-push does not fix what lands on the base branch. Fix the PR title too, before merging.
2. **A commitlint workflow triggered on both `push:` and `pull_request:` lints different commit ranges.** The `push`-event run isn't scoped to the PR base and can re-lint already-merged ancestor commits from other branches, producing a failure unrelated to the current PR.
3. **When `gh pr checks` shows the same check name both passing and failing on one head SHA, they're different workflow runs from different trigger events.** Compare `gh run view <id> --json event` before treating either as authoritative.
