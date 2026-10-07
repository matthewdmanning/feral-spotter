/**
 * lib/annotate/catColors.ts
 *
 * Picks the palette slot for a new cat. Pure: the store owns the state.
 *
 * A cat keeps its slot until it is removed, so no other cat's removal ever
 * recolors it. A removed cat's slot is free again, but only once every slot
 * has been handed out at least once: unused slots go first.
 */

/**
 * @param uses how many times each slot has ever been assigned (index = slot)
 * @param held slots owned by cats that still exist
 */
export function pickCatColorSlot(uses: number[], held: number[]): number {
  const slots = uses.map((_, slot) => slot)
  const free = slots.filter((slot) => !held.includes(slot))
  // Every slot is taken: share the least-shared one.
  const candidates = free.length > 0 ? free : slots
  const load = (slot: number) =>
    free.length > 0 ? uses[slot] : held.filter((h) => h === slot).length
  return candidates.reduce((best, slot) =>
    load(slot) < load(best) ? slot : best,
  )
}
