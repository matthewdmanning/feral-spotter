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

| #   | Idea                                                                                                                 | Finding             | ICE (impact/confidence/ease) | Status                                         |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------- | ---------------------------------------------- |
| 1   | Render the submit state — disable the button, change the label, show progress. The flag already exists and is unused | U1 (#372)           | 9 / 9 / 9                    | issue filed                                    |
| 2   | Confirm the Submission landed and say what happens to it next                                                        | U2 (#373)           | 9 / 7 / 7                    | issue filed                                    |
| 3   | Give the first annotate entry an instruction that does not wait on the gated tutorial                                | U3 (#374)           | 9 / 8 / 6                    | issue filed                                    |
| 4   | State the reason beside every disabled control (4 sites)                                                             | U4 (#375)           | 7 / 9 / 8                    | issue filed                                    |
| 5   | Give the annotate pass an explicit forward control                                                                   | U5 (#376)           | 8 / 8 / 7                    | issue filed                                    |
| 6   | Rewrite the submit failure message to what/why/how, and say the draft is safe                                        | U11 (#377)          | 7 / 9 / 9                    | issue filed                                    |
| 7   | Render a human label on cat rows, with a distinct one for an all-unknown cat                                         | U13 (#378)          | 6 / 9 / 9                    | issue filed                                    |
| 8   | Answer the Android back press in annotate instead of swallowing it                                                   | U6                  | 7 / 8 / 6                    | backlog                                        |
| 9   | Split "Done With This Cat" into one label per outcome                                                                | U7                  | 7 / 8 / 7                    | backlog                                        |
| 10  | Give a draft a non-destructive way out that keeps the work                                                           | U8                  | 8 / 7 / 5                    | backlog                                        |
| 11  | Surface the location fix state on the camera screen                                                                  | U14                 | 7 / 7 / 6                    | backlog                                        |
| 12  | Say a draft went stale instead of silently hiding Continue                                                           | U12                 | 6 / 8 / 7                    | backlog                                        |
| 13  | Explain "Ear Tipped" with a drawing                                                                                  | U9                  | 7 / 7 / 8                    | drawing planned                                |
| 14  | Replace Cat Form's "Clear" confirmation with undo                                                                    | U10                 | 6 / 7 / 6                    | Phase 3                                        |
| 15  | Make the annotate trash act, with undo, instead of teaching a gesture by dialog                                      | U19                 | 5 / 8 / 7                    | Phase 3                                        |
| 16  | Separate the attributes the dataset needs from the nice-to-have ones                                                 | U22                 | 8 / 5 / 4                    | Phase 3                                        |
| 17  | Apply “Sighting” across Home, final action, and list; choose one ownership-field label separately                    | U15–U17 (#380), U21 | 6 / 6 / 7                    | issue filed; field label pending               |
| 18  | Make Take Photos the Home primary action; check whether Submission's full-width action stack needs clearer grouping  | U18 (#379)          | 6 / 7 / 6                    | issue filed for Home; Submission check pending |
| 19  | Label annotate's dot states                                                                                          | U20                 | 4 / 8 / 8                    | backlog                                        |
| 20  | Add a visible cancel to Cat Form                                                                                     | U23                 | 5 / 8 / 8                    | backlog                                        |
| 21  | Show "Open Settings" only after a permission denial                                                                  | U24                 | 3 / 8 / 9                    | backlog                                        |
| 22  | Use one label shape in the status row                                                                                | U25                 | 2 / 8 / 9                    | backlog                                        |

### Added by the error-design pass (design-everyday-things), 2026-09-25

Ordered by severity × frequency, continuing the list above. Rows that only cross-reference a
usability-pass finding are not repeated here.

| #   | Idea                                                                                                                | Finding  | ICE (impact/confidence/ease) | Status  |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------- | ------- |
| 23  | Show each Cat Form attribute's standing value in the form, so the save-time "N fields not set" dialog is not needed | N1       | 8 / 7 / 5                    | open    |
| 24  | Show photo upload state where the photos are, not only when it stalls a submit                                      | N4       | 7 / 8 / 5                    | open    |
| 25  | Give the two "Remove this cat?" dialogs one title each                                                              | N2       | 6 / 9 / 9                    | open    |
| 26  | Clear the Cat Form at once with an Undo, and drop the dialog that claims it cannot be undone                        | N3       | 6 / 8 / 8                    | decided |
| 27  | Add an Undo after a cat is removed, keeping the confirmation in front of it                                         | N3, N10  | 6 / 7 / 6                    | decided |
| 28  | Make the annotate trash remove the photo, with an Undo, instead of opening a dialog that teaches a gesture          | N10, U19 | 5 / 8 / 7                    | decided |
| 29  | Make the good and the poor location states look different in kind, so a tick does not read as a dead control        | N5       | 4 / 7 / 8                    | open    |

### Added by the in-app copy pass (made-to-stick), 2026-09-25

| #   | Idea                                                                              | Finding    | Pre-committed check                                                                                                      | Status                                  |
| --- | --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 30  | Correct Onboarding's setup claims; remove the unmeasured “About a minute” promise | U26 (#381) | In a first-run comprehension test, participants know the next step asks them to choose how to sign in, without being led | issue filed; claim verification pending |

### Added by the microinteractions pass, 2026-09-25

Ordered by severity × frequency, continuing the list above. Rows 24 and 27 already cover upload state
and remove-Undo from the error-design pass and are not repeated.

| #   | Idea                                                                                                      | Finding       | Pre-committed check                                                                                                                | Status |
| --- | --------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 31  | Give `AppButton` a pressed state, so every button in the app answers a touch before its action completes  | M1            | On a device, each button visibly changes between touch-down and release on both platforms                                          | open   |
| 32  | Wire the existing `isSubmitting` flag into the `Finished!` button's existing `loading` prop               | M2, U1 (#372) | Tapping Submit shows a waiting state until the app leaves the screen, however brief, and a second tap cannot start a second submit | open   |
| 33  | Give the reports list a loading state and a read-failure state, so "No reports yet" only means no reports | M-reports     | A returning user with saved Sightings never sees the empty state, and a read failure says so instead of showing an empty list      | open   |
| 34  | Confirm that Reset cleared the draft, instead of returning to Home silently                               | M-reset       | After Reset, the user can say what happened without being asked to guess                                                           | open   |
| 35  | Add one haptic at capture and one at a confirmed submit, and nowhere else                                 | M4            | Both fire once per event on a device, and the app is fully usable with system haptics off                                          | open   |

### Added by the visual pass (refactoring-ui), 2026-09-25

No new tokens. Every row corrects a misuse of an existing primitive.

| #   | Idea                                                                                                                                                                                 | Finding    | Pre-committed check                                                                                 | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- | ------ |
| 36  | Make Take Photos the visual lead on Home: full diameter and filled `primary`, with Upload Photos at about 70% diameter and outlined `secondary`                                      | H1 (#379)  | On a render, a blurred and a grayscale screenshot both show one clear primary                       | open   |
| 37  | Rebuild the Submission action block — Reset to the header row, `Finished!` filled `primary` at `typography.base` and last, Add More Photos outlined `secondary`, Add a Cat unchanged | S1, S4, S6 | A blurred screenshot shows one dominant action, and the primary is no longer smaller than a cat row | open   |
| 38  | Route all four Submission actions through `AppButton` instead of hand-rolled `Pressable`s                                                                                            | S5         | No bespoke button styles remain in `submission/create/index.styles.ts`                              | open   |
| 39  | Split the uniform root gap: `spacing.xxxl` between groups, `spacing.md` inside the action stack                                                                                      | S2         | Measured gaps between groups exceed gaps inside them on a render                                    | open   |
| 40  | Put the three off-scale values back on the scale, and pass tokens rather than numbers at the `BottomButtonColumn` call site                                                          | S3, H2     | No raw spacing number remains in either screen                                                      | open   |
| 41  | Make New Sighting `secondary` so Continue Observation leads the resume pair                                                                                                          | H3         | A blurred screenshot of the resume column shows one lead                                            | open   |

### Added by the copy pass (made-to-stick), 2026-09-26

Every row is a copy change except row 46, which is a decision the maintainer owns. No row alters the data
model: row 44 relabels a field and leaves `owned_domesticated` and its three values untouched.

| #   | Idea                                                                                | Finding          | Pre-committed check                                                                                                             | Status                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Cut the unmeasured "About a minute" from slide 2                                    | Onboarding steps | No onboarding sentence asserts a duration the project cannot show                                                               | open                                                                                                                                                                                         |
| 44  | Relabel the Cat Form field `Owned / Domesticated` — label undecided                 | Cat Form         | The label names one judgment the observer can make from the animal in front of them; the persisted key and values are unchanged | blocked: behavior and appearance labels both rejected 2026-09-26 — a dumped pet can be too scared to approach, and grooming or a collar does not separate feral from abandoned (owner: user) |
| 45  | Explain ear tipping with a drawing of a clipped ear tip beside the Ear Tipped field | Cat Form         | A first-time user answers Ear Tipped without leaving the form to look the term up                                               | drawing planned (owner: user)                                                                                                                                                                |
| 47  | Name no sign-in provider anywhere in Onboarding — say "choose how to sign in"       | Onboarding setup | No screen names a provider, so no copy can promise a choice the release does not have                                           | open                                                                                                                                                                                         |
