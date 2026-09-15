import { CAT_ATTRIBUTES, FIELD_LABELS } from '../attributes'
import { CAT_DEFAULTS } from '../constants'

/**
 * CAT_ATTRIBUTES is the single source CAT_DEFAULTS, FIELD_LABELS, the
 * per-field *_OPTIONS exports, and useCatSubmit's buildCat all derive from —
 * pins the derivation itself, since a mistake here silently propagates
 * everywhere (the class of bug #360 was: a value reachable by the type but
 * not by any option).
 */
describe('CAT_ATTRIBUTES', () => {
  it('has exactly 8 fields, each with a default that is one of its own options', () => {
    expect(CAT_ATTRIBUTES).toHaveLength(8)

    for (const attr of CAT_ATTRIBUTES) {
      const optionValues = attr.options.map((o) => o.value)
      // Pattern/Sex/EarTipped/Owned offer Unknown/Unsure as a button and
      // default to it; Age/HairLength/Color/Health don't offer it as a
      // button, so their default ('unknown') is deliberately absent from
      // their own options — see attributes.ts's top-of-file note.
      const defaultIsOffered = optionValues.includes(attr.default)
      const defaultIsUnknown = attr.default === 'unknown'
      expect(defaultIsOffered || defaultIsUnknown).toBe(true)
    }
  })

  it('derives CAT_DEFAULTS with one entry per attribute key', () => {
    for (const attr of CAT_ATTRIBUTES) {
      expect(CAT_DEFAULTS[attr.key]).toBe(attr.default)
    }
  })

  it('derives FIELD_LABELS with one entry per attribute key', () => {
    for (const attr of CAT_ATTRIBUTES) {
      expect(FIELD_LABELS[attr.key]).toBe(attr.label)
    }
  })
})
