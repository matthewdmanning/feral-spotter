# Positioning & Messaging

## Competitive Alternatives

See [CUSTOMER.md](CUSTOMER.md#competing-alternatives). Positioning work is outside this in-app copy pass.

## Unique Attributes → Value Themes

| Attribute | Value ("so what") | Proof |
|---|---|---|

## Best-Fit Customer

See the two encounter circumstances in [CUSTOMER.md](CUSTOMER.md#job-statement). A target segment has not been validated with users.

## Market Category

Undecided; no category claim is needed for the current in-app copy audit.

## One-Liner

One user-facing unit name is decided: **Sighting**. A public positioning line is outside this in-app copy pass.

## Brand Script (StoryBrand)

Not assessed in this in-app copy phase.

## Key Messages

Phase 6 source audit, 2026-09-25. Scores are a qualitative SUCCESs diagnostic of **current** copy, not user-test results. Each vector is Simple / Unexpected / Concrete / Credible / Emotional / Stories, 1–10 each. Utility labels need clarity more than surprise or a story; the lowest useful trait drives each rewrite. No proposed copy has shipped.

| Surface | Commander's Intent | Current copy and score | Proposed copy or decision | Owner | Priority | Status |
|---|---|---|---|---|---|---|
| Onboarding purpose | Explain what one sighting contributes | “Every feral counts” plus “data that rescue volunteers and ecology researchers use”; 6/3/5/4/6/2 = **26/60**. Credible is weakest: no data has been collected, so no one uses it yet. | “Every neighborhood has its ferals. FeralSpotter turns what you spot into a photo and a location, recorded for feral-cat research.” Cut the claim that anyone uses the data today. Projected 7/4/7/8/6/2 = **34/60**. | agent | P2 | #381; claim resolved 2026-09-26, copy not shipped |
| Onboarding steps | Show the next four actions | “Spot. Snap. Submit.” is memorable, but the body omits Box the Cat and says “About a minute” without timing evidence; 8/4/6/4/5/3 = **30/60**. | Keep the header; body: “Take photos, box the cat in each photo, add what you know, and submit.” Remove the one-minute promise until measured. Projected 8/4/8/7/5/3 = **35/60**. | agent | P2 | #381 filed; copy not shipped |
| Home | Let a returning user resume or start | “Continue Observation” and “New Sighting” name the same unit differently; 5/2/5/6/3/1 = **22/60**. Simplicity is weak. | “Continue Sighting” / “New Sighting.” | agent | P2 | #380 filed; not shipped |
| Box Annotation | Tell a first-time user what to do with the photo | No visible first-pass instruction when the Tutorial is release-gated; 2/1/2/5/2/1 = **13/60**. Simplicity and concreteness are weakest. | “Draw a box around the cat in this photo. If it is not here, choose Not in Photo.” Pair with #374's first-entry guidance; do not alter navigation before resolving #376 against the active design decision. | agent | P1 | proposed in #374 |
| Cat Form | Make the saved action and field meanings clear | Save can read “Put the Cat in a Box” or “Save Observation”; “Ear Tipped” is unexplained and “Owned / Domesticated” names two different concepts under one yes/no/unsure value (`src/screens/submission/cats/attributes.ts:73`); 4/2/4/5/3/1 = **19/60**. Simplicity and concreteness are weak. | Label the action “Save Cat” (#380). Relabel `Owned / Domesticated` so one label names one judgment; the wording is undecided. “Friendly to People” was rejected on 2026-09-26: a dumped pet is domesticated and can still be too scared to approach, so behavior and origin come apart. Appearance labels are ruled out as well — many feral cats are better groomed and fed than abandoned house cats, and most cats wear no collar. Copy only: the stored `owned_domesticated` key and its three values do not change. Explain ear tipping with a drawing of a clipped ear tip beside the field — the drawing is planned. Projected 8/3/8/6/3/1 = **29/60**. | agent | P2 | field label reopened 2026-09-26 (owner: user); #380 covers the action label; copy not shipped |
| Submission and result | Make the final action and outcome unambiguous | “Finished!” opens “Submit Submission”; success returns Home without a receipt; 3/1/3/5/3/1 = **16/60**. Simplicity and concreteness are weak. | Button “Submit Sighting”; confirmation “Submit this sighting?” can keep the cat/photo counts. After success, say the sighting was saved to the research database only after the metadata upload succeeds; do not promise that a rescue group saw or acted on it. Tie receipt and failure wording to #373 and #377. | agent | P0 | #380 filed; receipt in #373 |
| Submission actions — add photos | One label for both photo sources | Today the label switches on `photoSource`: “Take More Photos” after a camera draft, “Select More Photos” after a Library draft. Two labels for one action, and the user cannot mix sources anyway (ADR 0002's single-source-by-construction `source`). | One label, **“Add More Photos”**, whichever source started the draft. The maintainer decided this during the Phase 4 visual pass; recorded here so the copy pass does not re-open it. | agent | P2 | decided in Phase 4; not shipped |
| Submission list empty state | Explain what this list contains | The current Pixel 7 render shows “Feral Reports,” “No reports yet,” and “Submissions appear here as you create them”; an in-progress draft can also appear here; 5/2/5/5/2/1 = **20/60**. Simplicity is weak. | If Phase 9 keeps the list, title it “Sightings” and explain that it includes both drafts and submitted sightings. | user | P3 | #380 filed; [device capture](test-drives/screen-captures/2026-09-25_sightings-empty-state.png); tab decision pending |

