/**
 * screens/submission/cats/constants.ts
 * Options arrays, default values, and pure utilities for the cat observation form.
 * No React imports — safe to import from hooks and non-component contexts.
 */

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

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CAT_DEFAULTS = {
  age: 'unknown' as CatAge,
  earTipped: 'unsure' as EarTipped,
  owned: 'unsure' as Owned,
  pattern: 'unknown' as CatPattern,
  hairLength: 'unknown' as HairLength,
  color: 'unknown' as CatColor,
  sex: 'unknown' as CatSex,
  healthLabel: 'unknown' as HealthLabel,
} as const

// ─── Options ──────────────────────────────────────────────────────────────────

export const AGE_OPTIONS: { value: CatAge; label: string }[] = [
  { value: 'kitten', label: 'Kitten' },
  { value: 'juvenile', label: 'Juvenile' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' },
]

export const EAR_TIPPED_OPTIONS: { value: EarTipped; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
]

export const OWNED_OPTIONS: { value: Owned; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
]

export const PATTERN_OPTIONS: { value: CatPattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'tabby', label: 'Tabby' },
  { value: 'calico', label: 'Calico' },
  { value: 'bicolor', label: 'Bicolor' },
  { value: 'tortoiseshell', label: 'Tortoiseshell' },
  { value: 'unknown', label: 'Unknown' },
]

export const HAIR_LENGTH_OPTIONS: { value: HairLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]

export const COLOR_OPTIONS: { value: CatColor; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'orange', label: 'Orange' },
  { value: 'gray', label: 'Gray' },
  { value: 'brown', label: 'Brown' },
  { value: 'cream', label: 'Cream' },
  { value: 'mixed', label: 'Mixed' },
]

// Pattern-specific color constraints aren't defined yet (pending a reference
// from Matthew) — pass-through today so CatForm already reads through this
// seam; only the mapping table changes once that reference lands.
export function colorOptionsForPattern(
  _pattern: CatPattern | undefined,
): { value: CatColor; label: string }[] {
  return COLOR_OPTIONS
}

export const SEX_OPTIONS: { value: CatSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
]

export const HEALTH_OPTIONS: { value: HealthLabel; label: string }[] = [
  { value: 'poor', label: 'Poor' },
  { value: 'fair', label: 'Fair' },
  { value: 'good', label: 'Good' },
]
