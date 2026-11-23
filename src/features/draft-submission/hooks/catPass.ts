/**
 * hooks/catPass.ts
 * The cat pass: Cat List → Annotate → Cat Form and back. One module owns
 * the routes, push-vs-replace, the "no auto-skip" landing signal and
 * the in-progress cat id (#292's one-owner rule), so screens call intents
 * ("start a pass", "abandon it", "back to Cat List") instead of each
 * knowing the rules.
 *
 * The rules, collected:
 * - Annotate is replaced in when Cat List lands with nothing recorded
 *   (#173), and pushed otherwise.
 * - Leaving a pass names its destination, never router.back() (#203): the
 *   first cat's Annotate has no Cat List beneath it after the auto-skip's
 *   replace.
 * - Returning to Cat List pops to the one already on the stack, adding one
 *   only when the auto-skip replaced it away. A replace stacked another Cat
 *   List, with its own draft sync, on every pass.
 * - Abandoning with no cat recorded lands Home: Cat List's auto-skip would
 *   bounce straight back into Annotate.
 * - Removing the last cat lands on Cat List without the auto-skip (#299).
 * - Annotate never opens or stays empty (#503): no photos means no
 *   auto-skip, and removing the last one ends the pass on Cat List.
 * - A cat left unfinished keeps no boxes and no id (#304).
 *
 * Plain functions read the stores fresh, so a confirm handler never acts on
 * a value captured before the user tapped.
 */

import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { goHome } from '@/src/shared/lib/navigation'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

const CAT_LIST = '/submission/create'
const ANNOTATE = '/submission/annotate'
const CAT_FORM = '/submission/cats'
// Private to this module: Cat List reads it through useCatListLanding.
const NO_AUTO_SKIP_PARAM = 'noAutoSkip'

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

/**
 * "Add a Cat" / "Annotate Photos" from Cat List. Refused with no photos to
 * annotate (#503); returns whether Annotate opened.
 */
export function startCatPass(): boolean {
  if (usePhotoStore.getState().photos.length === 0) return false
  startFreshPass()
  router.push(ANNOTATE)
  return true
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
  if (recordedCatIds().length > 0) router.dismissTo(CAT_LIST)
  else goHome()
}

/** Back to Cat List after saving a cat, or from a stale edit link. */
export function returnToCatList(): void {
  router.dismissTo(CAT_LIST)
}

/** Removes a saved cat with its boxes; clears it if it was in progress. */
export function removeCatFromDraft(catId: string): void {
  useBoundingBoxStore.getState().clearForCat(catId)
  useSubmissionStore.getState().removeCat(catId)
  clearActiveCatIfMatches(catId)
}

/** Cat List, without the auto-skip back into Annotate. */
function returnToCatListWithoutAutoSkip(): void {
  router.dismissTo({
    pathname: CAT_LIST,
    params: { [NO_AUTO_SKIP_PARAM]: '1' },
  })
}

/** After removing a cat from Cat Form: Cat List, without the auto-skip. */
export function returnToCatListAfterRemoval(): void {
  returnToCatListWithoutAutoSkip()
}

/**
 * Annotate's last photo was removed (#503). Annotate never shows empty: the
 * pass ends on Cat List, which offers the no-photos choices.
 */
export function leaveEmptyPass(): void {
  startFreshPass()
  returnToCatListWithoutAutoSkip()
}

/**
 * Cat List's landing rule (#173, #189, #299). Landing with nothing recorded
 * skips straight into Annotate, once, decided at mount: a live watch would
 * also fire when Reset empties the cats and race its navigation Home.
 * Landing after a removed last cat or an emptied Annotate, or with no
 * photos to annotate, does not skip.
 * Returns whether the skip is in flight, so Cat List renders nothing then.
 */
export function useCatListLanding(): { autoSkipPending: boolean } {
  const params = useLocalSearchParams<{ [NO_AUTO_SKIP_PARAM]?: string }>()
  const noAutoSkip = params[NO_AUTO_SKIP_PARAM] === '1'
  const catCount = useSubmissionStore((state) => state.cats.length)
  // No photos: Annotate would open empty, so Cat List stays (#503).
  const hasPhotos = usePhotoStore((state) => state.photos.length > 0)
  const [autoSkipPending] = useState(
    () => catCount === 0 && !noAutoSkip && hasPhotos,
  )
  useEffect(() => {
    if (!autoSkipPending) return
    startFreshPass([])
    router.replace(ANNOTATE)
  }, [autoSkipPending])
  return { autoSkipPending }
}
