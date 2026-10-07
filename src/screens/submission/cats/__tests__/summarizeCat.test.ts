import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
import { summarizeCat } from '../attributes'

/**
 * The one-line title of a cat on Submission Details: the first three known
 * fields in a fixed preference order. A pure decision on inputs, so plain
 * cases. The failure worth catching is a skipped field leaving a gap, or an
 * Unknown/Unsure value taking a slot a known field should have had.
 */
const cat = (patch: Partial<ObservedCat> = {}): ObservedCat => ({
  local_id: 'c',
  age: 'unknown',
  ear_tipped: 'unsure',
  owned_domesticated: 'unsure',
  pattern: 'unknown',
  hair_length: 'unknown',
  color: 'unknown',
  sex: 'unknown',
  health_label: 'unknown',
  photo_local_ids: [],
  photos_reviewed: false,
  ...patch,
})

describe('summarizeCat', () => {
  it('takes the first three known fields in preference order', () => {
    expect(
      summarizeCat(
        cat({
          age: 'adult',
          pattern: 'tabby',
          color: 'orange',
          hair_length: 'short',
          sex: 'female',
          health_label: 'good',
        }),
      ),
    ).toBe('Adult · orange tabby · short hair')
  })

  it('lets the next field take the place of an Unknown or Unsure one', () => {
    expect(
      summarizeCat(
        cat({
          age: 'senior',
          sex: 'male',
          ear_tipped: 'yes',
          health_label: 'poor',
        }),
      ),
    ).toBe('Senior · male · ear tipped')
  })

  it('counts Pattern and Color as one slot, and shows whichever is known', () => {
    expect(summarizeCat(cat({ color: 'gray', hair_length: 'long' }))).toBe(
      'Gray · long hair',
    )
    expect(summarizeCat(cat({ pattern: 'calico', sex: 'female' }))).toBe(
      'Calico · female',
    )
  })

  it('words a No so it reads alone', () => {
    expect(
      summarizeCat(cat({ ear_tipped: 'no', owned_domesticated: 'no' })),
    ).toBe('Not ear tipped · not domesticated')
  })

  it('says so when nothing is known', () => {
    expect(summarizeCat(cat())).toBe('No details recorded')
  })
})
