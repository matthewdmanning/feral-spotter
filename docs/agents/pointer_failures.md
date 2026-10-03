# Pointer Failures

Log of instances where an agent selected the wrong source document/doc-instance when pointed at "a doc" by the user or another doc — wrong branch copy, stale note, guessed path, etc. Purpose: build a record of the failure pattern so future triage/pointer logic can be corrected.

Fields:

- **correct source** — the document instance that should have been used.
- **source selected** — description (not a raw path) of what the agent actually accessed instead.
- **original pointer prompt** — the user/doc text that pointed the agent at the source.
- **reason given by agent** — the agent's own verbatim explanation for choosing that source, once asked for a plain language reason.
- **time** — `YYYYMMDD-HHMM`, 24-hour `HH` (00–23).

| correct source | source selected | reason given by agent | original pointer prompt | time |
| -------------- | --------------- | --------------------- | ----------------------- | ---- |
| `docs/agents/project_instructions.md`'s "File Format" section (`YYYY-MM-DD-{activity_name}`, date first, activity_name = branch name) | Never opened `project_instructions.md` at all before naming the files. Used the `/handoff` skill's own instructions verbatim (save to OS temp dir) plus an inverted guess at the existing scratchpad naming pattern — produced `handoff-YYYY-MM-DD-{topic}.md` (prefix before date) instead of `YYYY-MM-DD-{branch-name}` | Treated the `/handoff` skill's self-contained instructions as sufficient on their own; didn't cross-check repo-specific conventions in `project_instructions.md` before writing, even though the task ("writing docs meant for other agents — handoffs") is explicitly one of the index's own matching rows | User: `/mattpocock-skills:handoff two files -- one for #249 and another for #253` | 20260811-1830 |
| `docs/test-drives/` (existing `logs/`, `run-notes/`, `screen-captures/` structure) | Initially saved the test-drive summary to `docs/scratchpad/2026-08-15-code-simplification-review-test-drive.md`, and before that only as ephemeral OS-temp scratchpad files + chat text, never as a committed doc at all | Reflexively used the generic session scratchpad directory per default tooling behavior, then defaulted to `docs/scratchpad/` off memory of a past "handoffs go in docs/scratchpad" correction, without checking whether a more specific folder (`docs/test-drives/`) already existed for this exact artifact type | User: "make a note ... that concisely notes where you saved the test drive summary" (surfaced the gap), then user: "Save all test drive files to a new subfolder in the appropriate folder @docs/test-drives" (named the correct destination). Final location: `docs/test-drives/2026-08-15-code-simplification-review-drive/` | 20260815-1430 |
