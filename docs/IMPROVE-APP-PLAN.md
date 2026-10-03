# Improve App Plan

## Context

- Started: 2026-09-25
- Tracking issue: matthewdmanning/feral-spotter#371 (child of wayfinder map #31)
- Journey docs branch: `issue-371-improve-app-journey` in the docs submodule; the parent checkout is independent
- App: FeralSpotter — React Native / Expo (SDK 56) mobile app, Android and iOS. Users capture a photo of a
  feral cat, annotate it, and send a Sighting (stored as a Submission) with one location. Status: alpha.
- Job (intake, user's words): two jobs together, both altruistic — log a sighting fast before the animal
  moves, and have that sighting feed a real research dataset. Users do **not** hire the app to track their
  own sightings for their own purposes. Phase 1 confirms the wording.
- Roughest today: confusing flows, amateur visuals, weak or jargon copy.
- Evidence available: the user's own test drives only. No real-user analytics, tickets, or reviews.
- Leakiest moment: unmeasured. Phase 2 found first-Submission completion and submit-feedback defects in source, without user behavior to rank them.
- Upsell surfaces: none. The app is free and does not sell.
- Platform note: no browser surface. No iOS test capability, but the app must be iOS-ready.
- Docs note: `docs/` is a normal folder in this repo. Commit doc changes with the code they describe.

## Phase Status

| Phase | Skill                           | Status                                                                        | Artifact                                   | Date       |
| ----- | ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| 1     | jobs-to-be-done                 | done                                                                          | CUSTOMER.md                                | 2026-09-25 |
| 1b    | continuous-discovery (optional) | deferred: no beta cohort exists yet; revisit once Task #7 ships               | CUSTOMER.md                                | 2026-09-25 |
| 2     | ux-heuristics                   | done                                                                          | DESIGN.md, EXPERIMENTS.md                  | 2026-09-25 |
| 3     | design-everyday-things          | done                                                                          | DESIGN.md, EXPERIMENTS.md                  | 2026-09-25 |
| 3b    | improve-retention (optional)    | deferred: no beta cohort; user chose to defer this pass entirely              | PRODUCT.md                                 | 2026-09-25 |
| 4     | refactoring-ui                  | done                                                                          | DESIGN.md, EXPERIMENTS.md, POSITIONING.md  | 2026-09-25 |
| 4b    | ios-hig-design (optional)       | awaiting-evidence: source check recorded; no iOS build or device              | DESIGN.md                                  | 2026-09-25 |
| 5     | microinteractions               | done                                                                          | DESIGN.md, EXPERIMENTS.md                  | 2026-09-25 |
| 6     | made-to-stick                   | done                                                                          | POSITIONING.md, EXPERIMENTS.md, PRODUCT.md | 2026-09-26 |
| 7     | influence-psychology            | skipped: no upsell or sales surface in the app                                | POSITIONING.md, EXPERIMENTS.md             | 2026-09-25 |
| 8     | high-perf-browser               | skipped: native app, no browser surface                                       | DESIGN.md, EXPERIMENTS.md                  | 2026-09-25 |
| 9     | steve-jobs-design-review        | awaiting-evidence: source pre-review done; cold flow and cut decision pending | PRODUCT.md, DESIGN.md, EXPERIMENTS.md      | 2026-09-25 |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: <reason> · skipped: <reason>

## Key Decisions

| Date       | Phase  | Decision                                                                                    | Rationale                                                                                                                                                                                                                                                                                   |
| ---------- | ------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | Intake | Skip Phase 7                                                                                | The app has no paywall, upgrade prompt, or badge. Nothing to persuade at.                                                                                                                                                                                                                   |
| 2026-09-25 | Intake | Skip Phase 8                                                                                | Native app only. Browser field metrics (INP, LCP, CLS) do not apply.                                                                                                                                                                                                                        |
| 2026-09-25 | Intake | Add ios-hig-design after Phase 4                                                            | No iOS test device, but the app must be iOS-ready. Run it as a convention audit, not a device test.                                                                                                                                                                                         |
| 2026-09-25 | Intake | Add continuous-discovery after Phase 1                                                      | The only evidence is the user's own test drives. Findings would otherwise rest on opinion.                                                                                                                                                                                                  |
| 2026-09-25 | Intake | Add improve-retention after Phase 3                                                         | Insert it once the audits show first-run activation friction.                                                                                                                                                                                                                               |
| 2026-09-25 | 1      | Widen the job circumstance to cover both the deliberate seeker and the incidental encounter | Colony caretakers and TNR volunteers go out looking. The incidental encounter has no time budget and is the harder case the flow must survive.                                                                                                                                              |
| 2026-09-25 | 1      | Name the emotional dimension the worst gap, marked awaiting-evidence                        | Submit ends the story, so nothing tells the user the Submission mattered. Maintainer judgment, not user evidence — Phase 1b or a beta cohort must confirm it.                                                                                                                               |
| 2026-09-25 | 1      | Leave the Big Hire / Little Hire split unresolved                                           | No usage data exists. Source findings can prioritize usability fixes but cannot establish repeat-use behavior.                                                                                                                                                                              |
| 2026-09-25 | 1b     | Defer continuous-discovery                                                                  | No beta cohort exists to talk to. Task #7 (Play beta) is 60 days past due and blocked. Revisit once a cohort exists.                                                                                                                                                                        |
| 2026-09-25 | 2      | Fix the three severity-4 findings plus the cheap severity-3s now                            | U1, U2, U3, U4, U5, U11, U13. Everything else goes to the backlog.                                                                                                                                                                                                                          |
| 2026-09-25 | 2      | Order the backlog by severity × frequency, not ICE                                          | Catastrophes must outrank cosmetics, and ease must not let a small fix jump a frequent one.                                                                                                                                                                                                 |
| 2026-09-25 | 2      | Defer the vocabulary decision to Phase 6                                                    | Four user-facing words name one concept. The maintainer chose “Sighting” after the Phase 6 inventory; “Submission” remains the data-model term.                                                                                                                                             |
| 2026-09-25 | 3      | Do not file an issue per error-design finding                                               | N1, N2, N4, N5 and the three undo builds are atomic edits. Issues are for work that carries a decision, needs device verification, or spans more than one module. The EXPERIMENTS.md rows track them.                                                                                       |
| 2026-09-25 | 3      | Undo replaces the confirmation for clearing the Cat Form                                    | Nothing records that dialog as deliberate, and the attributes are ordinary component state, so restoring them is cheap.                                                                                                                                                                     |
| 2026-09-25 | 3      | Removing a cat keeps its confirmation and gains an Undo as well                             | The confirmation was a deliberate earlier choice and its message already says what survives, so Undo is added on top rather than replacing it.                                                                                                                                              |
| 2026-09-25 | 3      | Resetting the whole Submission keeps its confirmation                                       | It is rare, large, and spans four stores and a cache row. A deliberate pause is honest here.                                                                                                                                                                                                |
| 2026-09-25 | 3      | A signifier in the Cat Form replaces the save-time missing-field dialog                     | Showing each attribute standing value removes the surprise instead of reporting it after the fact.                                                                                                                                                                                          |
| 2026-09-25 | 2      | Prioritize visible submit and annotation defects without a retention ranking                | U1/U2 show a silent submit state; U3 shows a first-pass guidance gap. The code audit does not measure later use.                                                                                                                                                                            |
| 2026-09-25 | 3b     | Defer retention entirely                                                                    | No beta cohort can test repeat use; the maintainer chose not to make a source-based retention diagnosis. EXP-001 measures immediate understanding of the submit result only.                                                                                                                |
| 2026-09-25 | 4      | Take Photos leads on Home                                                                   | The current Pixel 7 capture shows equal visual weight; the maintainer selected the camera action as the primary. Keep the existing theme tokens.                                                                                                                                            |
| 2026-09-25 | 6      | Use “Sighting” in user-facing copy                                                          | The maintainer chose this term after reviewing the current Home, Submission, and Feral Reports labels. Keep “Submission” for the existing data model.                                                                                                                                       |
| 2026-09-26 | 6      | Name no sign-in provider in Onboarding                                                      | The maintainer chose generic wording over listing providers by release. Copy that names none cannot promise a choice the release does not have, and it needs no edit when the provider list changes.                                                                                        |
| 2026-09-25 | 5      | Run the microinteractions pass without maintainer input, on source evidence only            | The maintainer had no capacity for a decision round and asked for the pass plus a report. Every score below is a source score; the device check stays an open action.                                                                                                                       |
| 2026-09-25 | 5      | Fix the shared button press state before any individual interaction                         | One change in `AppButton` answers touch on every button in the app. Polishing one screen's feedback while every button stays inert would read as an accident.                                                                                                                               |
| 2026-09-25 | 5      | Keep the camera shutter as the app's only existing signature moment                         | It passes the removal test already. A second competing moment would dilute it.                                                                                                                                                                                                              |
| 2026-09-25 | 5      | Make the submit receipt the one new moment worth extra craft                                | It closes the story the shutter opens and is the only moment that can address the Phase 1 emotional gap. It must state only the verified upload outcome and must not block the next action.                                                                                                 |
| 2026-09-25 | 4      | Introduce no new tokens                                                                     | All nine findings are misuses of existing variants and scales. Three off-scale values get corrected to the existing scale instead.                                                                                                                                                          |
| 2026-09-25 | 4      | Reset moves to the Submission header row                                                    | The maintainer chose the header over keeping it with the cat list. It puts the largest destructive action as far from `Finished!` as the screen allows, and it stays visible rather than hiding in a menu.                                                                                  |
| 2026-09-25 | 4      | `Finished!` is last, filled, and at `typography.base`                                       | The maintainer's constraint. The primary action was previously 14 px while a cat row was 16 px.                                                                                                                                                                                             |
| 2026-09-25 | 4      | Add a Cat keeps its dashed no-fill treatment                                                | The maintainer asked for the original prototype look. It also keeps the cat-list group visually distinct from the action block below the gap.                                                                                                                                               |
| 2026-09-25 | 4      | One label, “Add More Photos”, for both photo sources                                        | The maintainer's decision. A draft has one source by construction (ADR 0002), so two labels describe one action. Recorded in POSITIONING.md as well, so Phase 6 does not re-open it.                                                                                                        |
| 2026-09-25 | 4      | Report Phase 4's 10/10 as a projection, not a result                                        | The only rendered evidence is one Pixel 7 Home capture. The Submission render is still outstanding.                                                                                                                                                                                         |
| 2026-09-26 | 6      | Reject "Friendly to People" as the `owned_domesticated` label; the wording stays undecided  | A dumped pet is domesticated and can still be too scared to approach, so friendliness and origin are different questions. One stored yes/no/unsure value can carry only one of them. The label waits on the maintainer; the persisted key and values do not change either way.              |
| 2026-09-26 | 6      | Propose no appearance-based label for this field                                            | The maintainer rejected that whole family: many feral cats are better groomed and fed than abandoned house cats, and most cats of either kind wear no collar. Grooming, body condition, and collars do not separate origin, so no label may ask the observer to read origin off the animal. |
| 2026-09-26 | 6      | Explain ear tipping with a drawing, not a sentence                                          | The maintainer has a drawing of a clipped ear tip planned. A picture of the ear answers the question faster than TNR wording and needs no translation.                                                                                                                                      |

## Next Actions

- [x] Run Phase 1 (jobs-to-be-done). Job stated without the product name, three dimensions carry an
      underdelivery note, alternatives logged including non-consumption. Phases 2-9 unlocked. (2026-09-25)
- [x] Phase 1b deferred — no beta cohort exists to talk to (2026-09-25)
- [x] Keep the Big Hire / Little Hire comparison unresolved. Phase 2 recorded the source-visible
      completion and feedback defects without a retention conclusion. (2026-09-25)
- [x] Run Phase 2 (ux-heuristics). 25 findings, every one severity-rated, Trunk Test run on six screens,
      backlog ordered by severity × frequency. Interface scores 4/10. (2026-09-25)
- [x] Filed a child issue for each of the seven fix-now findings, all linked as sub-issues of #371
      (2026-09-25): U1 #372, U2 #373, U3 #374, U4 #375, U5 #376, U11 #377, U13 #378. Four are
      `ready-for-agent`; #373, #374 and #376 are `ready-for-human` because each carries a product or
      flow decision, not just an implementation.
- [x] Filed scoped follow-up issues for the later phase decisions: Home hierarchy #379, user-facing
      “Sighting” copy #380, and Onboarding claims #381. Each references #371; GitHub sub-issue
      linkage for these three remains pending because the connector has no sub-issue write action and
      the local `gh` CLI is not authenticated. (2026-09-25)
- [x] Ran the error-design pass (design-everyday-things). Ten findings against the two gulfs, every
      destructive action decided one by one, and every error message checked against what/how/no-blame/
      work-preserved. (2026-09-25)
- [x] No issues filed for the error-design findings. N1, N2, N4, N5 and the three undo builds are
      atomic backlog edits tracked as rows 23-29 in EXPERIMENTS.md. Before one ships, attach it to
      a relevant child issue rather than creating an issue per row. (2026-09-25)
- [x] Defer Phase 3b entirely until a beta cohort can supply retention evidence (2026-09-25)
- [ ] Capture EXP-001's submit-result comprehension baseline with beta participants before its fix
      reaches them (owner: user; deferred until a cohort exists)
- [x] Carry the "Feral Reports" naming finding into Phase 6. The maintainer chose “Sighting” for
      user-facing copy; “Submission” remains the data-model term. (2026-09-25)
- [ ] Decide in Phase 9 whether the personal Sighting list earns a place in the MVP; users do not
      hire the app to track sightings for themselves. The source review recommends keeping its
      persistent status view while #373 is unshipped (owner: user).
- [x] Ran Phase 4 (refactoring-ui). Nine findings, both screens 5/10, no new tokens, every decision
      recorded, backlog rows 36-41 added. The 10/10 projection is unconfirmed. (2026-09-25)
- [ ] Check Submission's action grouping and grayscale hierarchy on a current device with safe test
      data; do not submit fabricated data to the live backend (owner: agent).
- [ ] Complete the iOS safe-area, large-text, dark-mode, and VoiceOver checks when an iOS build/device
      is available (owner: agent).
- [ ] Run direct-touch checks for the camera, Box Annotation, Submit, and Undo flows after their child
      fixes can be exercised with safe test data (owner: agent).
- [x] Ran Phase 5 (microinteractions) on source with no maintainer input. Seven interactions scored
      against the eight-row diagnostic, four new findings (M1-M4) recorded, backlog rows 31-35 added,
      signature moment settled. (2026-09-25)
- [ ] Resolve the single `owned_domesticated` field's intended meaning before choosing its user-facing
      question; source only shows one yes/no/unsure value (owner: user).
- [ ] Resolve #376 against the active crop-frame design decision before any forward-navigation change
      (owner: user).
- [ ] Choose the question the `owned_domesticated` field asks, then its label. Two families are
      already ruled out: behavior ("Friendly to People" — a dumped pet can be domesticated and too
      scared to approach) and appearance ("Looks Like a Pet" — grooming, body condition, and collars
      do not separate feral from abandoned). The code carries no definition: one label, three values,
      no help text (`src/screens/submission/cats/attributes.ts:70`). The stored key and values do not
      change whichever label wins (owner: user).
- [x] Settled the ear-tipping explanation as a planned drawing of a clipped ear tip beside the field,
      not a sentence of copy (owner: user). (2026-09-26)
- [x] Ran Phase 6 (made-to-stick). Eight surfaces scored, backlog rows 43-45 and 47 added.
      (2026-09-26)
