/**
 * screens/submission/cats/attributes.ts
 * Single source of truth for the 8 cat observation fields — the seam between
 * frontend form state (camelCase, CatFormValues) and the persisted shape
 * (snake_case, ObservedCat). CAT_DEFAULTS, FIELD_LABELS, the per-field option
 * lists, and the frontend<->backend key mapping all derive from this table;
 * previously each was declared separately across 6 files and drifted
 * (HairLength admitted an unreachable 'medium' value, #360).
 *
 * "Unknown"/"Unsure" is a real value (docs/agents/domain.md), not a
 * placeholder — but the doc's "no distinction from untouched" claim only
 * holds at this persisted layer. The frontend's untouched (`undefined`) vs.
 * deliberately-chosen-Unknown distinction (#205/#152) only has a selectable
 * button for 4 of these 8 fields (Pattern, Sex, Ear Tipped, Owned) — for the
 * other 4 (Age, Hair Length, Color, Health) there's no button path to choose
 * Unknown, so a persisted default can only mean "left untouched," and the
 * two layers agree by construction.
 */
import type { CatFormValues } from '@/src/hooks/useCatForm'
import type { ObservedCat } from '@/src/hooks/useSubmissionStore'

export interface AttributeOption<T extends string> {
  value: T
  label: string
}

interface AttributeConfig<
  K extends keyof CatFormValues,
  B extends keyof ObservedCat,
> {
  key: K
  backendKey: B
  label: string
  default: NonNullable<CatFormValues[K]>
  options: AttributeOption<NonNullable<CatFormValues[K]>>[]
}

// Identity function used only for per-entry literal-type inference — lets
// each entry's `options`/`default` narrow to that field's own type instead
// of widening to a union across all 8 fields.
function attribute<K extends keyof CatFormValues, B extends keyof ObservedCat>(
  config: AttributeConfig<K, B>,
): AttributeConfig<K, B> {
  return config
}

export const CAT_ATTRIBUTES = [
  attribute({
    key: 'age',
    backendKey: 'age',
    label: 'Age',
    default: 'unknown',
    options: [
      { value: 'kitten', label: 'Kitten' },
      { value: 'juvenile', label: 'Juvenile' },
      { value: 'adult', label: 'Adult' },
      { value: 'senior', label: 'Senior' },
    ],
  }),
  attribute({
    key: 'earTipped',
    backendKey: 'ear_tipped',
    label: 'Ear Tipped',
    default: 'unsure',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'unsure', label: 'Unsure' },
    ],
  }),
  attribute({
    key: 'owned',
    backendKey: 'owned_domesticated',
    label: 'Owned / Domesticated',
    default: 'unsure',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'unsure', label: 'Unsure' },
    ],
  }),
  attribute({
    key: 'pattern',
    backendKey: 'pattern',
    label: 'Pattern',
    default: 'unknown',
    options: [
      { value: 'solid', label: 'Solid' },
      { value: 'tabby', label: 'Tabby' },
      { value: 'calico', label: 'Calico' },
      { value: 'bicolor', label: 'Bicolor' },
      { value: 'tortoiseshell', label: 'Tortoiseshell' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  attribute({
    key: 'hairLength',
    backendKey: 'hair_length',
    label: 'Hair Length',
    default: 'unknown',
    options: [
      { value: 'short', label: 'Short' },
      { value: 'long', label: 'Long' },
    ],
  }),
  attribute({
    key: 'color',
    backendKey: 'color',
    label: 'Color',
    default: 'unknown',
    options: [
      { value: 'black', label: 'Black' },
      { value: 'white', label: 'White' },
      { value: 'orange', label: 'Orange' },
      { value: 'gray', label: 'Gray' },
      { value: 'brown', label: 'Brown' },
      { value: 'cream', label: 'Cream' },
      { value: 'mixed', label: 'Mixed' },
    ],
  }),
  attribute({
    key: 'sex',
    backendKey: 'sex',
    label: 'Sex',
    default: 'unknown',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  attribute({
    key: 'healthLabel',
    backendKey: 'health_label',
    label: 'Health',
    default: 'unknown',
    options: [
      { value: 'poor', label: 'Poor' },
      { value: 'fair', label: 'Fair' },
      { value: 'good', label: 'Good' },
    ],
  }),
] as const

type CatAttributesTuple = typeof CAT_ATTRIBUTES

export const CAT_DEFAULTS: {
  [A in CatAttributesTuple[number] as A['key']]: A['default']
} = Object.fromEntries(CAT_ATTRIBUTES.map((a) => [a.key, a.default])) as {
  [A in CatAttributesTuple[number] as A['key']]: A['default']
}

export const FIELD_LABELS: Record<keyof typeof CAT_DEFAULTS, string> =
  Object.fromEntries(CAT_ATTRIBUTES.map((a) => [a.key, a.label])) as Record<
    keyof typeof CAT_DEFAULTS,
    string
  >
