# Experiments

Started 2026-09-25 by the `improve-app` journey. Tracking issue
matthewdmanning/feral-spotter#371.

**Standing constraint:** the app has no real users yet, so no row below can be validated by live data
today. Each row carries a pre-committed metric to be read once the beta cohort exists (Task #7 in
`PROJECT_STATUS.md`). Until then a shipped fix is verified by a device test drive, not by a metric.

## Experiment Cards

### EXP-001 — Make the submit moment answer "did it work?"

- Hypothesis: First-time submitters will understand that their Sighting was sent if the app confirms
  the completed upload and names the destination, because today success returns silently to Home.
- Type: moderated task-comprehension check once a beta cohort exists; device test drive until then
- Primary metric and threshold (pre-committed): share of participants who can correctly say whether
  the Sighting was submitted and where it went, without a hint immediately after the task. Threshold:
  improvement over a pre-fix comprehension baseline, to be captured before this fix reaches beta users.
- Guardrail metric: no increase in failed or abandoned submit attempts during the task
- Decision rule: if users still cannot tell what happened, revise the receipt and test it again.
- Result and verdict: not started
- Covers: U1, U2

## Experiment Backlog

Ordered by severity × frequency, per the Phase 2 decision. Ease does not enter the ordering; the ICE
column is recorded but does not reorder the list.

| # | Idea | Finding | ICE (impact/confidence/ease) | Status |
|---|---|---|---|---|
| 1 | Render the submit state — disable the button, change the label, show progress. The flag already exists and is unused | U1 (#372) | 9 / 9 / 9 | issue filed |
| 2 | Confirm the Submission landed and say what happens to it next | U2 (#373) | 9 / 7 / 7 | issue filed |
| 3 | Give the first annotate entry an instruction that does not wait on the gated tutorial | U3 (#374) | 9 / 8 / 6 | issue filed |
| 4 | State the reason beside every disabled control (4 sites) | U4 (#375) | 7 / 9 / 8 | issue filed |
| 5 | Give the annotate pass an explicit forward control | U5 (#376) | 8 / 8 / 7 | issue filed |
| 6 | Rewrite the submit failure message to what/why/how, and say the draft is safe | U11 (#377) | 7 / 9 / 9 | issue filed |
| 7 | Render a human label on cat rows, with a distinct one for an all-unknown cat | U13 (#378) | 6 / 9 / 9 | issue filed |
| 8 | Answer the Android back press in annotate instead of swallowing it | U6 | 7 / 8 / 6 | backlog |
| 9 | Split "Done With This Cat" into one label per outcome | U7 | 7 / 8 / 7 | backlog |
| 10 | Give a draft a non-destructive way out that keeps the work | U8 | 8 / 7 / 5 | backlog |
| 11 | Surface the location fix state on the camera screen | U14 | 7 / 7 / 6 | backlog |
| 12 | Say a draft went stale instead of silently hiding Continue | U12 | 6 / 8 / 7 | backlog |
| 13 | Explain "Ear Tipped" in place | U9 | 7 / 7 / 8 | Phase 6 |
| 14 | Replace Cat Form's "Clear" confirmation with undo | U10 | 6 / 7 / 6 | Phase 3 |
| 15 | Make the annotate trash act, with undo, instead of teaching a gesture by dialog | U19 | 5 / 8 / 7 | Phase 3 |
| 16 | Separate the attributes the dataset needs from the nice-to-have ones | U22 | 8 / 5 / 4 | Phase 3 |
| 17 | Apply “Sighting” across Home, final action, and list; choose one ownership-field label separately | U15–U17 (#380), U21 | 6 / 6 / 7 | issue filed; field label pending |
| 18 | Make Take Photos the Home primary action; check whether Submission's full-width action stack needs clearer grouping | U18 (#379) | 6 / 7 / 6 | issue filed for Home; Submission check pending |
| 19 | Label annotate's dot states | U20 | 4 / 8 / 8 | backlog |
| 20 | Add a visible cancel to Cat Form | U23 | 5 / 8 / 8 | backlog |
| 21 | Show "Open Settings" only after a permission denial | U24 | 3 / 8 / 9 | backlog |
| 22 | Use one label shape in the status row | U25 | 2 / 8 / 9 | backlog |

### Added by the error-design pass (design-everyday-things), 2026-09-25

Ordered by severity × frequency, continuing the list above. Rows that only cross-reference a
usability-pass finding are not repeated here.

| # | Idea | Finding | ICE (impact/confidence/ease) | Status |
|---|---|---|---|---|
| 23 | Show each Cat Form attribute's standing value in the form, so the save-time "N fields not set" dialog is not needed | N1 | 8 / 7 / 5 | open |
| 24 | Show photo upload state where the photos are, not only when it stalls a submit | N4 | 7 / 8 / 5 | open |
| 25 | Give the two "Remove this cat?" dialogs one title each | N2 | 6 / 9 / 9 | open |
| 26 | Clear the Cat Form at once with an Undo, and drop the dialog that claims it cannot be undone | N3 | 6 / 8 / 8 | decided |
| 27 | Add an Undo after a cat is removed, keeping the confirmation in front of it | N3, N10 | 6 / 7 / 6 | decided |
| 28 | Make the annotate trash remove the photo, with an Undo, instead of opening a dialog that teaches a gesture | N10, U19 | 5 / 8 / 7 | decided |
| 29 | Make the good and the poor location states look different in kind, so a tick does not read as a dead control | N5 | 4 / 7 / 8 | open |

### Added by the in-app copy pass (made-to-stick), 2026-09-25

| # | Idea | Finding | Pre-committed check | Status |
|---|---|---|---|---|
| 30 | Correct Onboarding's setup and data-use claims; remove the unmeasured “About a minute” promise | U26 (#381) | In a first-run comprehension test, participants can name the next sign-in choice and what is sent, without being led | issue filed; claim verification pending |
