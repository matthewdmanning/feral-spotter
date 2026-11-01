/**
 * hooks/useActiveCatFlow.ts
 *
 * Cross-screen active-cat flow (ADR 0004): owns which cat is currently being
 * discovered across an annotate pass, so it survives the annotate -> Cat Form
 * navigation (and an app background/restart mid-pass, via the persisted
 * useActiveCatFlowStore). Per-photo pass status is derived from
 * useBoundingBoxStore rather than duplicated here.
 */

import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { useActiveCatFlowStore } from '@/src/hooks/useActiveCatFlowStore'
import type { BoundingBox } from '@/src/shared/types/BoundingBox'
import { randomUUID } from 'expo-crypto'
import { abandonCatPass, finishBoxing } from '@/src/hooks/catPass'
import { useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BoxInput = Omit<BoundingBox, 'id' | 'cat_id' | 'photo_local_id'>

export type PhotoPassStatus = 'pending' | 'located' | 'not-in-photo'

export interface ActiveCatFlow {
  activeCatId: string | null
  getPhotoStatus: (photoId: string) => PhotoPassStatus
  handleBoxConfirmed: (photoId: string, box: BoxInput) => void
  handleNotInPhoto: (photoId: string) => void
  handleBoxingComplete: () => void
  clearActiveCat: () => void
  handleAbandonPass: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// The in-progress cat's id and every navigation of the pass live in
// hooks/catPass.ts; re-exported here for existing callers.
export { clearActiveCatIfMatches, startFreshPass } from '@/src/hooks/catPass'

/** The pass's cat, minting and storing one on the pass's first mark. */
function currentOrNewCatId(setActiveCatId: (id: string) => void): string {
  const current = useActiveCatFlowStore.getState().activeCatId
  if (current) return current
  const minted = randomUUID()
  setActiveCatId(minted)
  return minted
}

export function useActiveCatFlow(): ActiveCatFlow {
  const activeCatId = useActiveCatFlowStore((s) => s.activeCatId)
  const setActiveCatId = useActiveCatFlowStore((s) => s.setActiveCatId)
  const addBox = useBoundingBoxStore((s) => s.addBox)
  const markAbsent = useBoundingBoxStore((s) => s.markAbsent)
  const getBoxedPhotoIds = useBoundingBoxStore((s) => s.getBoxedPhotoIds)
  // Subscribed directly (not via the stable getBoxes function ref) so a
  // confirmed box re-renders callers, e.g. the dots strip.
  const boxes = useBoundingBoxStore((s) => s.boxes)
  const absences = useBoundingBoxStore((s) => s.absences)

  const getPhotoStatus = useCallback(
    (photoId: string): PhotoPassStatus => {
      if (!activeCatId) return 'pending'
      const key = `${activeCatId}:${photoId}`
      if ((boxes[key]?.length ?? 0) > 0) return 'located'
      if (absences[key]) return 'not-in-photo'
      return 'pending'
    },
    [activeCatId, boxes, absences],
  )

  // First confirmed box of a pass with no active cat declares a new one.
  // Reads activeCatId fresh, like handleBoxingComplete below: two events
  // before a re-render would otherwise each see `null` and mint two cats.
  const handleBoxConfirmed = useCallback(
    (photoId: string, box: BoxInput) => {
      addBox(currentOrNewCatId(setActiveCatId), photoId, box)
    },
    [setActiveCatId, addBox],
  )

  // Mirrors handleBoxConfirmed's lazy mint (#203): the very first photo of a
  // pass has no cat yet either way, so "not in photo" must be able to start
  // the pass too, not just a confirmed box — otherwise the affordance is
  // unusable on photo 1 specifically (the button was previously disabled
  // until activeCatId existed, which a box, not an absence mark, produced).
  const handleNotInPhoto = useCallback(
    (photoId: string) => {
      markAbsent(currentOrNewCatId(setActiveCatId), photoId)
    },
    [setActiveCatId, markAbsent],
  )

  // Clears whichever cat is in-progress, no navigation. Used by a completed
  // Cat Form save (useCatSubmit navigates itself, to Cat List) — the cat is
  // no longer "in-progress," it's saved.
  const clearActiveCat = useCallback(() => {
    setActiveCatId(null)
  }, [setActiveCatId])

  // Leaving Annotate before Cat Form: see abandonCatPass (hooks/catPass.ts)
  // for the destination rule and the cleanup.
  const handleAbandonPass = useCallback(() => abandonCatPass(), [])

  // Callable at any point in the pass. Gated on an actual box, not just
  // activeCatId (#203): handleNotInPhoto now mints a catId too (so the
  // affordance works on photo 1), so activeCatId alone no longer implies
  // "this cat has photo evidence." Routes through handleAbandonPass rather
  // than router.back() for a photo-evidence-free pass — same Camera-leak
  // risk on the first cat of a submission as the hardware-back case, since
  // it's the identical Camera -> Annotate replace-chain stack.
  //
  // Reads activeCatId fresh rather than using the subscribed value: the
  // pass's first box mints the cat and lands here in the same tick, so the
  // closure still holds the pre-mint `null`. On a one-photo submission that
  // is the only tick there is — confirming the single box abandoned the pass
  // to Home instead of opening Cat Form, leaving the draft behind with no
  // sign anything went wrong. Two photos hid it, since advancing the carousel
  // let the state settle across a render. getBoxedPhotoIds already reads
  // through get(), so only this one value was stale.
  const handleBoxingComplete = useCallback(() => {
    const catId = useActiveCatFlowStore.getState().activeCatId
    if (!catId || getBoxedPhotoIds(catId).length === 0) {
      handleAbandonPass()
      return
    }
    finishBoxing()
  }, [getBoxedPhotoIds, handleAbandonPass])

  return {
    activeCatId,
    getPhotoStatus,
    handleBoxConfirmed,
    handleNotInPhoto,
    handleBoxingComplete,
    clearActiveCat,
    handleAbandonPass,
  }
}
