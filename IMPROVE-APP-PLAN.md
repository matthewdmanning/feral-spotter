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
| 1b | continuous-discovery (optional) | deferred: no beta cohort exists yet; revisit once Task #7 ships | CUSTOMER.md | 2026-09-25 |
| 2 | ux-heuristics | done | DESIGN.md, EXPERIMENTS.md | 2026-09-25 |
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
| 2026-09-25 | 1b | Defer continuous-discovery | No beta cohort exists to talk to. Task #7 (Play beta) is 60 days past due and blocked. Revisit once a cohort exists. |
| 2026-09-25 | 2 | Fix the three severity-4 findings plus the cheap severity-3s now | U1, U2, U3, U4, U5, U11, U13. Everything else goes to the backlog. |
| 2026-09-25 | 2 | Order the backlog by severity × frequency, not ICE | Catastrophes must outrank cosmetics, and ease must not let a small fix jump a frequent one. |
| 2026-09-25 | 2 | Defer the vocabulary decision to Phase 6 | Four user-facing words name one concept. Choosing the word is the maintainer's call, made with the full copy inventory in front of them. |
| 2026-09-25 | 2 | Little Hire is the primary leak | The severity-4 findings cluster at the submit moment (no reason to return) with a completion risk at annotate. Resolves the Phase 1 open question. |

## Next Actions

- [x] Run Phase 1 (jobs-to-be-done). Job stated without the product name, three dimensions carry an
      underdelivery note, alternatives logged including non-consumption. Phases 2-9 unlocked. (2026-09-25)
- [x] Phase 1b deferred — no beta cohort exists to talk to (2026-09-25)
- [x] Big Hire / Little Hire split resolved in Phase 2: Little Hire is the primary leak, with a Big Hire
      completion risk at annotate (2026-09-25)
- [x] Run Phase 2 (ux-heuristics). 25 findings, every one severity-rated, Trunk Test run on six screens,
      backlog ordered by severity × frequency. Interface scores 4/10. (2026-09-25)
- [ ] File a child issue for each of the seven fix-now findings — U1, U2, U3, U4, U5, U11, U13 — before
      any code changes (owner: user to approve, agent to file)
- [ ] Capture a second-Submission baseline in PostHog before EXP-001's fix reaches a cohort, or the
      experiment cannot be read (owner: user)
- [ ] Carry two Phase 1 observations into their own phases, not into code yet (owner: agent):
  - "Feral Reports" presents a personal list, but users do not hire the app to track sightings for
    themselves — a Phase 9 cut candidate.
  - "Feral Reports" uses the word "report", which `agents/domain.md` says to avoid in favour of
    "Submission" — a Phase 6 copy finding.
