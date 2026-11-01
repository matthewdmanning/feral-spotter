/**
 * test-utils/catFixtures.ts
 * One saved cat for tests. Every attribute starts at its default, read from
 * CAT_ATTRIBUTES, so a new or renamed field can't leave the fixture stale.
 */

import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
import { CAT_ATTRIBUTES } from '@/src/lib/cats/attributes'

export function observedCat(patch: Partial<ObservedCat> = {}): ObservedCat {
  // Same mapping useCatSubmit applies at save time.
  const defaults = Object.fromEntries(
    CAT_ATTRIBUTES.map((a) => [a.backendKey, a.default]),
  ) as Pick<ObservedCat, (typeof CAT_ATTRIBUTES)[number]['backendKey']>
  return {
    local_id: 'cat-1',
    ...defaults,
    photo_local_ids: [],
    photos_reviewed: false,
    ...patch,
  }
}
