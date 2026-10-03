# Customer

Created 2026-09-25 by the `improve-app` journey, Phase 1 (jobs-to-be-done). Tracking issue
matthewdmanning/feral-spotter#371.

## Job Statement

When I encounter a feral cat — whether I went out looking for one or just walked past it — I want to
record what I saw and exactly where, before it moves on, so the people who can act on it get usable
evidence.

Two circumstances, one job:

- **The deliberate seeker** — colony caretaker, TNR volunteer, on a patrol. Has a time budget and expects
  to submit more than one sighting per outing.
- **The incidental encounter** — saw a cat on the way somewhere else. Has no time budget at all. This is
  the harder case, and the one the flow must survive.

Both are altruistic. Users do not hire this to keep a record for themselves.

## Job Dimensions

| Dimension | What the user wants | Where the app underdelivers | Evidence |
|---|---|---|---|
| Functional | Capture photos, location, and cat detail fast enough to beat the cat walking away, complete enough to be usable downstream | Camera → Box the Cat → Cat Form (8 attributes) → Submit. Speed and completeness fight each other, and completeness wins by default. Worst for the incidental encounter | Maintainer test drives |
| Emotional | Feel the effort mattered; relief instead of helplessness at seeing a cat nobody is helping | Submit ends the story. Nothing says the sighting reached anyone or did anything. **Named as the worst gap** | Maintainer hypothesis — awaiting-evidence |
| Social | Be seen as someone who helps, not a busybody photographing cats | No visible contribution record, no standing, nothing shareable. The one list screen frames Submissions as personal storage | Maintainer test drives |

## Competing Alternatives

| Alternative | Why hired | Weakness |
|---|---|---|
| Non-consumption — do nothing, walk on | Zero cost, zero time, no account | The sighting is lost. Largest competitor by far |
| Phone camera roll plus memory | Already in hand, one tap, no flow to learn | No location discipline, no cat detail, never reaches anyone |
| Text or call a local TNR or rescue group | A human responds, so the emotional gap closes immediately | Depends on already knowing the group; no structured data; does not scale |
| Facebook group post | Social credit is immediate and visible | No structured data; no research value |
| iNaturalist | Established, contributes to real science, has a community | Not feral-cat specific; produces no TNR or rescue outcome |
| Council animal-control hotline | Official, may produce action | Slow, often unwelcoming, no feedback to the reporter |

## Hire Moments

| Moment | Status | Note |
|---|---|---|
| Big Hire — install through first completed Submission | source-identified completion risk; unmeasured | Onboarding, Consent, and Registration precede the first Submission; first-time Box Annotation lacks guidance (U3) |
| Little Hire — reaching for the app on the next sighting | deferred | No repeat-use evidence or beta cohort exists; the maintainer deferred retention assessment entirely |

## Open Evidence Gaps

- The emotional dimension is named as the worst gap on maintainer judgment, not on user evidence. Phase 1b
  (continuous-discovery) or a real beta cohort must confirm or replace it.
- Phase 2 found completion and submit-feedback defects in source, but cannot rank Big Hire against Little Hire without user behavior. Retention assessment is outside this journey by maintainer decision.
