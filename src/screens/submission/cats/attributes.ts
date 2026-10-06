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

/**
 * Every attribute of a saved cat as label and display value, in form order.
 * A default ("Unknown"/"Unsure") is a real value (docs/agents/domain.md), so
 * it is listed like any other: some defaults are not selectable options (Age,
 * Hair Length, Color and Health have no Unknown button), so a value with no
 * matching option is shown by its own name, capitalized. A field the saved
 * cat lacks (a draft from before the field existed) reads as its default.
 */
export function describeCat(
  cat: ObservedCat,
): { label: string; value: string }[] {
  return CAT_ATTRIBUTES.map(({ label, backendKey, options, default: dflt }) => {
    const raw = (cat[backendKey] as string | undefined) ?? dflt
    const option = (options as readonly AttributeOption<string>[]).find(
      (o) => o.value === raw,
    )
    return {
      label,
      value: option?.label ?? raw.charAt(0).toUpperCase() + raw.slice(1),
    }
  })
}

const SUMMARY_FIELD_COUNT = 3
const NOTHING_TO_SUMMARIZE = 'No details recorded'

/** Unknown and Unsure say nothing about the cat, so a summary skips them. */
const isKnown = (value: string | undefined): value is string =>
  value !== undefined && value !== 'unknown' && value !== 'unsure'

const labelOf = (key: keyof ObservedCat, value: string): string =>
  (
    CAT_ATTRIBUTES.find((a) => a.backendKey === key)?.options as
      readonly AttributeOption<string>[] | undefined
  )
    ?.find((o) => o.value === value)
    ?.label.toLowerCase() ?? value

/**
 * The preference order of the one-line summary on Submission Details, as
 * phrases that read alone: "Yes" means nothing in a title, "ear tipped" does.
 * Pattern and Color share one slot ("cream tabby"), so a cat with both
 * still has room for two more fields. A field that is Unknown or Unsure gives
 * no phrase and the next field takes its place.
 */
const SUMMARY_PHRASES: ((cat: ObservedCat) => string | null)[] = [
  ({ age }) => (isKnown(age) ? labelOf('age', age) : null),
  ({ color, pattern }) => {
    const parts = [
      isKnown(color) ? labelOf('color', color) : null,
      isKnown(pattern) ? labelOf('pattern', pattern) : null,
    ].filter((p) => p !== null)
    return parts.length ? parts.join(' ') : null
  },
  ({ hair_length }) =>
    isKnown(hair_length) ? `${labelOf('hair_length', hair_length)} hair` : null,
  ({ sex }) => (isKnown(sex) ? labelOf('sex', sex) : null),
  ({ ear_tipped }) =>
    isKnown(ear_tipped)
      ? ear_tipped === 'yes'
        ? 'ear tipped'
        : 'not ear tipped'
      : null,
  ({ owned_domesticated }) =>
    isKnown(owned_domesticated)
      ? owned_domesticated === 'yes'
        ? 'domesticated'
        : 'not domesticated'
      : null,
  ({ health_label }) =>
    isKnown(health_label)
      ? `${labelOf('health_label', health_label)} health`
      : null,
]

/** The cat's one-line title: its first three known fields, in preference order. */
export function summarizeCat(cat: ObservedCat): string {
  const phrases = SUMMARY_PHRASES.map((phrase) => phrase(cat))
    .filter((p): p is string => p !== null)
    .slice(0, SUMMARY_FIELD_COUNT)
  if (!phrases.length) return NOTHING_TO_SUMMARIZE
  const summary = phrases.join(' · ')
  return summary.charAt(0).toUpperCase() + summary.slice(1)
}

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
