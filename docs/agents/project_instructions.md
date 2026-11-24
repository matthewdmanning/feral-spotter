# Agent Instructions Index

This file holds routing and universal rules only. Role-specific rules live in the linked files.

## Routing rule

- Before you act, list every entry below that matches your task.
- Read each matching file in full before you act. Skip the rest.
- A task can match several entries. Do not stop at the first match.
- If a linked file has nothing for your task, tell the user. Say why you opened it.

## Entries

### UI/UX

- Design, build or review UI: read [ui-ux-standards.md](ui-ux-standards.md). It has placement, spacing, tokens, glass surfaces, copy and accessibility rules.
- Change or review UI code, or check a design decision: read [using-design-decisions.md](ui-ux/reference/using-design-decisions.md). It says where design files live and what to do when code differs.
- Check what a screen does now: read [ui-ux/current-state/](ui-ux/current-state/). There is one file per topic. Also see [ui-ux/decision-records/](ui-ux/decision-records/).
- Weigh a mobile tradeoff (touch targets, platform rules, accessibility, dark mode, spacing, overflow, text scaling, lists): read [ux_principles.md](ui-ux/reference/ux_principles.md) and [mobile-ux-layout-best-practices.md](ui-ux/reference/mobile-ux-layout-best-practices.md).
- Find theme tokens: raw color values live only in `src/shared/config/themes.ts`. `src/shared/config/unistyles.ts` wires them to the engine. Component `*.styles.ts` files use tokens, never hex.

### Code and tests

- Write or review any code or docs: read [domain.md](domain.md). Use its terms. Do not use synonyms.
- Write or review tests: read [testing.md](testing.md).
- Format, lint or name code: read [CODE_QUALITY.md](../code_standards/CODE_QUALITY.md) and [COMBINED_STYLE_GUIDE.md](../code_standards/COMBINED_STYLE_GUIDE.md).
- Audit code against style rules: read [code-audit-grep-plan.md](../code_standards/code-audit-grep-plan.md) and [code-audit-manual-rules.md](../code_standards/code-audit-manual-rules.md).
- Place a file or choose an import direction: read [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md).
- Write or change native code (Kotlin, Swift, Gradle, Xcode, `modules/`): read [native-code.md](native-code.md) first. It names the skill to load. `android/` and `ios/` are generated. Never edit them.
- Implement a feature or sprint, or write, modify or review code: read [documentation.md](documentation.md). It says when and where to write an implementation note.
- Learn why a ratified architecture, data or logic decision was made: read [adr/](../adr/). One file per decision.

### Backend, secrets and builds

- Use Firebase, a backend, auth or uploads: read [backend.md](backend.md). It also lists the approved Firebase MCP resources.
- Handle keys, tokens, `.env*`, `google-services.json` or `GoogleService-Info.plist`, or judge a possible leak: read [secrets.md](secrets.md).
- Build the app, change build settings or GitHub environment variables: read [builds.md](builds.md).

### Devices and QA

- Drive or debug the app on a device or emulator: read [test-driving.md](test-driving.md).
- Run manual QA: read [routing-notes.md](routing-notes.md). It points to the QA checklist.

### Git, GitHub and planning

- Write to `gh issue` or `gh pr` (create, comment, close, edit, label), at your first write this session: read [issue-tracker.md](issue-tracker.md), [triage-labels.md](triage-labels.md) and [gh-conventions.md](gh-conventions.md).
- Use raw git or GitHub mechanics (squash merges, CI triggers, `gh pr checks`): read [git.md](git.md).
- Scope work against MVP, Alpha or Beta: read [the milestone roadmap](../planning/grilling/2026-07-12-mvp-alpha-beta-roadmap.md).
- Someone points you to a handoff or note: open only that file in [planning/](../planning/). Do not browse the folder. `planning/grilling/` holds specs. `planning/prototypes/` holds prototype records.
- Format console commands in a reply: read [output-conventions.md](output-conventions.md).
- Pick a template: read [routing-notes.md](routing-notes.md).

## Universal rules

- File name format: `YYYY-MM-DD-{activity_name}`. The activity name is the active sprint, or the branch if it is not `main`. If you do not know it, ask the user.
- Exempt from the date prefix: `docs/adr/`, `docs/planning/`, `docs/agents/ui-ux/current-state/` and `docs/agents/ui-ux/decision-records/`. Each file records its own last-updated date.
- For branch, commit and PR hygiene, use the global git-workflow rules. For git mechanics, use [git.md](git.md).
