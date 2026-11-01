/**
 * features/draft-submission/hooks/useRemoveCat.ts
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

import { showAlert } from '@/src/shared/hooks/useUIStore'
import { removeCatFromDraft } from '@/src/features/draft-submission/hooks/catPass'
import { useCallback } from 'react'

export function useRemoveCat(): (
  catId: string,
  onRemoved?: () => void,
) => void {
  return useCallback((catId: string, onRemoved?: () => void) => {
    showAlert(
      'Remove this cat?',
      'This removes the cat and the boxes you drew for it. Your photos are not deleted, and your other cats are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // Boxes, the cat, and its in-progress id together (#304).
            removeCatFromDraft(catId)
            onRemoved?.()
          },
        },
      ],
    )
  }, [])
}
