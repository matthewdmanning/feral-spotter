/**
 * hooks/useAbandonCatGuard.ts
 *
 * Confirms before leaving Cat Observations with a cat still in progress (#304).
 *
 * Only a Cat Form *save* clears `activeCatId` (useCatSubmit). Backing out of
 * the form left the cat in progress forever, and the next "Add a Cat" then
 * silently resumed it: `handleAddCat` pushes straight to annotate, photos
 * already boxed for the abandoned cat render as located, and the first
 * confirmed box reuses the stale id via `handleBoxConfirmed`'s
 * `activeCatId ?? randomUUID()` — merging the new cat's boxes into the
 * abandoned one.
 *
 * #292 fixed the cross-draft half of this (teardown now clears the id and
 * every box unconditionally, so nothing survives Reset into a new draft).
 * This is the in-draft half ADR-0004's amendment left in scope.
 *
 * Uses Expo Router's `usePreventRemove` rather than intercepting each exit
 * separately: it covers the header back arrow, swipe-back and Android
 * hardware back in a single place. (Expo SDK 58 removed the raw
 * `navigation.addListener('beforeRemove')` event this hook used before.) `BackHandler` alone can't distinguish an
 * edge-swipe from a hardware press — the annotate screen hit exactly that and
 * had to swallow both.
 *
 * Cat Form field state is plain `useState` (useCatForm), so this session's
 * form selections are discarded by unmount on their own — the only durable
 * state to clean up is the boxes and the id.
 */

import { showAlert } from '@/src/shared/hooks/useUIStore'
import { useActiveCatFlow } from '@/src/hooks/useActiveCatFlow'
import { useActiveCatFlowStore } from '@/src/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { usePreventRemove } from 'expo-router'
import { useEffect, useRef } from 'react'

/**
 * @param isEditingSavedCat true when the screen was opened to edit an
 * already-recorded cat. Backing out of an edit abandons nothing, so it must
 * never offer to delete that cat's boxes.
 */
export function useAbandonCatGuard(isEditingSavedCat: boolean): void {
  const activeCatId = useActiveCatFlowStore((s) => s.activeCatId)
  const clearForCat = useBoundingBoxStore((s) => s.clearForCat)
  const { handleAbandonPass } = useActiveCatFlow()
  // usePreventRemove returns the disabler its own callback needs; a ref
  // hands it over without reading a variable before it is declared.
  const disablePreventionRef = useRef<() => void>(() => {})

  const disablePrevention = usePreventRemove(
    !isEditingSavedCat && activeCatId !== null,
    ({ repeat }) => {
      // Read the id fresh rather than trusting the render that armed the
      // guard: handleSave clears it immediately before navigating away, in the
      // same tick, before a re-render can drop the prevention. A cleared id
      // means a save, so let that navigation through.
      const currentCatId = useActiveCatFlowStore.getState().activeCatId
      if (!currentCatId) {
        disablePreventionRef.current()
        repeat()
        return
      }
      showAlert(
        'Remove this cat?',
        "You haven't saved this cat. Leaving now removes the boxes you drew for it and anything you filled in here. Your photos and any other cats are not affected.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove progress on this cat',
            style: 'destructive',
            onPress: () => {
              clearForCat(currentCatId)
              disablePreventionRef.current()
              // Clears the id and picks the destination itself — Cat List
              // when other cats exist, Home when none, since Cat List's
              // zero-cat auto-skip would otherwise bounce straight back
              // into annotate.
              handleAbandonPass()
            },
          },
        ],
      )
    },
  )
  useEffect(() => {
    disablePreventionRef.current = disablePrevention
  }, [disablePrevention])
}
