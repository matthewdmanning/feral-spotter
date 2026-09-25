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

One user-facing unit name is decided: **Sighting**. A public positioning line is outside this in-app copy pass; downstream-use claims still need review.

## Brand Script (StoryBrand)

Not assessed in this in-app copy phase.

## Key Messages

Phase 6 source audit, 2026-09-25. Scores are a qualitative SUCCESs diagnostic of **current** copy, not user-test results. Each vector is Simple / Unexpected / Concrete / Credible / Emotional / Stories, 1–10 each. Utility labels need clarity more than surprise or a story; the lowest useful trait drives each rewrite. No proposed copy has shipped.

| Surface | Commander's Intent | Current copy and score | Proposed copy or decision | Owner | Priority | Status |
|---|---|---|---|---|---|---|
| Onboarding purpose | Explain what one sighting contributes | “Every feral counts” plus a broad data-use promise; 6/3/5/4/6/2 = **26/60**. Concrete and credible are the useful weak traits. | “See a feral cat? Record its photo and location for feral-cat research.” Keep the benefit tied to the actual Submission. | agent | P2 | #381 filed; claim review pending |
| Onboarding steps | Show the next four actions | “Spot. Snap. Submit.” is memorable, but the body omits Box the Cat and says “About a minute” without timing evidence; 8/4/6/4/5/3 = **30/60**. | Keep the header; body: “Take photos, box the cat in each photo, add what you know, and submit.” Remove the one-minute promise until measured. | agent | P2 | #381 filed |
| Onboarding data use and setup | Say what is sent and what the next gate asks | Data-use slide promises rescue-group use, TNR planning, and prediction without downstream proof in this audit. Final slide names Google alone, though email is also available in the current alpha; 5/3/5/2/5/2 = **22/60**. Credibility is weakest. | State only what the upload path verifies: photos, cat details, and location are sent when the user submits. Setup: “Next, review the data-use agreement and permission requests, then choose how to sign in.” Current alpha offers Google and email; Facebook and Apple on iOS are planned for version 1.0. Verify downstream-use and non-commercial claims before retaining them. | agent | P1 | #381 filed; claim review pending |
| Home | Let a returning user resume or start | “Continue Observation” and “New Sighting” name the same unit differently; 5/2/5/6/3/1 = **22/60**. Simplicity is weak. | “Continue Sighting” / “New Sighting.” | agent | P2 | #380 filed; not shipped |
| Box Annotation | Tell a first-time user what to do with the photo | No visible first-pass instruction when the Tutorial is release-gated; 2/1/2/5/2/1 = **13/60**. Simplicity and concreteness are weakest. | “Draw a box around the cat in this photo. If it is not here, choose Not in Photo.” Pair with #374's first-entry guidance; do not alter navigation before resolving #376 against the active design decision. | agent | P1 | proposed in #374 |
| Cat Form | Make the saved action and field meanings clear | Save can read “Put the Cat in a Box” or “Save Observation”; “Ear Tipped” is unexplained and “Owned / Domesticated” names two concepts; 4/2/4/5/3/1 = **19/60**. Simplicity and concreteness are weak. | Label the action “Save Cat” (#380); explain ear tipping in place. The stored `owned_domesticated` field is one yes/no/unsure value, so its meaning needs a product decision before relabeling it. | user | P2 | #380 filed for action; field decision pending |
| Submission and result | Make the final action and outcome unambiguous | “Finished!” opens “Submit Submission”; success returns Home without a receipt; 3/1/3/5/3/1 = **16/60**. Simplicity and concreteness are weak. | Button “Submit Sighting”; confirmation “Submit this sighting?” can keep the cat/photo counts. After success, say the sighting was saved to the research database only after the metadata upload succeeds; do not promise that a rescue group saw or acted on it. Tie receipt and failure wording to #373 and #377. | agent | P0 | #380 filed; receipt in #373 |
| Submission list empty state | Explain what this list contains | “Feral Reports” / “No reports yet” conflicts with the glossary; an in-progress draft can also appear here; 5/2/5/5/2/1 = **20/60**. Simplicity is weak. | If Phase 9 keeps the list, title it “Sightings” and explain that it includes both drafts and submitted sightings. | user | P3 | #380 filed; tab decision pending |

The data-use copy in `src/config/introFlowCopy.ts` is a claim review, not evidence that downstream groups currently use the data. The upload path supports a narrower statement: after photo upload, `uploadSubmissionMetadata` completes before the local draft is marked Submitted. Validation with real users remains pending.
