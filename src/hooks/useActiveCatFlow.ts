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
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import type { BoundingBox } from '@/src/types/BoundingBox'
import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
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

/**
 * Clears the in-progress cat, but only if it is the one named.
 *
 * Not a hook, and deliberately non-reactive: the caller fires this from an
 * Alert's confirm handler, where a value subscribed at render time may
 * already be stale by the time the user taps.
 *
 * Lives here rather than in the caller so `activeCatId` keeps one owner
 * (#292's rule) — reaching into `useActiveCatFlowStore` from elsewhere makes
 * that caller a second owner of the same state.
 */
export function clearActiveCatIfMatches(catId: string): void {
  const { activeCatId, setActiveCatId } = useActiveCatFlowStore.getState()
  if (activeCatId === catId) setActiveCatId(null)
}

export function useActiveCatFlow(): ActiveCatFlow {
  const activeCatId = useActiveCatFlowStore((s) => s.activeCatId)
  const setActiveCatId = useActiveCatFlowStore((s) => s.setActiveCatId)
  const addBox = useBoundingBoxStore((s) => s.addBox)
  const markAbsent = useBoundingBoxStore((s) => s.markAbsent)
  const getBoxedPhotoIds = useBoundingBoxStore((s) => s.getBoxedPhotoIds)
  const hasRecordedCats = useSubmissionStore((s) => s.cats.length > 0)
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
  const handleBoxConfirmed = useCallback(
    (photoId: string, box: BoxInput) => {
      const catId = activeCatId ?? randomUUID()
      if (!activeCatId) setActiveCatId(catId)
      addBox(catId, photoId, box)
    },
    [activeCatId, setActiveCatId, addBox],
  )

  // Mirrors handleBoxConfirmed's lazy mint (#203): the very first photo of a
  // pass has no cat yet either way, so "not in photo" must be able to start
  // the pass too, not just a confirmed box — otherwise the affordance is
  // unusable on photo 1 specifically (the button was previously disabled
  // until activeCatId existed, which a box, not an absence mark, produced).
  const handleNotInPhoto = useCallback(
    (photoId: string) => {
      const catId = activeCatId ?? randomUUID()
      if (!activeCatId) setActiveCatId(catId)
      markAbsent(catId, photoId)
    },
    [activeCatId, setActiveCatId, markAbsent],
  )

  // Clears whichever cat is in-progress, no navigation. Used by a completed
  // Cat Form save (useCatSubmit navigates itself, to Cat List) — the cat is
  // no longer "in-progress," it's saved.
  const clearActiveCat = useCallback(() => {
    setActiveCatId(null)
  }, [setActiveCatId])

  // Leaving Annotate before Cat Form (hardware back, or Boxing Complete on a
  // pass with no photo evidence — see handleBoxingComplete) — boxes already
  // drawn stay in useBoundingBoxStore untouched (cleanup deferred), a later
  // "Add a Cat" mints a fresh cat rather than resuming this one. Explicit
  // destination, not router.back() (#203): for the very first cat of a
  // submission Annotate sits directly on top of Camera (Cat List's
  // zero-cats auto-skip replaces itself with Annotate), so a plain pop
  // landed there.
  //
  // Destination depends on whether any cats are already recorded: with zero
  // cats, Cat List's own auto-skip effect would immediately replace itself
  // back into Annotate (a loop), so Home is the only safe landing. With at
  // least one cat already recorded, that risk doesn't exist — landing on
  // Home anyway would eject the user from a submission they were actively
  // building, so Cat List is correct there instead.
  const handleAbandonPass = useCallback(() => {
    setActiveCatId(null)
    router.replace(hasRecordedCats ? '/submission/create' : '/')
  }, [setActiveCatId, hasRecordedCats])

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
    router.replace('/submission/cats')
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
