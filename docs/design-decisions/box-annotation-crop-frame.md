# Box Annotation Crop Frame Design Decision

## Context

- Box Annotation ("Box the Cat") crop frame — the center-anchored crosshair/box the user reshapes to draw a bounding box around a cat on the annotate screen (`useBoundingBoxFrame`).
- Edge handles — the four draggable controls (left, right, top, bottom) that reshape the crop frame's width or height independently.
- Center dot / Confirm control — long-press the center dot or tap Confirm to save the current frame and advance; unaffected by this decision.
- Carousel swipe navigation — the horizontal swipe gesture for moving between photos on the annotate screen.
- Hardware back button — the device back button/gesture, indistinguishable at the JS event level from an edge-swipe.
- "Done With This Cat" button — the control that ends the current cat's annotation pass; falls back to the abandon-pass flow itself when there's no active cat or no confirmed boxes yet.

## Design Specifications

- Default crop frame shape: a square, sized to a fraction of the shorter canvas axis. The user may reshape it afterward.
- Resize handles: one per edge (left, right, top, bottom). Dragging a handle changes only its own axis (half-width for left/right, half-height for top/bottom); the opposite edge mirrors automatically because the frame stays center-anchored.
- Handle position: inset from the box edge, sitting on the crosshair line inside the box — not straddling the border.
- Aspect ratio limit: neither axis may exceed a fixed ratio relative to the other (currently 3:1 in either direction).
- Resize bound: the frame cannot grow past the photo's own on-screen extent at the current zoom level.
- Photo gestures (pinch, pan, double-tap) reposition and zoom the photo underneath the frame, independent of handle drags — unchanged by the frame's resizability.
- The annotate screen's carousel does not respond to horizontal swipe. Moving between photos happens only through the Previous button and automatic advance on Confirm / Not in Photo.
- The hardware back button does not exit the annotation pass. It is swallowed entirely; "Done With This Cat" is the only way to leave.

## Reason

- Square-only forced a bad fit for tall or wide cat poses; independent width/height lets the frame match the subject.
- Center-anchored, mirrored resize keeps the frame's center fixed on the crosshair the user is already aligning with the subject — a non-mirrored resize would drift the frame off-target with every drag.
- Handles sit on the crosshairs rather than the border because, at the edge, they were easy to trigger by accident alongside the carousel's swipe gesture and harder to grab precisely. The crosshair is a fixed, predictable landmark regardless of the frame's current size.
- The aspect ratio cap prevents a degenerate sliver-thin frame that would be useless as a crop region.
- Carousel swipe was disabled because it competed with handle-drag and pinch-zoom for the same touch input, causing accidental photo changes mid-resize. Navigation is already fully covered by the Previous button and confirm-driven auto-advance, so the swipe gesture added risk without adding capability.
- The hardware back button is swallowed, rather than exiting the pass, because it fires the same JS event as an edge-swipe and the two can't be told apart — allowing one would allow the other. "Done With This Cat" already covers every exit case the back button would have, so blocking it costs no capability while removing an accidental-exit risk mid-pass.
