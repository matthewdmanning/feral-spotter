/**
 * Serializes remote mutations for one Submission photo slot. Uploads and
 * deletes share this tail so a canceled transfer cannot overwrite a later
 * replacement or have its cleanup delete that replacement.
 */

const tails = new Map<string, Promise<void>>()

export interface PhotoSlotReservation {
  ready: boolean
  wait: Promise<void>
  release: () => void
}

/** Use this function to reserve one uid/submission/slot for an upload or delete. */
export function reservePhotoSlot(key: string): PhotoSlotReservation {
  const previousTail = tails.get(key)
  const previous = previousTail ?? Promise.resolve()
  let resolveTurn!: () => void
  let released = false
  const turn = new Promise<void>((resolve) => {
    resolveTurn = resolve
  })
  const chain = previous.catch(() => {}).then(() => turn)
  tails.set(key, chain)
  void chain.finally(() => {
    if (tails.get(key) === chain) tails.delete(key)
  })

  return {
    ready: previousTail == null,
    wait: previous.catch(() => {}),
    release: () => {
      if (released) return
      released = true
      resolveTurn()
    },
  }
}
