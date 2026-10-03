# Design System

Started 2026-09-25 by the `improve-app` journey. Tracking issue
matthewdmanning/feral-spotter#371.

Raw color values live only in `src/config/unistyles.ts`. Component `*.styles.ts` files consume tokens.
This file records decisions and findings, not hex values.

## Design Direction

Phase 4 source audit completed. The existing light/dark theme and component variants provide the
starting system. A [current Pixel 7 Home capture](test-drives/screen-captures/issue-371-home-2026-09-25-pixel7.png)
confirms that Take Photos and Upload Photos have equal size, color, and weight. The maintainer chose Take
Photos as the visual primary. A [current Pixel 7 empty-list capture](test-drives/screen-captures/2026-09-25_sightings-empty-state.png)
confirms the Reports surface displays “Feral Reports,” “No reports yet,” and “Submissions appear here as you
create them.” Submission's action grouping still needs a rendered check.

The Phase 2 pass recorded U1–U25. U26 was added during the Phase 6 copy audit.

## Typography

`src/config/themes.ts` defines a shared 12/14/16/18/20/24/30 type scale. Its use on the key screens
still needs a rendered grayscale check.

## Tokens

Source audit, 2026-09-25:

- Shared spacing is 4/8/12/16/20/24/32 dp; radius is 6/8/12/16/20/full. Keep these existing mobile
  scales for Phase 4 unless a rendered screen shows a specific gap.
- Light and dark themes use semantic color tokens. Calculated text contrast is 17.06:1 (light text on
  background), 4.55:1 (light muted on background), 15.13:1 (dark text on background), 7.31:1 (dark muted
  on background), and 5.47:1 (button text on accent). These are token-pair checks, not rendered-screen
  or accessibility-device verification.
- `shadow` is a shared rendering primitive; no new elevation scale is justified by the source audit.

Phase 4 decision, 2026-09-25: **no new tokens.** Every one of the nine findings below is a misuse of a
primitive that already exists, not a missing one. Three off-scale values in
`submission/create/index.styles.ts` need correcting to the existing scale:

| Value | Where | Correction |
|---|---|---|
| `paddingVertical: 14` | all four bottom actions | `theme.spacing.lg` (16) |
| `marginVertical: -12` | `catRowRemoveBtn` | `-theme.spacing.md` |
| `spacing={12} paddingBottom={16}` | `BottomButtonColumn` call in `home/index.tsx` | `theme.spacing.md` / `theme.spacing.lg` — the numbers are already on the scale; the call site is not |

## Components

Phase 4 source audit, 2026-09-25, with the Pixel 7 Home capture as the only rendered evidence. Home and
Submission both score **5/10** on the eight-row visual diagnostic: both fail the blur test, the grayscale
test, the white-space row and the consistent-scale row. Applying every decision below projects both to
**10/10**, but that is a projection from source and must be confirmed on a render. One item to check on
that render: the outlined `secondary` circle's label contrast against the background — the recorded 5.47:1
figure covers the filled variant only.

| Component | Decision | Owner | Priority | Status |
|---|---|---|---|---|
| Home entrypoints | H1: both entrypoints are `variant="primary"` circles at the same computed diameter, fill and label weight, so neither leads. Decided: Take Photos keeps the full diameter and the filled `primary`; Upload Photos drops to about 70% diameter and outlined `secondary`. | agent | P2 | #379 filed; decided, not shipped |
| Submission actions | S1/S4/S5/S6: four full-width stacked actions share `minHeight: 48`, `paddingVertical: 14`, `typography.sm` and `fontWeight: '600'`, so only fill and border colour separate them — and the primary action is 14 px while a cat row is 16 px. Decided arrangement, top to bottom: **Reset** as muted text in the header row beside the title; the cat list with **Add a Cat** keeping its dashed no-fill treatment; a 32 dp group gap; **Add More Photos** as outlined `secondary`; **Finished!** as filled `primary` at `typography.base`, last. All four route through `AppButton` instead of hand-rolled `Pressable`s. | agent | P2 | decided, not shipped |
| Home resume pair | H3: "Continue Observation" and "New Sighting" are both `variant: 'primary'`. Decided: Continue stays `primary`, New Sighting becomes `secondary`. The existing 24-hour `SUBMISSION_STALE_MS` gate stays the only timing rule — no second timing layer inside the window. | agent | P2 | decided, not shipped |
| Submission root spacing | S2: one root `gap: theme.spacing.lg` means the gap between groups equals the gap inside the action stack, which inverts the spacing rule. Decided: `spacing.xxxl` between the cat-list group and the action block, `spacing.md` inside the stack. | agent | P2 | decided, not shipped |
| Home white space | H4: a large dead zone sits below the second circle once Upload Photos shrinks. Recorded as an observation, not a defect — the entrypoint area is deliberately generous. | agent | P3 | no action |

