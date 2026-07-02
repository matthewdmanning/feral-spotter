# Build Quality Checks

## Manual verification needed

### Carousel scroll after photo removal (`useAnnotateStateMachine`)

When a photo is removed via long-press in the annotate screen, `currentIndex` is clamped to the new last index during render (via the `prevPhotosLength` pattern). The imperative `carouselRef.current?.scrollTo` call was removed because it was dead code — the condition was always false by the time the effect ran.

**Verify:** Remove a photo while viewing the last photo in the carousel. The carousel should visually snap to the new last photo without a stale blank frame.

**If broken:** Add `carouselRef.current?.scrollTo({ index: newLength - 1, animated: false })` directly inside `doRemove()` in `handleLongPressRemove` (`src/hooks/useAnnotateStateMachine.ts`), after the `setPhotoIds` call.
