# Consent/permission-gate test-drive cluster — common context (2026-08-09)

Handoffs for tickets that came out of a live Pixel 7 test-drive session and
are **not yet fixed**. One file per ticket in this folder; this file is
shared context, not duplicated in each.

## Required reading before touching any ticket in this cluster

- [project_instructions.md](../../agents/project_instructions.md)
- [ux_principles.md](../../references/ux_principles.md) — mobile UI/UX baseline (touch targets, platform conventions, accessibility)
- [testing.md](../../agents/testing.md) — this repo writes model-based/stateful-flow tests only, not per-case `it()` bloat; several tickets here are gate/permission state machines, a natural fit for the `xstate` model pattern already used in `HomeScreen.gate.model.test.tsx`
- [domain.md](../../agents/domain.md) — shared vocabulary; use these terms, don't drift to synonyms
- [documentation.md](../../agents/documentation.md) — doc-with-code rules; most tickets here modify existing features, so append a dated section to that feature's existing implementation note rather than starting a new one

## Session evidence

Full raw findings, methodology, and extraction techniques (not duplicated here):
[docs/test-drives/run-notes/2026-08-09-issue64-cluster-drive.md](../../test-drives/run-notes/2026-08-09-issue64-cluster-drive.md)

## Environment facts

Moved to [test-driving.md](../../agents/test-driving.md)'s "Device/environment notes" section — durable, reusable across sessions, not cluster-specific.

## Tickets in this cluster

| #                                                    | Title                                         | Status                        |
| ---------------------------------------------------- | --------------------------------------------- | ----------------------------- |
| [98](98-intro-flow-hardware-back.md)                 | Intro-flow T1 hardware back                   | Decided, needs implementation |
| [66](66-location-permission-gate.md)                 | Location permission gate (Don't-allow bypass) | Decided, needs implementation |
| [225](225-only-this-time-warning.md)                 | "Only this time" convenience warning          | Spec'd, needs implementation  |
| [157](not-ready/157-resume-submission-prominence.md) | Resume Submission button prominence           | Needs UX decision             |
| [197](not-ready/197-analytics-consent-race.md)       | Analytics capture-drop race                   | Blocked on config             |
| [201](201-device-monitoring-tooling.md)              | Physical-device monitoring tooling            | Open, unimplemented           |
| [224](224-library-pick-manual-time-fallback.md)      | Library Pick Manual-time fallback             | Untested, needs fixture       |
| [76](not-ready/76-photo-timestamps-closure.md)       | Photo timestamps (parent)                     | Partially verified, hold open |