## iOS conventions

Phase 4b source check, 2026-09-25. **2/10 diagnostic points confirmed from source**, not an iOS usability score: the app uses semantic light/dark theme colors and stack/tab navigation. It declares iOS support and uses a 48 dp target convention in several controls, but safe areas across device sizes, all touch targets, Dynamic Type, VoiceOver completion, actual dark rendering, and native modal behavior remain unverified without an iOS build and device. The other eight diagnostic points are unverified, not failed.

| Convention | Source finding | Action | Owner | Priority | Status |
|---|---|---|---|---|---|
| Modal dismissal | Box Annotation is a full-screen modal with swipe dismissal disabled and no visible close control; “Done With This Cat” can also abandon the pass (U6, U7). [Apple asks for an obvious modal dismissal](https://developer.apple.com/design/human-interface-guidelines/modality). | Resolve U6/U7 with a clear exit that preserves the draft; reconcile with the active crop-frame design decision before changing gestures. | user | P1 | decision pending |
| State color | Annotation dots encode current, located, not-in-photo, and untouched using color and width without labels (U20). [Apple asks for alternatives to color](https://developer.apple.com/design/human-interface-guidelines/color). | Label or otherwise distinguish the states, then check with VoiceOver. | agent | P2 | backlog |
| Layout and text scaling | Home's circles use a computed diameter, while screens use shared fixed type tokens; no iPhone safe-area or large-text render was available. [Apple calls for adaptive layout](https://developer.apple.com/design/human-interface-guidelines/layout) and [text scaling](https://developer.apple.com/design/human-interface-guidelines/typography). | Check a small and large iPhone, large text, and dark mode before calling the iOS pass complete. | agent | P1 | awaiting iOS device |

## UX Audit Findings

Phase 2 (ux-heuristics), 2026-09-25. Source: code audit of the primary path — Home, Camera, Annotate,
Cat Form, Submission, Submit — plus the permission gates and error paths. No user evidence yet.

Interface score: **4/10**. Ordered by severity × frequency, not by ease.

| # | Issue | Heuristic | Severity | Fix | Owner | Status |
|---|---|---|---|---|---|---|
| U1 (#372) | Submit renders no state at all. `useSubmissionSubmit` returns `isSubmitting` and sets `useUIStore.setSubmitting`, and nothing in the app renders either. Photo uploads start at capture and run in the background, so `waitForUploads` normally passes at once; its `UPLOAD_WAIT_TIMEOUT_MS` is a stall ceiling, not a wait users meet. The defect is the silence, not its length: the user confirms, sits on an unchanged screen with a live "Finished!" button, and then arrives on Home with nothing said | 1 visibility of system status | 4 | Render the submit state: disable the button, change its label, show progress. Consume the flag that already exists | agent | issue filed |
| U2 (#373) | Submit success is silent. On success the code calls `completeDraft()` then `router.replace('/')` — no confirmation, no receipt, no count. Success and silent failure look identical | 1 | 4 | Confirm the Submission landed, and say what happens to it next | agent | issue filed |
| U3 (#374) | "Box the Cat" ships with no guidance. `isTutorialReleased()` gates the tutorial off, `AnnotateCarouselItem` carries no instructional copy, and `create` auto-skips a first-time user straight into annotate | 10 help, 1 | 4 | Give the first annotate entry an instruction that does not depend on the gated tutorial | agent | issue filed |
| U4 (#375) | Four controls disable with no reason given: both Home entrypoints (source-pinned by ADR 0002), "Finished!" (no cats), "← Previous" (first photo) | 1, 9 | 3 | State the reason next to each disabled control | agent | issue filed |
| U5 (#376) | Annotate has no way to advance a photo. The carousel is `enabled={false}` and there is no Next button — the user must press "Not in Photo" or confirm a box. The dots imply swiping works | 2, 7 | 3 | Give the pass an explicit forward control | agent | issue filed |
| U6 | `useBackHandler(() => true)` swallows Android back in annotate with no feedback. The hardware key is dead | 3, 4 | 3 | Answer the back press with the exit affordance instead of nothing | agent | backlog |
| U7 | "Done With This Cat" does two different things — finishes a cat, or abandons the pass when nothing is boxed | 4 | 3 | One label per outcome | agent | backlog |
| U8 | No exit from a draft except Reset (destructive) or Finished. `submission/` sits outside `(home-tabs)`, so Home, Feral Reports and Settings are unreachable mid-draft | 3 | 3 | Give the draft a non-destructive way out that keeps the work | agent | backlog |
| U9 | "Ear Tipped" is TNR jargon with no inline explanation, and is plausibly the most research-valuable field on the form | 2, 10 | 3 | Explain it with a planned drawing of a clipped ear tip beside the field | user | drawing planned |
| U10 | Cat Form's "Clear" wipes all 8 attributes from a danger-coloured header button, with no undo | 3, 5 | 3 | Prefer undo over a confirmation dialog | agent | backlog — Phase 3 |
| U11 (#377) | "Submission Failed — Please try again" gives no why, no how, and never says the draft survived, which it does | 9 | 3 | Rewrite to what happened, why, how to fix — and say the work is safe | agent | issue filed |
| U12 | A stale draft silently hides "Continue Observation". In-progress work disappears with no notice | 1 | 3 | Say the draft went stale rather than removing the entry | agent | backlog |
| U13 (#378) | Cat rows render raw enum values. A cat saved at defaults reads "Unknown · unknown · unknown hair" | 2 | 3 | Render a human label, and a distinct one for an all-unknown cat | agent | issue filed |
| U14 | The camera screen shows no location state while the Live fix is acquiring, so a poor fix is a surprise two screens later | 1 | 3 | Surface the fix state where it is being acquired | agent | backlog |
| U15 (#380) | Four user-facing words for one concept: "Continue **Observation**", "New **Sighting**", screen title "**Submission**", tab "Feral **Reports**" | 4 | 2 | Use “Sighting” throughout user-facing copy; retain “Submission” for the data model | agent | issue filed |
| U16 | "Submit Submission" dialog title | 1, 4 | 2 | Rewrite | agent | backlog — Phase 6 |
| U17 | "Finished!" never says what happens when pressed | 1 | 2 | Name the action | agent | backlog — Phase 6 |
| U18 (#379) | Home shows two equally prominent primary circles. Submission has one filled primary plus two outlined actions, but all three occupy full-width bottom rows | 8 | 2 | Make Take Photos the Home visual primary, as chosen after a current Pixel 7 capture; check Submission grouping and spacing on device | agent | issue filed for Home; Submission check pending |
| U19 | Tapping the annotate trash opens an alert that says "Long press to remove" — a dialog used to teach a gesture | 5, 10 | 2 | Make the control do the thing, with undo | agent | backlog — Phase 3 |
| U20 | Annotate's dot colours (current, located, not-in-photo) have no legend | 6 | 2 | Label the states | agent | backlog |
| U21 | "Owned / Domesticated" puts two terms on one field | 2 | 2 | One term | user | backlog — Phase 6 |
| U22 | The Cat Form asks 8 attributes with no required or optional signal and no progressive disclosure. This is the functional gap from Phase 1, on one screen | 8, 7 | 2 | Separate what the dataset needs from what is nice to have | user | backlog — Phase 3 |
| U23 | Cat Form has no visible cancel | 3 | 2 | Add one | agent | backlog |
| U24 | "Open Settings" is offered on the camera gate before the user has denied anything | 8 | 1 | Show it after a denial | agent | backlog |
| U25 | Status row mixes label shapes: "Location" against "Date & Time Recorded" | 4 | 1 | One shape | agent | backlog |
| U26 (#381) | Onboarding promises “About a minute,” names Google as the next sign-in though email is offered | 2 match between system and real world | 2 | Remove the time promise until measured; name no sign-in provider at all | agent | issue filed |

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

### Hire-moment evidence boundary (feeds back to CUSTOMER.md)

The severity-4 findings cluster at two moments. U3 threatens completion of the first Submission.
U1 and U2 leave the submit result unclear. These source findings justify usability fixes but do not
show which moment loses more users, or whether anyone returns. The maintainer deferred retention
assessment entirely; no Big Hire / Little Hire ranking is claimed here.

### Error-Design Findings

The error-design pass (design-everyday-things), 2026-09-25. Heuristic column names the Norman gulf.
Findings already filed from the usability pass are cross-referenced, not repeated.

| # | Issue | Gulf | Severity | Fix | Owner | Status |
|---|---|---|---|---|---|---|
| N1 | A Cat Form attribute left alone and one deliberately set to Unknown are the same value once saved, but the form hides that. The user only learns which fields they skipped from a dialog at save time listing them as bullets, with "Save anyway" as the way out. An error message stands where a signifier belongs | Execution | 3 | Show each attribute's standing value in the form, so nothing is a surprise at save and the dialog is not needed | agent | open |
| N2 | Two different dialogs share the title "Remove this cat?". One deletes a saved cat. The other discards an unsaved cat's boxes on the way out of the form. Same words, different loss | Execution | 3 | One title per outcome | agent | open |
| N3 | "Clear form?" claims "This cannot be undone". It is true only because the undo was never built — the 8 attributes live in ordinary component state and can be snapshotted in a few lines | Evaluation | 2 | Clear at once, offer Undo, drop the dialog | agent | decided — build undo |
| N4 | Photo upload runs in the background from the moment each photo is taken, and no screen shows it. The state never becomes visible at all, except in the rare case where a stalled upload fails a submit | Evaluation | 3 | Show upload state where the photos are, not only when it blocks something | agent | open |
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

Phase 5 source inventory, 2026-09-25. Direct-touch timing and rendered states still need a device pass.

| Interaction | Trigger / rules / feedback / loops | Fix | Owner | Priority | Status |
|---|---|---|---|---|---|
| Camera shutter | Tap captures; disabled while taking a photo; the shutter scales on press in 70 ms and returns in 140 ms, then the photo strip updates; repeats for each photo. | Preserve this immediate response as the baseline for other controls. | agent | P3 | source-audited; device pending |
| Submit | `Finished!` opens confirmation; at least one cat and photo are required. After confirmation nothing is rendered; uploads are already finished in the usual case, so the wait is short, and success routes Home silently while failure raises an alert; repeats for the next Submission. | Render progress/disabled state (#372), a truthful success receipt (#373), and work-preserving failure copy (#377). | agent | P0 | issues filed; device pending |
| Box Annotation | Frame and buttons trigger box confirmation or photo skipping; the Tutorial is release-gated, and dots encode several states by color; the pass repeats across photos and cats. Confirm or Not in Photo advances automatically, and the last photo ends the pass without a separate completion cue. | Give the first pass visible guidance (#374); settle forward navigation (#376) against the active crop-frame design decision before changing it; label dot states (U20). The last-photo feedback gap is already tracked by #282. | user | P1 | product decision and device check pending |
| Clear or remove a cat | Clear and Remove trigger confirmation; Clear resets eight transient fields, while Remove deletes one saved cat and its boxes but keeps photos; both can recur in one draft. | Follow Phase 3 decisions: replace Clear's dialog with Undo, and add Undo after confirmed cat removal. | agent | P2 | decided; not shipped |

Submit state map from source: no cats → disabled; ready → confirmation; confirmed → photo-upload check (normally instant, because uploads run in the background from capture; its 30 s timeout only catches a stall) → metadata upload → Home on success or an alert on failure. A failed attempt retains the draft in the ordinary error path. The current `Finished!` control does not show the waiting state. A simple success receipt is the proposed signature moment for #373: removing it would again leave users unable to distinguish a completed Submission from an unexplained return to Home. It should acknowledge only the verified upload outcome, without an animation or a claim that a person has acted on the data.

Other source state maps:

- Camera: permission gate → live preview → shutter pressed → capture busy (button disabled) → photo in strip; capture failure remains a device-check item.
- Box Annotation: no photos → empty state; photo unmarked → box confirmed or Not in Photo → next photo; last photo → pass ends. Previous is disabled on the first photo. Photo removal is a hidden long press, with a confirmation unless “don't ask again” was chosen; there is no Undo.
- Cat Form: unset or edited fields → Clear confirmation → all eight fields unset, with no Undo. A saved cat → Remove confirmation → cat and its boxes removed, photos retained, with no Undo.

Provisional source-only diagnostic: Camera shutter **6/10** (clear trigger and immediate press feedback; direct-touch timing unverified); Submit **2/10** (no visible loading or success state; fix #372/#373); Box Annotation **3/10** (hidden gesture and mode, guidance gated; fix #374 and resolve #376); Clear/remove **4/10** (explicit confirmation but no Undo; Phase 3 fix). These scores are not device usability measurements.

### Phase 5 completion — full source audit, 2026-09-25

Ran with the `microinteractions` skill. Seven interactions scored against the eight-row diagnostic
(`score = round(passed / 8 × 10)`). Source evidence only: no direct-touch timing was measured, so every
score below is a source score and not a device usability measurement.

| Interaction | Score | Rows that fail | Evidence in source |
|---|---|---|---|
| Camera shutter | 10/10 | none | `useCameraCapture.tsx` — 25 ms flash in, 180 ms out, press scale in/out, `shutterBusy` opacity while capturing, thumbnail flies to the strip over 150 ms (`CameraThumb.tsx`) |
| Box confirm (hold the centre dot) | 8/10 | evolves over time; learnable without help | `useBoundingBoxFrame.ts` — 650 ms hold, dot scales 1→1.4 and fades as it fills, 120 ms cancel on release. Tutorial is release-gated, so no first-pass hint exists (U3, #374) |
| Remove a cat | 6/10 | trigger state; feedback; evolves | `useRemoveCat.ts` — confirmation, then the row disappears with no exit animation and no Undo |
| Reports list load | 6/10 | trigger state; feedback; evolves | `useFeralReports.ts` — `caches` starts empty and there is no loading flag, so “No reports yet” renders before the first read resolves. The mount read has no `.catch`, so a read failure shows the same empty state |
| Submit a Sighting | 5/10 | trigger state; feedback; feedback matches significance; evolves | `useSubmissionSubmit.ts` returns `isSubmitting`, but `submission/create/index.tsx` does not read it, and nothing in `src/` reads `useUIStore.isSubmitting`. `AlertHost.press()` dismisses the dialog before running the action, so the confirmation cannot hold the waiting state either |
| Reset the draft | 5/10 | trigger state; feedback; feedback matches significance; evolves | `useSubmissionSubmit.ts` — confirmation, then `discardDraft()` and a silent `router.replace('/')`. The largest destructive action in the app ends the same way a successful submit does: silently, on Home |
| Background photo upload | 4/10 | trigger state; feedback; feedback matches significance; evolves; learnable without help | `uploadNewPhoto.ts` writes `upload_progress` 0–100 on every progress tick. Nothing in `src/` renders it. The upload is asynchronous from capture, so the whole of it happens where the user could be shown it and is not |

Four source findings that the earlier inventory above does not name:

- **M1 — No pressed state on any button but the shutter.** `AppButton`'s `Pressable` passes a static
  style array with no `pressed` branch and no `android_ripple`. Every button in the app is visually
  inert between touch-down and the action completing. The shutter is the single control with press
  feedback, and it is hand-rolled. One change in `AppButton.tsx` fixes the whole app at once, and it
  is a precondition for the other fixes reading as deliberate.
- **M2 — The submit loading state is already built and simply unwired.** `AppButton` accepts `loading`
  and renders a variant-coloured `ActivityIndicator`; `useSubmissionSubmit` already exposes
  `isSubmitting`; Sign-in, Register and Consent already use exactly this pattern with their own `busy`
  flags. #372 is wiring, not new work. Note for whoever ships it: `AlertHost.press()` dismisses first
  and then runs `onPress`, so the waiting state must live on the `Finished!` button, not in the dialog.
- **M3 — Upload progress is computed and discarded.** The data behind backlog row 24 already exists per
  photo. The fix is display only.
- **M4 — No haptic channel exists.** `expo-haptics` is not a dependency. Visual feedback is the only
  channel in the app. This is acceptable — haptics are supplementary, never the only channel — but it
  is worth one deliberate use at the shutter and at a confirmed submit, and nowhere else.

**Signature moment.** The camera shutter already is one, and it passes the removal test: without the
flash, the shutter-scale and the thumbnail flight, capture would feel broken rather than plain. Keep it
and do not add a competing one. The submit receipt (#373) is the second and last candidate; it earns the
craft because it closes the story the shutter opens, and, per the Phase 1 emotional-dimension finding, it
is the only moment that can tell a user their Sighting mattered. It must acknowledge only the verified
upload outcome, and it must not block the next action behind an animation.
