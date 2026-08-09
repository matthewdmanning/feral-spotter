import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useActiveCatFlow } from '../useActiveCatFlow'

/**
 * Model of useActiveCatFlow (ADR 0004): the seam that survives the
 * annotate -> Cat Form navigation and decides which cat "first box declares
 * a cat" applies to. idle -> annotating -> catFormOpen -> idle, per the
 * spec's Testing Decisions. NOT_IN_PHOTO (#171) self-loops on `annotating`
 * in these journeys — its lazy-mint from `idle` (#203, so the pill works on
 * the first photo too, not just a confirmed box) is covered by its own
 * standalone test below rather than a journey, since it would otherwise
 * conflict with the shared `annotating` assertion's photo-1/photo-2 setup.
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

jest.mock('../useSubmissionStore', () => {
  const { create } = require('zustand')
  return {
    useSubmissionStore: create(() => ({ cats: [] })),
  }
})

jest.mock('../useBoundingBoxStore', () => {
  const { create } = require('zustand')
  return {
    useBoundingBoxStore: create(
      (
        set: (
          fn: (s: {
            boxes: Record<string, unknown[]>
            absences: Record<string, true>
          }) => object,
        ) => void,
        get: () => {
          boxes: Record<string, unknown[]>
          absences: Record<string, true>
        },
      ) => ({
        boxes: {},
        absences: {},
        // Mirrors the real store: addBox/markAbsent are mutually exclusive
        // for the same cat+photo key.
        addBox: (catId: string, photoId: string, box: object) => {
          const key = `${catId}:${photoId}`
          set((s) => {
            const absences = { ...s.absences }
            delete absences[key]
            return {
              boxes: { ...s.boxes, [key]: [{ ...box, id: 'test-box' }] },
              absences,
            }
          })
        },
        markAbsent: (catId: string, photoId: string) => {
          const key = `${catId}:${photoId}`
          set((s) => {
            const boxes = { ...s.boxes }
            delete boxes[key]
            return { boxes, absences: { ...s.absences, [key]: true } }
          })
        },
        getBoxes: (catId: string, photoId: string) =>
          get().boxes[`${catId}:${photoId}`] ?? [],
        getBoxedPhotoIds: (catId: string) =>
          Object.keys(get().boxes)
            .filter((key) => key.startsWith(`${catId}:`))
            .map((key) => key.slice(catId.length + 1)),
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
        NOT_IN_PHOTO: 'annotating',
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
    useBoundingBoxStore.setState({ boxes: {}, absences: {} })
    const { useSubmissionStore } = require('../useSubmissionStore')
    useSubmissionStore.setState({ cats: [] })
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
      // Targets photo-3, distinct from photo-1/photo-2 asserted by the
      // `annotating` state check above, so this doesn't fight that assertion.
      NOT_IN_PHOTO: () => {
        act(() => hook.result.current.handleNotInPhoto('photo-3'))
        expect(hook.result.current.getPhotoStatus('photo-3')).toBe(
          'not-in-photo',
        )
      },
      BOXING_COMPLETE: () => {
        act(() => hook.result.current.handleBoxingComplete())
      },
      // The annotate screen's hardware-back handler calls this directly
      // (see src/screens/submission/annotate/index.tsx) — #203: must land
      // on Home, never a default pop (which lands on Camera for the
      // very-first-cat path) or Cat List (loops for a zero-cats submission).
      BACK: () => {
        act(() => hook.result.current.handleAbandonPass())
        expect(router.replace).toHaveBeenCalledWith('/')
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
    {
      name: 'not-in-photo records explicit absence without disrupting boxing complete',
      events: [
        { type: 'BOX_CONFIRMED' },
        { type: 'NOT_IN_PHOTO' },
        { type: 'BOXING_COMPLETE' },
      ],
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

  it('boxing complete with zero boxes drawn abandons the pass instead of opening Cat Form (#203)', () => {
    // Routes through handleAbandonPass, not router.back() — same Camera-leak
    // risk on the first cat of a submission as the hardware-back path.
    act(() => hook.result.current.handleBoxingComplete())
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('boxing complete after only not-in-photo marks (no box) also abandons the pass — no phantom cat (#203)', () => {
    // handleNotInPhoto lazily mints activeCatId same as handleBoxConfirmed
    // (#203, so the pill works on photo 1) — boxing complete must still
    // gate on an actual box, not just activeCatId, or a pass where every
    // photo was marked "not in photo" would open Cat Form for a cat with
    // zero photo_local_ids.
    act(() => hook.result.current.handleNotInPhoto('photo-1'))
    expect(hook.result.current.activeCatId).not.toBeNull()

    act(() => hook.result.current.handleBoxingComplete())
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('a box and an absence marker are mutually exclusive for the same cat+photo slot', () => {
    act(() => hook.result.current.handleBoxConfirmed('photo-1', box))
    expect(hook.result.current.getPhotoStatus('photo-1')).toBe('located')

    act(() => hook.result.current.handleNotInPhoto('photo-1'))
    expect(hook.result.current.getPhotoStatus('photo-1')).toBe('not-in-photo')

    act(() => hook.result.current.handleBoxConfirmed('photo-1', box))
    expect(hook.result.current.getPhotoStatus('photo-1')).toBe('located')
  })

  it('not-in-photo before any box exists lazily starts the pass (#203)', () => {
    act(() => hook.result.current.handleNotInPhoto('photo-1'))
    expect(hook.result.current.activeCatId).not.toBeNull()
    expect(hook.result.current.getPhotoStatus('photo-1')).toBe('not-in-photo')
  })

  it('abandoning with cats already recorded lands on Cat List, not Home (#203)', () => {
    const { useSubmissionStore } = require('../useSubmissionStore')
    act(() => {
      useSubmissionStore.setState({ cats: [{ local_id: 'existing-cat' }] })
    })

    act(() => hook.result.current.handleAbandonPass())
    expect(router.replace).toHaveBeenCalledWith('/submission/create')
  })
})
