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
- Cat Form header-zone reservation: shrinks in lockstep with the bubble's collapse animation, tracking the bubble's live position, so the header never holds more space than the bubble currently occupies. If tracking the live position proves impractical, the reservation may instead shrink only once the collapse animation completes and the bubble is fully clear of the title. On either path, the reservation must never shrink while the bubble could still overlap the title.

## Reason

- Rounded-square over circular: a circular bubble read as visually heavier than intended, and gave no clean way to signal the Cat Form title fading beneath it the way a squared-off edge does.
- Annotate top-right position: a bottom-of-screen bubble obscured screen controls; a top position clears them.
- Right-edge collapse slide and flat collapse size: consistent, predictable collapse behavior across both screens.
- Header-zone reservation resizing with collapse: a reservation pinned to the bubble's expanded size leaves dead, wasted space in the header once the bubble is collapsed. The never-shrink-while-overlapping constraint exists because a premature resize would let the bubble hide the title again.
