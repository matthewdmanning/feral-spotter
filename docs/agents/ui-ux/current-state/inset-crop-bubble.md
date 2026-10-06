---
topic: inset-crop-bubble
status: active
last_reviewed: 2026-08-08
governs:
  - src/components/organisms/InsetCropBubble.tsx
  - src/components/organisms/InsetCropBubble.styles.ts
  - src/screens/submission/cats/index.tsx
  - src/screens/submission/cats/index.styles.ts
  - src/screens/submission/annotate/index.tsx
derives_from: ['#168', '#174', '#186']
---

# Inset-Crop Bubble Design Decision

## Context

- Inset-crop bubble ("bubble" / `InsetCropBubble`) — a static per-cat photo crop, shown on the annotate screen and persisted onto the Cat Form.
- Cat Form title ("Observed Cat" title) — displayed at the top of Cat Form; must never be covered by the bubble.
- Cat Form header zone — the reserved space at the top of Cat Form the bubble occupies while expanded.

## Design Specifications

- Bubble shape: rounded square, fixed corner radius (`theme.radius.lg`, not proportional to bubble size). Same shape on both the annotate screen and Cat Form.
- Bubble expanded position:
  - Annotate screen: top-right.
  - Cat Form: top-center.
- Bubble collapse:
  - Direction: slides toward the right screen edge, both screens.
  - Size: shrinks to a flat 68dp collapsed diameter, regardless of expanded diameter, both screens.
- Cat Form title fade: fades only while the bubble is expanded and positioned over the title; un-fades once the bubble is collapsed and docked at the edge.
- Cat Form header-zone reservation (changed 2026-10-06, supersedes the live-tracking rule): fixed at the collapsed size. Expanding the bubble never shifts the form; an expanded bubble floats over the form's first rows and the user collapses it to clear them.

## Reason

- Rounded-square over circular: a circular bubble read as visually heavier than intended, and gave no clean way to signal the Cat Form title fading beneath it the way a squared-off edge does.
- Annotate top-right position: a bottom-of-screen bubble obscured screen controls; a top position clears them.
- Right-edge collapse slide and flat collapse size: consistent, predictable collapse behavior across both screens.
- Header-zone reservation that grows with the bubble (superseded 2026-10-06): the form jumped down whenever the bubble opened from its default spot. A fixed collapsed-size reservation avoids the jump.
- Drag (both screens): only the collapsed bubble drags. It moves up and down only and snaps to the right edge on release. An expanded bubble does not drag. Collapse and expand keep its height. The bubble border takes the cat's own color.
