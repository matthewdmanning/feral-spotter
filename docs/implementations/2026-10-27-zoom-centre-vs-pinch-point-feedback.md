# UX note: zoom on the centre vs zoom on the pinch point

Purpose: guide the reading of future user feedback on camera zoom.
This note is not a design decision. It records an open question.

## Current behavior (Android, Pinch to Zoom)

- Pinch zooms the preview about the centre of the preview.
- The preview does not pan. One finger does not drag it.
- A label shows the zoom multiplier, such as "2.3×", while zoomed in.
- The saved photo stays full field. Only the preview is magnified.
- Tap-to-focus maps the tap back through the zoom.

## What was removed, and why

- Removed: zoom about the pinch point, and one-finger pan.
- Removed: the zoom window diagram (a box inside an outline of the preview).
- Reason given in the test drive of 2026-10-27: the diagram had low usefulness.
  The multiplier label replaces it.

## Open question for user feedback

Do users expect the zoom to follow the pinch point?

- Zoom on the centre: simple. The subject must be in the middle of the frame.
- Zoom on the pinch point: the user can zoom into an off-centre cat without
  moving the phone. It needs pan, or the view drifts.

## Feedback that would reopen this

| What users say                                            | What it suggests                                            |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| "The cat leaves the screen when I zoom."                  | Add zoom on the pinch point and pan.                        |
| "I cannot zoom into a cat at the edge."                   | Add zoom on the pinch point and pan.                        |
| "I do not know how far I zoomed."                         | The multiplier label is not clear enough.                   |
| "I zoom, then I cannot tell what the photo will contain." | Show the saved-photo frame. The photo is always full field. |
| No zoom feedback at all                                   | Keep centre zoom.                                           |

## What the code can tell us

- `pinch_ended` diagnostics report the final `view_zoom` scale.
- They exist only when Camera Performance Checks is on.
- No event records pan, because pan no longer exists.
