/**
 * screens/submission/cats/constants.ts
 * Options arrays, default values, and pure utilities for the cat observation
 * form — derived from attributes.ts's single per-field table. No React
 * imports — safe to import from hooks and non-component contexts.
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
} from '@/src/shared/types'
import { CAT_ATTRIBUTES, type AttributeOption } from '@/src/lib/cats/attributes'

export { CAT_DEFAULTS } from '@/src/lib/cats/attributes'

// ─── Options ──────────────────────────────────────────────────────────────────

function optionsFor<T extends string>(
  key: (typeof CAT_ATTRIBUTES)[number]['key'],
): AttributeOption<T>[] {
  const attr = CAT_ATTRIBUTES.find((a) => a.key === key)
  if (!attr) throw new Error(`Unknown cat attribute key: ${key}`)
  return attr.options as unknown as AttributeOption<T>[]
}

export const AGE_OPTIONS = optionsFor<CatAge>('age')
export const EAR_TIPPED_OPTIONS = optionsFor<EarTipped>('earTipped')
export const OWNED_OPTIONS = optionsFor<Owned>('owned')
export const PATTERN_OPTIONS = optionsFor<CatPattern>('pattern')
export const HAIR_LENGTH_OPTIONS = optionsFor<HairLength>('hairLength')
export const COLOR_OPTIONS = optionsFor<CatColor>('color')
export const SEX_OPTIONS = optionsFor<CatSex>('sex')
export const HEALTH_OPTIONS = optionsFor<HealthLabel>('healthLabel')

export { COAT_GROUPS } from '@/src/lib/cats/attributes'
