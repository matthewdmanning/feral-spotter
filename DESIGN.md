# Design System

Started 2026-09-25 by the `improve-app` journey. Tracking issue
matthewdmanning/feral-spotter#371.

Raw color values live only in `src/config/unistyles.ts`. Component `*.styles.ts` files consume tokens.
This file records decisions and findings, not hex values.

## Design Direction

Not yet defined. Phase 4 (refactoring-ui) fills this.

## Typography

Not yet defined. Phase 4 fills this.

## Tokens

Not yet audited. Phase 4 fills this.

## Components

| Component | Decision | Status |
|---|---|---|

## UX Audit Findings

Phase 2 (ux-heuristics), 2026-09-25. Source: code audit of the primary path — Home, Camera, Annotate,
Cat Form, Submission, Submit — plus the permission gates and error paths. No user evidence yet.

Interface score: **4/10**. Ordered by severity × frequency, not by ease.

| # | Issue | Heuristic | Severity | Fix | Owner | Status |
|---|---|---|---|---|---|---|
| U1 (#372) | Submit renders no state for up to 30 s. `useSubmissionSubmit` returns `isSubmitting` and sets `useUIStore.setSubmitting`, and nothing in the app renders either. `waitForUploads` blocks up to `UPLOAD_WAIT_TIMEOUT_MS`. The user confirms, then sits on an unchanged screen with a live "Finished!" button | 1 visibility of system status | 4 | Render the submit state: disable the button, change its label, show progress. Consume the flag that already exists | agent | issue filed |
| U2 (#373) | Submit success is silent. On success the code calls `completeDraft()` then `router.replace('/')` — no confirmation, no receipt, no count. Success and silent failure look identical | 1 | 4 | Confirm the Submission landed, and say what happens to it next | agent | issue filed |
| U3 (#374) | "Box the Cat" ships with no guidance. `isTutorialReleased()` gates the tutorial off, `AnnotateCarouselItem` carries no instructional copy, and `create` auto-skips a first-time user straight into annotate | 10 help, 1 | 4 | Give the first annotate entry an instruction that does not depend on the gated tutorial | agent | issue filed |
| U4 (#375) | Four controls disable with no reason given: both Home entrypoints (source-pinned by ADR 0002), "Finished!" (no cats), "← Previous" (first photo) | 1, 9 | 3 | State the reason next to each disabled control | agent | issue filed |
| U5 (#376) | Annotate has no way to advance a photo. The carousel is `enabled={false}` and there is no Next button — the user must press "Not in Photo" or confirm a box. The dots imply swiping works | 2, 7 | 3 | Give the pass an explicit forward control | agent | issue filed |
| U6 | `useBackHandler(() => true)` swallows Android back in annotate with no feedback. The hardware key is dead | 3, 4 | 3 | Answer the back press with the exit affordance instead of nothing | agent | backlog |
| U7 | "Done With This Cat" does two different things — finishes a cat, or abandons the pass when nothing is boxed | 4 | 3 | One label per outcome | agent | backlog |
| U8 | No exit from a draft except Reset (destructive) or Finished. `submission/` sits outside `(home-tabs)`, so Home, Feral Reports and Settings are unreachable mid-draft | 3 | 3 | Give the draft a non-destructive way out that keeps the work | agent | backlog |
| U9 | "Ear Tipped" is TNR jargon with no inline explanation, and is plausibly the most research-valuable field on the form | 2, 10 | 3 | Explain it in place | agent | backlog — Phase 6 |
| U10 | Cat Form's "Clear" wipes all 8 attributes from a danger-coloured header button, with no undo | 3, 5 | 3 | Prefer undo over a confirmation dialog | agent | backlog — Phase 3 |
| U11 (#377) | "Submission Failed — Please try again" gives no why, no how, and never says the draft survived, which it does | 9 | 3 | Rewrite to what happened, why, how to fix — and say the work is safe | agent | issue filed |
| U12 | A stale draft silently hides "Continue Observation". In-progress work disappears with no notice | 1 | 3 | Say the draft went stale rather than removing the entry | agent | backlog |
| U13 (#378) | Cat rows render raw enum values. A cat saved at defaults reads "Unknown · unknown · unknown hair" | 2 | 3 | Render a human label, and a distinct one for an all-unknown cat | agent | issue filed |
| U14 | The camera screen shows no location state while the Live fix is acquiring, so a poor fix is a surprise two screens later | 1 | 3 | Surface the fix state where it is being acquired | agent | backlog |
| U15 | Four user-facing words for one concept: "Continue **Observation**", "New **Sighting**", screen title "**Submission**", tab "Feral **Reports**" | 4 | 2 | Naming is a human decision — deferred to Phase 6 with the full copy inventory | user | backlog — Phase 6 |
| U16 | "Submit Submission" dialog title | 1, 4 | 2 | Rewrite | agent | backlog — Phase 6 |
| U17 | "Finished!" never says what happens when pressed | 1 | 2 | Name the action | agent | backlog — Phase 6 |
| U18 | No single primary action. Home shows two identical circles; Submission shows three equal-weight bottom buttons | 8 | 2 | One primary per screen | agent | backlog — Phase 4 |
| U19 | Tapping the annotate trash opens an alert that says "Long press to remove" — a dialog used to teach a gesture | 5, 10 | 2 | Make the control do the thing, with undo | agent | backlog — Phase 3 |
| U20 | Annotate's dot colours (current, located, not-in-photo) have no legend | 6 | 2 | Label the states | agent | backlog |
| U21 | "Owned / Domesticated" puts two terms on one field | 2 | 2 | One term | user | backlog — Phase 6 |
| U22 | The Cat Form asks 8 attributes with no required or optional signal and no progressive disclosure. This is the functional gap from Phase 1, on one screen | 8, 7 | 2 | Separate what the dataset needs from what is nice to have | user | backlog — Phase 3 |
| U23 | Cat Form has no visible cancel | 3 | 2 | Add one | agent | backlog |
| U24 | "Open Settings" is offered on the camera gate before the user has denied anything | 8 | 1 | Show it after a denial | agent | backlog |
| U25 | Status row mixes label shapes: "Location" against "Date & Time Recorded" | 4 | 1 | One shape | agent | backlog |

### Trunk Test

| Screen | Result | Note |
|---|---|---|
| Home | pass | App name in the header, tab bar gives "you are here" |
| Camera | pass | Full-screen capture convention, X exits |
| Feral Reports | pass | Titled, counted, has an empty state |
| Annotate | **fail** | No screen name, no visible exit, hardware back dead (U3, U6, U7) |
| Submission | partial | Titled, but no options and no way out (U8) |
| Cat Form | partial | Titled, but no cancel (U23) |

Search is absent everywhere and is not applicable — the app has no search surface.

### Hire-moment resolution (feeds back to CUSTOMER.md)

The severity-4 findings cluster at two moments. U3 threatens completion of the first Submission — a Big
Hire risk. U1 and U2 remove any reason to come back — a Little Hire failure. **Little Hire is the primary
leak**, with a real Big Hire completion risk at annotate.

### Error-Design Findings

The error-design pass (design-everyday-things), 2026-09-25. Heuristic column names the Norman gulf.
Findings already filed from the usability pass are cross-referenced, not repeated.

| # | Issue | Gulf | Severity | Fix | Owner | Status |
|---|---|---|---|---|---|---|
| N1 | A Cat Form attribute left alone and one deliberately set to Unknown are the same value once saved, but the form hides that. The user only learns which fields they skipped from a dialog at save time listing them as bullets, with "Save anyway" as the way out. An error message stands where a signifier belongs | Execution | 3 | Show each attribute's standing value in the form, so nothing is a surprise at save and the dialog is not needed | agent | open |
| N2 | Two different dialogs share the title "Remove this cat?". One deletes a saved cat. The other discards an unsaved cat's boxes on the way out of the form. Same words, different loss | Execution | 3 | One title per outcome | agent | open |
| N3 | "Clear form?" claims "This cannot be undone". It is true only because the undo was never built — the 8 attributes live in ordinary component state and can be snapshotted in a few lines | Evaluation | 2 | Clear at once, offer Undo, drop the dialog | agent | decided — build undo |
| N4 | Photo upload runs in the background from the moment each photo is taken, and no screen shows it. The state first becomes visible when it stalls a submit for 30 seconds | Evaluation | 3 | Show upload state where the photos are, not only when it blocks something | agent | open |
| N5 | When the location fix is good, the status control shows a tick and is disabled. It looks like the warning state, which is tappable, so the tick reads as a control that does nothing | Execution | 2 | Make the two states look different in kind, not only in colour | agent | open |
| N6 | The box-drawing canvas affords drawing and says nothing about it | Execution | 4 | Cross-reference — filed as #374 | agent | issue filed |
| N7 | A disabled control is an anti-affordance with no signifier, in four places | Execution | 3 | Cross-reference — filed as #375 | agent | issue filed |
| N8 | Submitting gives no feedback during, and none on success | Evaluation | 4 | Cross-reference — filed as #372 and #373 | agent | issue filed |
| N9 | The submit failure message does not say what happened, why, or that the work survived | Evaluation | 3 | Cross-reference — filed as #377 | agent | issue filed |
| N10 | Tapping the annotate trash opens a dialog that teaches a gesture rather than doing anything | Execution | 2 | Make the control remove the photo, with Undo | agent | decided — build undo |

### Destructive Actions — confirm or undo

Decided 2026-09-25 with the maintainer, case by case.

| Action | Today | Decision | Reason |
|---|---|---|---|
| Remove a cat | Confirms first. The message states that photos and other cats survive | **Keep the confirmation and add Undo after it** | The confirmation was a deliberate choice, and its message already says what survives. Undo is added on top rather than replacing it |
| Clear the Cat Form | Confirms first, and claims the action cannot be undone | **Replace with Undo** | Nothing records the dialog as deliberate, and the 8 attributes are ordinary component state, so restoring them is cheap |
| Remove a photo while annotating | Tap opens a dialog saying "Long press to remove" | **Act on the control, with Undo** | A dialog that teaches a gesture is an instruction nobody reads |
| Reset the whole Submission | Confirms first, warning that everything clears | **Keep the confirmation** | It is rare, it is genuinely large, and it spans four stores and a cache row. A deliberate pause here is honest rather than annoying |

### Error-message checklist

Norman's four requirements: say what happened, say how to fix it, do not blame the user, preserve the
user's work.

| Message | What | How | No blame | Work preserved | Verdict |
|---|---|---|---|---|---|
| "Remove this cat?" (saved cat) | yes | yes | yes | states what survives | passes |
| "Remove this cat?" (unsaved cat) | yes | yes | yes | states what survives | passes, but shares its title with the one above (N2) |
| "N fields not set" | yes | no — offers only Cancel or Save anyway | yes | yes | fails: an error message doing a signifier's job (N1) |
| "Clear form?" | yes | no | yes | **no** — and says so | fails (N3) |
| "Submission Failed" | no | no | yes | yes, but never says so | fails (#377) |
| "Camera Access Required" | yes | yes | yes | n/a | passes |
| "Submission Incomplete" | yes | partly | yes | yes | passes |

## Microinteraction Inventory

| Interaction | Trigger/Rules/Feedback/Loops | Fix | Status |
|---|---|---|---|

Phase 5 fills this.
