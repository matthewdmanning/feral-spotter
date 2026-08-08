# Using design-decisions/

Rules for any agent changing or reviewing code, on how to weigh `docs/design-decisions/` against other sources.

## Priority order

1. **What you were explicitly handed this session** — the user's prompts, and any file the user pointed you at directly (e.g. a test-drive run-note). Always wins.
2. **`docs/design-decisions/`** — authoritative over every other doc in the repo.
3. Everything else.

A design-decisions file does not override a live user report or a test-drive finding you were handed directly. If the two conflict, surface the tension and let the user decide — don't use the design-decision to silently dismiss, close, or reframe the report.

## Never edit without confirmation

Never change a `design-decisions/` file unless the user has explicitly confirmed the change first. These files are the current source of truth for UI/UX state for every future agent — an unconfirmed edit corrupts that record.

## What belongs in a design-decisions file

Only the **current state** of the design — what the UI/UX is supposed to look like and behave like right now.

- No change history, no dates, no "supersedes X" narrative, no decision log. That belongs in `docs/adr/` (durable rationale for a decision) or `docs/implementations/` (what was actually built, when).
- No issue tracking. A design-decisions file records the target state, not open bugs or TODOs against it.

## Codebase vs. design-decisions mismatches

The code may not yet match a design-decision — it may still need implementing. A mismatch is not proof the code (or a bug report about it) is wrong, and it's not proof the design-decision is wrong either. Treat it as an open question for a human, not something to resolve unilaterally.
