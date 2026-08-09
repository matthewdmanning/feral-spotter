/**
 * hooks/useCatForm.ts
 * Manages the 8 cat observation fields.
 * No store, API, or navigation dependencies — pure form state.
 */

import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
import type {
  CatAge,
  CatColor,
  CatPattern,
  CatSex,
  EarTipped,
  HairLength,
  HealthLabel,
  Owned,
} from '@/src/types'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

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
  setAge: (v: CatAge | undefined) => void
  setEarTipped: (v: EarTipped | undefined) => void
  setOwned: (v: Owned | undefined) => void
  setPattern: (v: CatPattern | undefined) => void
  setHairLength: (v: HairLength | undefined) => void
  setColor: (v: CatColor | undefined) => void
  setSex: (v: CatSex | undefined) => void
  setHealthLabel: (v: HealthLabel | undefined) => void
  handleClear: () => void // shows confirmation Alert, then resets
}

export type CatForm = CatFormValues & CatFormActions

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCatForm(existingCat?: ObservedCat): CatForm {
  // A fresh cat starts with no category selected (#205) — CAT_DEFAULTS is
  // only the fallback substituted at save time for fields left unset, not an
  // initial selection.
  const [age, setAge] = useState<CatAge | undefined>(
    existingCat?.age as CatAge | undefined,
  )
  const [earTipped, setEarTipped] = useState<EarTipped | undefined>(
    existingCat?.ear_tipped as EarTipped | undefined,
  )
  const [owned, setOwned] = useState<Owned | undefined>(
    existingCat?.owned_domesticated as Owned | undefined,
  )
  const [pattern, setPattern] = useState<CatPattern | undefined>(
    existingCat?.pattern as CatPattern | undefined,
  )
  const [hairLength, setHairLength] = useState<HairLength | undefined>(
    existingCat?.hair_length as HairLength | undefined,
  )
  const [color, setColor] = useState<CatColor | undefined>(
    existingCat?.color as CatColor | undefined,
  )
  const [sex, setSex] = useState<CatSex | undefined>(
    existingCat?.sex as CatSex | undefined,
  )
  const [healthLabel, setHealthLabel] = useState<HealthLabel | undefined>(
    existingCat?.health_label as HealthLabel | undefined,
  )
  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear form?',
      'All fields will be cleared. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setAge(undefined)
            setEarTipped(undefined)
            setOwned(undefined)
            setPattern(undefined)
            setHairLength(undefined)
            setColor(undefined)
            setSex(undefined)
            setHealthLabel(undefined)
          },
        },
      ],
    )
  }, [])

  return {
    age,
    earTipped,
    owned,
    pattern,
    hairLength,
    color,
    sex,
    healthLabel,
    setAge,
    setEarTipped,
    setOwned,
    setPattern,
    setHairLength,
    setColor,
    setSex,
    setHealthLabel,
    handleClear,
  }
}
