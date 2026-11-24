/**
 * features/draft-submission/hooks/useCatForm.ts
 * Manages the 8 cat observation fields.
 * No store, API, or navigation dependencies — pure form state.
 */

import { commonCopy, submissionCopy } from '@/src/shared/config/text'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import type { ObservedCat } from '@/src/shared/hooks/useSubmissionStore'
import type {
  CatAge,
  CatColor,
  CatPattern,
  CatSex,
  EarTipped,
  HairLength,
  HealthLabel,
  Owned,
} from '@/src/shared/types'
import { CAT_ATTRIBUTES } from '@/src/features/draft-submission/lib/attributes'
import { useCallback, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatFormValues {
  age: CatAge | undefined
  earTipped: EarTipped | undefined
  owned: Owned | undefined
  pattern: CatPattern | undefined
  hairLength: HairLength | undefined
  color: CatColor | undefined
  sex: CatSex | undefined
  healthLabel: HealthLabel | undefined
}

export interface CatFormActions {
  setField: <K extends keyof CatFormValues>(
    key: K,
    value: CatFormValues[K],
  ) => void
  handleClear: () => void // shows confirmation Alert, then resets
}

const UNSET: CatFormValues = {
  age: undefined,
  earTipped: undefined,
  owned: undefined,
  pattern: undefined,
  hairLength: undefined,
  color: undefined,
  sex: undefined,
  healthLabel: undefined,
}

/** The saved cat's values under their form keys, from the attribute table. */
function valuesOf(cat: ObservedCat | undefined): CatFormValues {
  if (!cat) return UNSET
  return Object.fromEntries(
    CAT_ATTRIBUTES.map((a) => [a.key, cat[a.backendKey]]),
  ) as unknown as CatFormValues
}

/** Not one of the 8 attributes: which boxed photo is the Profile Pic. */
export interface CatProfilePic {
  /** Undefined: the first box stands in (lib/submission/profilePhoto.ts). */
  profilePhotoId: string | undefined
  setProfilePhotoId: (photoLocalId: string) => void
}

export type CatForm = CatFormValues & CatFormActions & CatProfilePic

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCatForm(existingCat?: ObservedCat): CatForm {
  // A fresh cat starts with no category selected (#205) — CAT_DEFAULTS is
  // only the fallback substituted at save time for fields left unset, not an
  // initial selection.
  const [values, setValues] = useState<CatFormValues>(() =>
    valuesOf(existingCat),
  )
  const setField = useCallback(
    <K extends keyof CatFormValues>(key: K, value: CatFormValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: value })),
    [],
  )
  const [profilePhotoId, setProfilePhotoId] = useState<string | undefined>(
    existingCat?.profile_photo_local_id,
  )
  // Clear resets the 8 attributes only — the Profile Pic is a photo
  // choice, not an answer about the cat.
  const handleClear = useCallback(() => {
    showAlert(submissionCopy.cat.clearTitle, submissionCopy.cat.clearMessage, [
      { text: commonCopy.cancel, style: 'cancel' },
      {
        text: commonCopy.clear,
        style: 'destructive',
        onPress: () => setValues(UNSET),
      },
    ])
  }, [])

  return {
    ...values,
    setField,
    handleClear,
    profilePhotoId,
    setProfilePhotoId,
  }
}
