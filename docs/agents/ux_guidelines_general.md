# UX Guidelines — General Design Rules

## Editing rules

This document holds generally applicable UX principles. It must never contain:

- Source code file references (file names, paths, function/hook/component names)
- References to specific libraries or APIs
- Project-specific flows (domain terms, feature names, issue numbers)

Keep entries concise — concise is usually better — but include enough context that the rule is actionable on its own, without needing the situational file to make sense.

Rules that only make sense for a specific interaction or component belong in [ux_decisions.md](ux_decisions.md) instead.

This is a living document. Extend it, don't replace it.

## Discoverability

Don't let a significant action hide behind a small, skippable control. Default into it, with a lightweight way to undo/back out — not as a separate opt-in the user must remember to visit.

## Tunable parameters

"Judgement call" values — timings, counts, thresholds — belong in a config file as named constants, not hardcoded inline and not exposed as a user-facing setting. Example: how long an undo affordance stays visible, or how many items show in a list at once.

## Confirmations & destructive actions

Irreversible actions need a confirm dialog: cancel option first, destructive option visually distinct. For a low-risk action whose confirmation would otherwise repeat needlessly, allow a persistent "don't ask again" opt-out — the default is always to confirm.

## Component types

Shared UI building blocks live in a common, reusable layer, separate from feature-specific screens. Record a new reusable pattern here (or in [ux_decisions.md](ux_decisions.md) if it's situational) when it's introduced, so this is the first place to check before inventing another one.
