---
title: Feature implementation draft
aliases:
  - Feature implementation note
tags:
  - template
  - implementation
---

# [Feature or sprint title]

<!-- Use one note for a coherent feature or a set of tightly related features. -->

**Scope:** [feature / sprint / fix / refactor / tooling]
**Issues/spec:** [issue numbers, PRD, design decision, or other source]
**Date:** [YYYY-MM-DD]
**Branch/PR:** [branch and/or PR, if relevant]

## Scope

**In scope:**

- [ ] [Feature, behavior, or issue included]
- [ ] [Feature, behavior, or issue included]

**Out of scope / not addressed:**

- [Explicit exclusion, deferred work, or adjacent issue]

## Intent

**Purpose:** [Why this work is being done and what user or system outcome it enables.]

## Design decisions and reasoning

### [Decision or design question]

- **Decision:** [What was chosen]
- **Reason:** [Why this choice fits the product/domain]
- **Affected journey/state:** [Relevant user journey or machine state]
- **Related decision:** [[design-decisions/...]]

<!-- Repeat for each meaningful decision. Include a correction or pivot below if one occurred. -->

## What shipped

- [Component, screen, state, API, or tooling change]
- [User-visible behavior and relevant domain terms]
- [Files or modules changed, when useful]

## Tests

**Model or flow covered:** [The real user journey/stateful flow, if applicable]

| Test file      | What it verifies                                    |
| -------------- | --------------------------------------------------- |
| `path/to/test` | [Behavior, state transition, or regression covered] |

**Not tested:**

- [Missing coverage, deliberately omitted test, or reason no new test was needed]

## Verification status

**Run and passing:**

- [ ] Type checking: `[command]`
- [ ] Unit/model tests: `[command]`
- [ ] Lint: `[command]`
- [ ] Formatting: `[command]`
- [ ] Build or other gate: `[command]`

**Unverified:**

- [Device/emulator/manual pass, platform-specific behavior, or other gate not run]

## Graveyard: pivots and corrections

<!-- Record abandoned approaches and corrected assumptions for future implementers. -->

### [Correction, pivot, or scope check]

- **Finding:** [What was discovered]
- **Impact:** [How it changed the implementation or scope]
- **Resolution:** [What was done, or why it was left unresolved]

## Follow-ups and known limitations

- [ ] [Deferred fix, extension, or issue to track]
- [Known limitation or pre-existing behavior intentionally unchanged]

## Implementation updates

<!-- Append dated entries when modifying this feature after the initial implementation. -->

### YYYY-MM-DD — [fix|refactor|regression|extension]

**Purpose:** [Why this change was needed.]  
**Change:** [What changed, briefly.]
