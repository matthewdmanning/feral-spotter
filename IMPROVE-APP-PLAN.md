# Improve App Plan

## Context

- Started: 2026-09-25
- Tracking issue: matthewdmanning/feral-spotter#371 (child of wayfinder map #31)
- Branches: `issue-371-improve-app-journey` in both the parent repo and the docs submodule
- App: FeralSpotter — React Native / Expo (SDK 56) mobile app, Android and iOS. Users capture a photo of a
  feral animal, annotate it, and submit a georeferenced observation. Status: alpha.
- Job (intake, user's words): two jobs together, both altruistic — log a sighting fast before the animal
  moves, and have that sighting feed a real research dataset. Users do **not** hire the app to track their
  own sightings for their own purposes. Phase 1 confirms the wording.
- Roughest today: confusing flows, amateur visuals, weak or jargon copy.
- Evidence available: the user's own test drives only. No real-user analytics, tickets, or reviews.
- Leakiest flow: not yet known. Phase 2 identifies it.
- Upsell surfaces: none. The app is free and does not sell.
- Platform note: no browser surface. No iOS test capability, but the app must be iOS-ready.
- Docs note: `docs/` is a git submodule (`feral-spotter-docs`). Commit doc changes in the submodule first,
  then bump the pointer in the parent repository.

## Phase Status

| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 1 | jobs-to-be-done | done | CUSTOMER.md | 2026-09-25 |
| 1b | continuous-discovery (optional) | pending | CUSTOMER.md | |
| 2 | ux-heuristics | pending | DESIGN.md, EXPERIMENTS.md | |
| 3 | design-everyday-things | pending | DESIGN.md, EXPERIMENTS.md | |
| 3b | improve-retention (optional) | pending | PRODUCT.md | |
| 4 | refactoring-ui | pending | DESIGN.md, EXPERIMENTS.md | |
| 4b | ios-hig-design (optional) | pending | DESIGN.md | |
| 5 | microinteractions | pending | DESIGN.md, EXPERIMENTS.md | |
| 6 | made-to-stick | pending | POSITIONING.md, EXPERIMENTS.md | |
| 7 | influence-psychology | skipped: no upsell or sales surface in the app | POSITIONING.md, EXPERIMENTS.md | 2026-09-25 |
| 8 | high-perf-browser | skipped: native app, no browser surface | DESIGN.md, EXPERIMENTS.md | 2026-09-25 |
| 9 | steve-jobs-design-review | pending | PRODUCT.md, DESIGN.md, EXPERIMENTS.md | |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: <reason> · skipped: <reason>

## Key Decisions

| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-09-25 | Intake | Skip Phase 7 | The app has no paywall, upgrade prompt, or badge. Nothing to persuade at. |
| 2026-09-25 | Intake | Skip Phase 8 | Native app only. Browser field metrics (INP, LCP, CLS) do not apply. |
| 2026-09-25 | Intake | Add ios-hig-design after Phase 4 | No iOS test device, but the app must be iOS-ready. Run it as a convention audit, not a device test. |
| 2026-09-25 | Intake | Add continuous-discovery after Phase 1 | The only evidence is the user's own test drives. Findings would otherwise rest on opinion. |
| 2026-09-25 | Intake | Add improve-retention after Phase 3 | Insert it once the audits show first-run activation friction. |
| 2026-09-25 | 1 | Widen the job circumstance to cover both the deliberate seeker and the incidental encounter | Colony caretakers and TNR volunteers go out looking. The incidental encounter has no time budget and is the harder case the flow must survive. |
| 2026-09-25 | 1 | Name the emotional dimension the worst gap, marked awaiting-evidence | Submit ends the story, so nothing tells the user the Submission mattered. Maintainer judgment, not user evidence — Phase 1b or a beta cohort must confirm it. |
| 2026-09-25 | 1 | Leave the Big Hire / Little Hire split unresolved | No usage data exists. Guessing would aim every later fix at possibly the wrong moment. Phase 2 and Phase 1b decide it. |

## Next Actions

- [x] Run Phase 1 (jobs-to-be-done). Job stated without the product name, three dimensions carry an
      underdelivery note, alternatives logged including non-consumption. Phases 2-9 unlocked. (2026-09-25)
- [ ] Decide whether Phase 1b (continuous-discovery) runs now or is deferred until a beta cohort exists
      (owner: user)
- [ ] Resolve the Big Hire / Little Hire split during Phase 2 — fixes aimed at the wrong moment waste the
      effort (owner: agent)
- [ ] Carry two Phase 1 observations into their own phases, not into code yet (owner: agent):
  - "Feral Reports" presents a personal list, but users do not hire the app to track sightings for
    themselves — a Phase 9 cut candidate.
  - "Feral Reports" uses the word "report", which `agents/domain.md` says to avoid in favour of
    "Submission" — a Phase 6 copy finding.
