# Documentation policy

Authoritative rules for what to write down when implementing or modifying code. Agents follow this by default; a human may override per-request.

## Commit documentation with its code

Any documentation change that describes a specific code change (implementation notes, updated ADRs, doc comments, etc.) goes in the **same commit** as that code change — never a separate, later, or unrelated commit/PR. If the docs and the code end up on different branches for unrelated reasons, that's a signal the work itself wasn't actually related; split it explicitly rather than letting docs drift from what they describe.

## New feature or sprint → new implementation note

When implementing a new feature or sprint, write a separate implementation note in `docs/implementations/`, named `YYYY-MM-DD-short-description.md`.

Include:

- What shipped, mapped to the issues/spec it covers.
- Any tests written for the code — file, and what each one verifies.
- Anything caught and fixed along the way that wasn't in the original spec.
- Verification status: what was actually run (tsc, tests, lint) vs. what's unverified (no emulator/device pass, etc.) — don't claim more than was checked.

## Modifying an existing feature → append to its existing note

Don't start a new file. Find the feature's existing implementation note and append a dated section:

```markdown
## YYYY-MM-DD — <type: fix|refactor|regression|extension>

**Purpose:** why this change.
**Change:** what changed, briefly.
```

Both fields are required on every modification entry, even a small one — a one-line fix still needs a one-line purpose.

## Modification touching two features

Write the change under each affected feature's own note, scoped to what that feature-specific change actually was — don't duplicate the full description in both. Each entry links to the other affected note(s) so a reader following either file can find the rest of the picture.
