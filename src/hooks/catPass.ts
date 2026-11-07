/**
 * hooks/catPass.ts
 * The cat pass: Cat List → Annotate → Cat Form and back. One module owns
 * the routes, push-vs-replace, the "last cat removed" landing signal and
 * the in-progress cat id (#292's one-owner rule), so screens call intents
 * ("start a pass", "abandon it", "back to Cat List") instead of each
 * knowing the rules.
 *
 * The rules, collected:
 * - Annotate is replaced in when Cat List lands with nothing recorded
 *   (#173), and pushed otherwise.
 * - Leaving a pass names its destination, never router.back() (#203): the
 *   first cat's Annotate sits on Camera after the auto-skip's replace.
 * - Abandoning with no cat recorded lands Home: Cat List's auto-skip would
 *   bounce straight back into Annotate.
 * - Removing the last cat lands on Cat List without the auto-skip (#299).
 * - A cat left unfinished keeps no boxes and no id (#304).
 *
 * Plain functions read the stores fresh, so a confirm handler never acts on
 * a value captured before the user tapped.
 */

import { useActiveCatFlowStore } from '@/src/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

const CAT_LIST = '/submission/create'
const ANNOTATE = '/submission/annotate'
const CAT_FORM = '/submission/cats'
const HOME = '/'
// Private to this module: Cat List reads it through useCatListLanding.
const REMOVED_LAST_CAT_PARAM = 'removed'

const recordedCatIds = () =>
  useSubmissionStore.getState().cats.map((cat) => cat.local_id)

// ─── The in-progress cat ─────────────────────────────────────────────────────

/** Clears the in-progress cat, but only if it is the one named. */
export function clearActiveCatIfMatches(catId: string): void {
  const { activeCatId, setActiveCatId } = useActiveCatFlowStore.getState()
  if (activeCatId === catId) setActiveCatId(null)
}

/**
 * Readies Annotate for a new cat's pass: an unfinished pass's cat and boxes
 * are dropped, unless that cat is already recorded.
 */
export function startFreshPass(recorded: string[] = recordedCatIds()): void {
  const { activeCatId, setActiveCatId } = useActiveCatFlowStore.getState()
  if (activeCatId && !recorded.includes(activeCatId)) {
    useBoundingBoxStore.getState().clearForCat(activeCatId)
  }
  setActiveCatId(null)
}

// ─── Intents ─────────────────────────────────────────────────────────────────

/** "Add a Cat" / "Annotate Photos" from Cat List. */
export function startCatPass(): void {
  startFreshPass()
  router.push(ANNOTATE)
}

/** Opens Cat Form: for a saved cat to edit, or to describe a new one. */
export function openCatForm(editCatId?: string): void {
  router.push(
    editCatId ? { pathname: CAT_FORM, params: { edit: editCatId } } : CAT_FORM,
  )
}

/** Annotate's Boxing Complete with photo evidence: on to Cat Form. */
export function finishBoxing(): void {
  router.replace(CAT_FORM)
}

/**
 * Leaves a pass without saving its cat: drops the unfinished cat's boxes
 * and id, then lands on Cat List, or Home when no cat is recorded.
 */
export function abandonCatPass(): void {
  startFreshPass()
  router.replace(recordedCatIds().length > 0 ? CAT_LIST : HOME)
}

/** Back to Cat List after saving a cat, or from a stale edit link. */
export function returnToCatList(): void {
  router.replace(CAT_LIST)
}

/** Removes a saved cat with its boxes; clears it if it was in progress. */
export function removeCatFromDraft(catId: string): void {
  useBoundingBoxStore.getState().clearForCat(catId)
  useSubmissionStore.getState().removeCat(catId)
  clearActiveCatIfMatches(catId)
}

/** After removing a cat from Cat Form: Cat List, without the auto-skip. */
export function returnToCatListAfterRemoval(): void {
  router.replace({
    pathname: CAT_LIST,
    params: { [REMOVED_LAST_CAT_PARAM]: '1' },
  })
}

/**
 * Cat List's landing rule (#173, #189, #299). Landing with nothing recorded
 * skips straight into Annotate, once, decided at mount: a live watch would
 * also fire when Reset empties the cats and race its navigation Home.
 * Landing because the last cat was removed does not skip. Returns whether
 * the skip is in flight, so Cat List renders nothing that frame.
 */
export function useCatListLanding(): { autoSkipPending: boolean } {
  const params = useLocalSearchParams<{ [REMOVED_LAST_CAT_PARAM]?: string }>()
  const removedLastCat = params[REMOVED_LAST_CAT_PARAM] === '1'
  const catCount = useSubmissionStore((state) => state.cats.length)
  const [autoSkipPending] = useState(() => catCount === 0 && !removedLastCat)
  useEffect(() => {
    if (!autoSkipPending) return
    startFreshPass([])
    router.replace(ANNOTATE)
  }, [autoSkipPending])
  return { autoSkipPending }
}
