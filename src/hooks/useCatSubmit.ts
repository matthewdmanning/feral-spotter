/**
 * hooks/useCatSubmit.ts
 * Handles the save action for the cat observation screen. Owns the store
 * mutation and navigation for it — final submission ("Done") moved to
 * Submission Details (useSubmissionSubmit.ts, #130); Reset moved there too
 * (#153), since it clears the whole submission, not just this cat.
 *
 * Under the annotate-first flow (ADR 0004), a new cat's id was already
 * minted by useActiveCatFlow when its first box was confirmed — this hook
 * reuses it rather than minting its own, and clears it on save since the
 * cat is no longer "in-progress."
 */

import { useSubmissionStore } from '@/src/hooks'
import { useActiveCatFlow } from '@/src/hooks/useActiveCatFlow'
import type { CatFormValues } from '@/src/hooks/useCatForm'
import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
import { CAT_DEFAULTS } from '@/src/screens/submission/cats/constants'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { useCallback } from 'react'
import { Alert } from 'react-native'

// ─── Missing-field warning (#152) ──────────────────────────────────────────

// "Unknown"/"Unsure" is a real value (docs/agents/domain.md), so this warns
// rather than blocks — a field deliberately left at its default looks
// identical to one the user never touched, and that's accepted (#152).
const FIELD_LABELS: Record<keyof typeof CAT_DEFAULTS, string> = {
  age: 'Age',
  earTipped: 'Ear Tipped',
  owned: 'Owned / Domesticated',
  pattern: 'Pattern',
  hairLength: 'Hair Length',
  color: 'Color',
  sex: 'Sex',
  healthLabel: 'Health',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCatSubmitParams {
  form: CatFormValues
  existingCat?: ObservedCat
  annotationEnabled: boolean
}

export interface CatSubmitResult {
  handleSave: () => void
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
  const { activeCatId, clearActiveCat } = useActiveCatFlow()

  // ── Build ObservedCat from current form values ─────────────────────────────

  const buildCat = useCallback(
    (localId: string): ObservedCat => ({
      local_id: localId,
      age: form.age,
      ear_tipped: form.earTipped,
      health_label: form.healthLabel,
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

  // ── Save → warn on unset fields → store + navigate ─────────────────────────

  const handleSave = useCallback(() => {
    // Annotate now runs before Cat Form (ADR 0004) — a new cat's id was
    // already minted there on its first confirmed box; reuse it instead of
    // minting a second one.
    const localId = existingCat?.local_id ?? activeCatId ?? randomUUID()
    const cat = buildCat(localId)

    const commit = () => {
      if (existingCat) updateCat(localId, cat)
      else addCat(cat)

      // The cat is saved, not "in-progress" anymore — a later "Add a Cat"
      // must mint a fresh id, not resume this one.
      clearActiveCat()
      router.back()
    }

    const unsetFields = (
      Object.keys(CAT_DEFAULTS) as (keyof typeof CAT_DEFAULTS)[]
    )
      .filter((field) => form[field] === CAT_DEFAULTS[field])
      .map((field) => FIELD_LABELS[field])

    if (unsetFields.length > 0) {
      Alert.alert(
        `${unsetFields.length} field${unsetFields.length !== 1 ? 's' : ''} not set`,
        `${unsetFields.join(', ')} — Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', style: 'default', onPress: commit },
        ],
      )
    } else {
      commit()
    }
  }, [
    buildCat,
    existingCat,
    addCat,
    updateCat,
    activeCatId,
    clearActiveCat,
    form,
  ])

  // ── Derived ───────────────────────────────────────────────────────────────

  const saveLabel =
    annotationEnabled && form.photoIds.length > 0
      ? 'Put the Cat in a Box'
      : 'Save Observation'

  return { handleSave, saveLabel }
}
