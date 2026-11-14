import { router } from 'expo-router'
import { observedCat } from '@/src/test-utils/catFixtures'
import {
  abandonCatPass,
  removeCatFromDraft,
} from '@/src/features/draft-submission/hooks/catPass'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'

/**
 * The pass's exit rules, which used to live in five files: an abandoned
 * cat keeps no boxes and no id (#304), and its destination depends on
 * whether any cat is recorded (Cat List's auto-skip would otherwise
 * bounce back into Annotate).
 */

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({}),
}))

const BOX = {
  lowerLeftX: 0.1,
  lowerLeftY: 0.9,
  upperRightX: 0.6,
  upperRightY: 0.2,
}
const boxesOf = (catId: string) =>
  useBoundingBoxStore.getState().getBoxesForCat(catId)

beforeEach(() => {
  jest.clearAllMocks()
  useSubmissionStore.getState().clearDraft()
  useBoundingBoxStore.getState().clearAll()
  useActiveCatFlowStore.getState().setActiveCatId('cat-new')
  useBoundingBoxStore.getState().addBox('cat-new', 'p1', BOX)
})

it('abandoning the first cat drops its boxes and id and lands Home', () => {
  abandonCatPass()
  expect(boxesOf('cat-new')).toEqual([])
  expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
  expect(router.dismissTo).toHaveBeenCalledWith('/')
})

it('abandoning with a cat recorded keeps that cat and lands on Cat List', () => {
  useSubmissionStore.getState().addCat(observedCat({ local_id: 'cat-1' }))
  useBoundingBoxStore.getState().addBox('cat-1', 'p1', BOX)
  abandonCatPass()
  expect(boxesOf('cat-new')).toEqual([])
  expect(boxesOf('cat-1')).toHaveLength(1)
  expect(router.replace).toHaveBeenCalledWith('/submission/create')
})

it('removing the in-progress cat clears its boxes, record and id', () => {
  useSubmissionStore.getState().addCat(observedCat({ local_id: 'cat-new' }))
  removeCatFromDraft('cat-new')
  expect(boxesOf('cat-new')).toEqual([])
  expect(useSubmissionStore.getState().cats).toEqual([])
  expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
})
