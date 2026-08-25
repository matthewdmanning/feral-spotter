/**
 * hooks/useRemoveCat.ts
 *
 * The one owner of removing a *saved* cat (#299).
 *
 * A user who boxes the wrong animal, double-counts one cat across two
 * passes, or simply changes their mind previously had no recourse short of
 * Reset — which throws away the entire submission. This is the routine
 * correction Reset was standing in for.
 *
 * Two call sites reach this (both confirmed, per the 2026-08-24 product
 * decision): the trash control on each Cat List row, and "Remove this Cat"
 * on the Cat Form while editing a saved cat. They share this hook rather
 * than each doing the teardown themselves — the same mistake #292 fixed for
 * whole-draft teardown, where every caller re-enumerated the stores by hand
 * and each one forgot something different.
 *
 * Deliberately NOT behind `lib/submission/draft.ts`'s seam: that module
 * owns whole-draft teardown. Here the draft survives and one cat does not.
 *
 * Photos are never removed. The photo pool is submission-scoped rather than
 * cat-scoped (ADR-0004) and a single photo can show more than one cat, so
 * removing a cat must not remove images another cat is boxed on — the same
 * reasoning `removeBoxesForPhoto` follows in the other direction.
 */

import { clearActiveCatIfMatches } from '@/src/hooks/useActiveCatFlow'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { useCallback } from 'react'
import { Alert } from 'react-native'

export function useRemoveCat(): (
  catId: string,
  onRemoved?: () => void,
) => void {
  const removeCat = useSubmissionStore((s) => s.removeCat)
  const clearForCat = useBoundingBoxStore((s) => s.clearForCat)

  return useCallback(
    (catId: string, onRemoved?: () => void) => {
      Alert.alert(
        'Remove this cat?',
        'This removes the cat and the boxes you drew for it. Your photos are not deleted, and your other cats are not affected.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              clearForCat(catId)
              removeCat(catId)
              // If the removed cat happened to be the in-progress one,
              // leaving its id set would let the next "Add a Cat" resume a cat
              // that no longer exists — the same stale-id defect #304 fixed on
              // the abandon path. useActiveCatFlow owns that id and reads it
              // fresh; this hook does not touch its store directly.
              clearActiveCatIfMatches(catId)
              onRemoved?.()
            },
          },
        ],
      )
    },
    [clearForCat, removeCat],
  )
}
