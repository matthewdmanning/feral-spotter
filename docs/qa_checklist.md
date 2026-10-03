# Android MVP QA checklist

## Run info

- Tester:
- Date:
- Device / OS version:
- App build / commit:
- Overall result: PASS / FAIL / BLOCKED

## Launch (A)

- [ ] A1. Launch app, sign in (Google or email — Firebase Auth)
- [ ] A2. Consent screen (camera + location permission gate) shown before first use

## Home (B)

- [ ] B1. "Take a Photo" opens Camera
- [ ] B2. "Choose from Library" opens the system photo picker
- [ ] B3. "Continue Observation" appears only when an in-progress, non-stale draft exists, and returns to the Cat List

## Camera (C)

- [ ] C1. Grant camera permission -> camera opens
- [ ] C2. Deny camera permission -> blocked/error state shown, not a crash
- [ ] C3. Capture photo(s); cycle flash (auto/on/off); flip front/back camera
- [ ] C4. Cancel/close camera without capturing -> no photo added
- [ ] C5. Repeated shutter presses don't re-trigger the gallery-save permission prompt

## Library picker (D)

- [ ] D1. Grant media permission -> picker opens
- [ ] D2. Deny permission -> blocked/error state shown
- [ ] D3. Select one photo, and multiple photos in one pick
- [ ] D4. An EXIF-less photo (e.g. a screenshot) falls back to manual time entry later, not a silent "now" default

## Annotate (per cat) (E)

- [ ] E1. First box confirmed on a photo declares a new cat; boxing on further photos with no active cat starts the next one (via "Add a Cat")
- [ ] E2. Framing gesture: pinch/pan/double-tap the photo under the fixed center crosshair, long-press (or Confirm) to lock the box in
- [ ] E3. "Not in this photo" — swipe-up flick or the explicit pill button — skips the photo without boxing, advances to the next
- [ ] E4. "Boxing Complete" with zero boxes drawn abandons the pass and returns to Home; does not save an empty cat
- [ ] E5. Going back to an already-boxed photo restores the same crop-frame position
- [ ] E6. Removing a photo mid-pass sweeps that photo's box(es) for the active cat, no orphaned data left behind
- [ ] E7. Hardware back mid-pass abandons the current cat (already-drawn boxes are not cleaned up — by design)

## Cat List (F)

- [ ] F1. Zero cats recorded -> skips straight into annotate automatically, no tap required
- [ ] F2. One or more cats recorded -> renders normally; "Add a Cat" explicitly re-enters annotate
- [ ] F3. Tapping an existing cat row opens Cat Form directly

## Cat Form (G)

- [ ] G1. Static crop of the cat's first box shown at top (no manual photo re-selection)
- [ ] G2. All 8 fields (age, sex, ear-tipped, owned/domesticated, pattern, hair length, color, health) are optional selectors
- [ ] G3. Save always succeeds; unset fields are listed as a warning, never block Save
- [ ] G4. Editing an existing cat's fields persists
- [ ] G5. Clear wipes all fields, after a confirm prompt
- [ ] G6. Save routes back to Cat List

## Submission Details (H)

- [ ] H1. Location was captured automatically back at Camera/Library open — verify it (or a staleness flag) is present here
- [ ] H2. Manual-time entry button appears only when a photo lacked EXIF timestamp
- [ ] H3. Submit shows a confirm dialog with cat/photo counts
- [ ] H4. Reset clears the entire draft (cats, photos, submission fields), after a confirm prompt

## Save / recovery (I)

- [ ] I1. Full flow: Camera or Library -> annotate -> Cat Form -> Submission Details -> Submit
- [ ] I2. Background/kill the app mid-flow and resume -> in-progress draft persists locally
- [ ] I3. After a successful Submit, starting a new sighting begins a fresh draft, not the just-submitted one
- [ ] I4. Repeated Submit taps don't create duplicate local drafts or duplicate server submissions

## Network (J)

- [ ] J1. Submit with normal connectivity succeeds
- [ ] J2. Submit with no connectivity fails gracefully: error alert shown, draft kept locally as "Failed", not lost
- [ ] J3. Toggle airplane mode mid-upload or mid-Submit -> no partial/corrupt local draft state
- [ ] J4. Re-tapping Submit after a "Failed" status doesn't double-submit or duplicate the draft
- [ ] J5. No automatic retry/backoff exists yet — confirm that's expected, not a regression

## Device / system (K)

- [ ] K1. Low-memory conditions during a full capture -> annotate -> submit pass
- [ ] K2. Low-storage device: camera capture / gallery-save failure paths
- [ ] K3. Incoming call or notification mid-flow doesn't lose in-progress state
- [ ] K4. App restart after device reboot: in-progress local draft still present

## Issues found

| Code (e.g. C3) | Pass/Fail | Date/Time | Notes | Tester |
|----------------|-----------|----------------|-------|
| | | | |
