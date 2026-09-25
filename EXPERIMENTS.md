# Experiments

Started 2026-09-25 by the `improve-app` journey. Tracking issue
matthewdmanning/feral-spotter#371.

**Standing constraint:** the app has no real users yet, so no row below can be validated by live data
today. Each row carries a pre-committed metric to be read once the beta cohort exists (Task #7 in
`PROJECT_STATUS.md`). Until then a shipped fix is verified by a device test drive, not by a metric.

## Experiment Cards

### EXP-001 — Make the submit moment answer "did it work?"

- Hypothesis: We believe first-time submitters will make a second Submission if the app confirms the
  first one landed and says where it went, because today success and silent failure look identical.
- Type: A-B once a cohort exists; device test drive until then
- Primary metric and threshold (pre-committed): share of users who make a second Submission within 14
  days of their first, measured in PostHog off `SUBMISSION_SUBMITTED`. Threshold: beats the pre-fix
  baseline. The baseline does not exist yet and must be captured before the fix ships to the cohort.
- Guardrail metric: no drop in submissions completed per session
- Decision rule: if the second-Submission rate does not move, the emotional gap named in CUSTOMER.md is
  wrong and Phase 1b must run before any more work is aimed at it
- Result and verdict: not started
- Covers: U1, U2

## Experiment Backlog

Ordered by severity × frequency, per the Phase 2 decision. Ease does not enter the ordering; the ICE
column is recorded but does not reorder the list.

| # | Idea | Finding | ICE (impact/confidence/ease) | Status |
|---|---|---|---|---|
| 1 | Render the submit state — disable the button, change the label, show progress. The flag already exists and is unused | U1 | 9 / 9 / 9 | fix now |
| 2 | Confirm the Submission landed and say what happens to it next | U2 | 9 / 7 / 7 | fix now |
| 3 | Give the first annotate entry an instruction that does not wait on the gated tutorial | U3 | 9 / 8 / 6 | fix now |
| 4 | State the reason beside every disabled control (4 sites) | U4 | 7 / 9 / 8 | fix now |
| 5 | Give the annotate pass an explicit forward control | U5 | 8 / 8 / 7 | fix now |
| 6 | Rewrite the submit failure message to what/why/how, and say the draft is safe | U11 | 7 / 9 / 9 | fix now |
| 7 | Render a human label on cat rows, with a distinct one for an all-unknown cat | U13 | 6 / 9 / 9 | fix now |
| 8 | Answer the Android back press in annotate instead of swallowing it | U6 | 7 / 8 / 6 | backlog |
| 9 | Split "Done With This Cat" into one label per outcome | U7 | 7 / 8 / 7 | backlog |
| 10 | Give a draft a non-destructive way out that keeps the work | U8 | 8 / 7 / 5 | backlog |
| 11 | Surface the location fix state on the camera screen | U14 | 7 / 7 / 6 | backlog |
| 12 | Say a draft went stale instead of silently hiding Continue | U12 | 6 / 8 / 7 | backlog |
| 13 | Explain "Ear Tipped" in place | U9 | 7 / 7 / 8 | Phase 6 |
| 14 | Replace Cat Form's "Clear" confirmation with undo | U10 | 6 / 7 / 6 | Phase 3 |
| 15 | Make the annotate trash act, with undo, instead of teaching a gesture by dialog | U19 | 5 / 8 / 7 | Phase 3 |
| 16 | Separate the attributes the dataset needs from the nice-to-have ones | U22 | 8 / 5 / 4 | Phase 3 |
| 17 | Settle one user-facing word for a Submission and apply it to all four surfaces | U15, U16, U17, U21 | 6 / 6 / 7 | Phase 6 — human decision |
| 18 | Give Home and Submission one primary action each | U18 | 6 / 7 / 6 | Phase 4 |
| 19 | Label annotate's dot states | U20 | 4 / 8 / 8 | backlog |
| 20 | Add a visible cancel to Cat Form | U23 | 5 / 8 / 8 | backlog |
| 21 | Show "Open Settings" only after a permission denial | U24 | 3 / 8 / 9 | backlog |
| 22 | Use one label shape in the status row | U25 | 2 / 8 / 9 | backlog |
