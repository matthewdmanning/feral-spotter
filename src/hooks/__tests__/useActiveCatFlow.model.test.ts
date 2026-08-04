import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useActiveCatFlow } from '../useActiveCatFlow'

/**
 * Model of useActiveCatFlow (ADR 0004): the seam that survives the
 * annotate -> Cat Form navigation and decides which cat "first box declares
 * a cat" applies to. idle -> annotating -> catFormOpen -> idle, per the
 * spec's Testing Decisions. NOT_IN_PHOTO is intentionally absent — that
 * status/handler belongs to ticket #171, not this seam's #170 shape.
 *
 * Both dependency stores are replaced with real, non-persisted zustand
 * stores (not the actual persisted modules) — this sidesteps the
 * react-test-renderer crash the handoff notes for live AsyncStorage
 * rehydration during a render, while still exercising real store
 * reactivity (unlike a plain object mock, set() here actually re-renders
 * the hook).
 */
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}))

let mockUuidCounter = 0
jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-cat-id-${++mockUuidCounter}`,
}))

jest.mock('../useActiveCatFlowStore', () => {
  const { create } = require('zustand')
  return {
    useActiveCatFlowStore: create((set: (partial: object) => void) => ({
      activeCatId: null,
      setActiveCatId: (id: string | null) => set({ activeCatId: id }),
    })),
  }
})

jest.mock('../useBoundingBoxStore', () => {
  const { create } = require('zustand')
  return {
    useBoundingBoxStore: create(
      (
        set: (fn: (s: { boxes: Record<string, unknown[]> }) => object) => void,
        get: () => { boxes: Record<string, unknown[]> },
      ) => ({
        boxes: {},
        addBox: (catId: string, photoId: string, box: object) => {
          const key = `${catId}:${photoId}`
          set((s) => ({
            boxes: { ...s.boxes, [key]: [{ ...box, id: 'test-box' }] },
          }))
        },
        getBoxes: (catId: string, photoId: string) =>
          get().boxes[`${catId}:${photoId}`] ?? [],
      }),
    ),
  }
})

const box = {
  lowerLeftX: 0.1,
  lowerLeftY: 0.1,
  upperRightX: 0.5,
  upperRightY: 0.5,
}

const flowMachine = createMachine({
  id: 'activeCatFlow',
  initial: 'idle',
  states: {
    idle: {
      on: { BOX_CONFIRMED: 'annotating' },
    },
    annotating: {
      on: {
        BOX_CONFIRMED: 'annotating',
        BOXING_COMPLETE: 'catFormOpen',
        BACK: 'idle',
      },
    },
    catFormOpen: {
      on: { FORM_SAVED: 'idle' },
    },
  },
})

describe('useActiveCatFlow — model-based test', () => {
  let hook: ReturnType<
    typeof renderHook<ReturnType<typeof useActiveCatFlow>, unknown>
  >

  beforeEach(() => {
    jest.clearAllMocks()
    const { useActiveCatFlowStore } = require('../useActiveCatFlowStore')
    useActiveCatFlowStore.setState({ activeCatId: null })
    const { useBoundingBoxStore } = require('../useBoundingBoxStore')
    useBoundingBoxStore.setState({ boxes: {} })
    hook = renderHook(() => useActiveCatFlow())
  })

  const model = createTestModel(flowMachine)

  const testParams = {
    states: {
      idle: () => {
        expect(hook.result.current.activeCatId).toBeNull()
      },
      annotating: () => {
        expect(hook.result.current.activeCatId).not.toBeNull()
        // The boxed photo reads back as located; an untouched one stays pending.
        expect(hook.result.current.getPhotoStatus('photo-1')).toBe('located')
        expect(hook.result.current.getPhotoStatus('photo-2')).toBe('pending')
      },
      catFormOpen: () => {
        expect(hook.result.current.activeCatId).not.toBeNull()
        expect(router.replace).toHaveBeenCalledWith('/submission/cats')
      },
    },
    events: {
      BOX_CONFIRMED: () => {
        act(() => hook.result.current.handleBoxConfirmed('photo-1', box))
      },
      BOXING_COMPLETE: () => {
        act(() => hook.result.current.handleBoxingComplete())
      },
      // Mirrors the annotate screen's hardware-back handler, which calls
      // clearActiveCat directly rather than routing through this hook's own
      // navigation (see src/screens/submission/annotate/index.tsx).
      BACK: () => {
        act(() => hook.result.current.clearActiveCat())
      },
      // Mirrors useCatSubmit's post-save clearActiveCat call.
      FORM_SAVED: () => {
        act(() => hook.result.current.clearActiveCat())
      },
    },
  }

  const journeys = [
    {
      name: 'happy path: first box declares cat -> boxing complete -> form saved',
      events: [
        { type: 'BOX_CONFIRMED' },
        { type: 'BOXING_COMPLETE' },
        { type: 'FORM_SAVED' },
      ],
    },
    {
      name: 'mid-pass abandonment: back before Cat Form clears the active cat',
      events: [{ type: 'BOX_CONFIRMED' }, { type: 'BACK' }],
    },
    {
      name: 'boxing complete is callable after just one box, not gated on a full pass',
      events: [{ type: 'BOX_CONFIRMED' }, { type: 'BOXING_COMPLETE' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })

  it('abandoning a pass and starting a new one mints a fresh cat id, not a resume', () => {
    act(() => hook.result.current.handleBoxConfirmed('photo-1', box))
    const firstId = hook.result.current.activeCatId
    act(() => hook.result.current.clearActiveCat())
    expect(hook.result.current.activeCatId).toBeNull()

    act(() => hook.result.current.handleBoxConfirmed('photo-1', box))
    expect(hook.result.current.activeCatId).not.toBeNull()
    expect(hook.result.current.activeCatId).not.toBe(firstId)
  })

  it('boxing complete with zero boxes drawn goes back instead of opening Cat Form', () => {
    act(() => hook.result.current.handleBoxingComplete())
    expect(router.back).toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })
})
