/**
 * hooks/useCatSubmit.ts
 * Handles save and reset actions for the cat observation screen. Owns all
 * store mutations and navigation for those two — final submission ("Done")
 * moved to Submission Details (useSubmissionSubmit.ts, #130).
 */

import { usePhotoStore, useSubmissionStore } from '@/src/hooks'
import type { CatFormValues } from '@/src/hooks/useCatForm'
import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
import {
  deleteSubmissionCache,
  getCurrentCacheId,
} from '@/src/lib/cache/submissionCache'
import { stopLocationCapture } from '@/src/lib/location'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { useCallback } from 'react'
import { Alert } from 'react-native'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCatSubmitParams {
  form: CatFormValues
  existingCat?: ObservedCat
  annotationEnabled: boolean
}

export interface CatSubmitResult {
  handleSave: () => void
  handleReset: () => void
  saveLabel: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCatSubmit({
  form,
  existingCat,
  annotationEnabled,
}: UseCatSubmitParams): CatSubmitResult {
  const addCat = useSubmissionStore((s) => s.addCat)
  const updateCat = useSubmissionStore((s) => s.updateCat)
  const clearDraft = useSubmissionStore((s) => s.clearDraft)

  const clearPhotos = usePhotoStore((s) => s.clearPhotos)

  // ── Build ObservedCat from current form values ─────────────────────────────

  const buildCat = useCallback(
    (localId: string): ObservedCat => ({
      local_id: localId,
      age: form.age,
      ear_tipped: form.earTipped,
      health: form.health,
      owned_domesticated: form.owned,
      pattern: form.pattern,
      hair_length: form.hairLength,
      color: form.color,
      sex: form.sex,
      photo_local_ids: form.photoIds,
      photos_reviewed: existingCat?.photos_reviewed ?? false,
    }),
    [form, existingCat],
  )

  // ── Save → store + navigate ────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const localId = existingCat?.local_id ?? randomUUID()
    const cat = buildCat(localId)

    if (existingCat) updateCat(localId, cat)
    else addCat(cat)

    if (annotationEnabled && form.photoIds.length > 0) {
      router.replace({
        pathname: '/submission/annotate',
        params: { cat_id: localId },
      })
    } else {
      router.back()
    }
  }, [
    buildCat,
    existingCat,
    addCat,
    updateCat,
    annotationEnabled,
    form.photoIds.length,
  ])

  // ── Reset → confirm → clear all ──────────────────────────────────────────

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Submission',
      'This will permanently clear all cats, photos and submission data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const cId = await getCurrentCacheId()
            if (cId) await deleteSubmissionCache(cId)
            clearDraft()
            clearPhotos()
            stopLocationCapture()
            router.replace('/')
          },
        },
      ],
    )
  }, [clearDraft, clearPhotos])

  // ── Derived ───────────────────────────────────────────────────────────────

  const saveLabel =
    annotationEnabled && form.photoIds.length > 0
      ? 'Put the Cat in a Box'
      : 'Save Observation'

  return { handleSave, handleReset, saveLabel }
}
