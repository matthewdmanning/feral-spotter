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
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActiveCatFlow(): ActiveCatFlow {
  const activeCatId = useActiveCatFlowStore((s) => s.activeCatId)
  const setActiveCatId = useActiveCatFlowStore((s) => s.setActiveCatId)
  const addBox = useBoundingBoxStore((s) => s.addBox)
  const markAbsent = useBoundingBoxStore((s) => s.markAbsent)
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

  // No cat has been declared yet (no box drawn this pass) — nothing to
  // record absence against. The UI is expected to disable the affordance
  // in that state; this guard is defense in depth.
  const handleNotInPhoto = useCallback(
    (photoId: string) => {
      if (!activeCatId) return
      markAbsent(activeCatId, photoId)
    },
    [activeCatId, markAbsent],
  )

  // Callable at any point in the pass. With no boxes drawn yet there is no
  // cat to describe, so treat it the same as abandoning.
  const handleBoxingComplete = useCallback(() => {
    if (!activeCatId) {
      router.back()
      return
    }
    router.replace('/submission/cats')
  }, [activeCatId])

  // Clears whichever cat is in-progress. Two call sites use this for
  // different reasons: leaving annotate before Cat Form (abandons the pass —
  // boxes already drawn stay in useBoundingBoxStore untouched, cleanup
  // deferred, a later "Add a Cat" mints a fresh cat rather than resuming
  // this one) and a completed Cat Form save (the cat is no longer
  // "in-progress," it's saved).
  const clearActiveCat = useCallback(() => {
    setActiveCatId(null)
  }, [setActiveCatId])

  return {
    activeCatId,
    getPhotoStatus,
    handleBoxConfirmed,
    handleNotInPhoto,
    handleBoxingComplete,
    clearActiveCat,
  }
}
