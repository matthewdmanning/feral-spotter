import { render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import type { PhotoSource } from '@/src/hooks/usePhotoStore'
import HomeScreen from '../index'

/**
 * Model of the photo-source-exclusivity gate (ADR 0002's 2026-07-31
 * amendment): "a draft is single-source by construction". Kept as its own
 * machine, separate from HomeScreen.gate.model.test.tsx's auth/consent
 * gate — the two are orthogonal and cross-producting them would explode the
 * state count for no benefit.
 *
 * usePhotoStore is mocked here (source-value derivation only) rather than
 * driven live, matching HomeScreen.gate.model.test.tsx's proven pattern —
 * the real persisted store's async-storage rehydration was found to corrupt
 * react-test-renderer mid-suite in this RN/React 19 setup (reproduced in
 * isolation). The store's own reducer logic — addPhoto/addPhotos pinning
 * `source`, removePhoto clearing it at exactly the last photo — is covered
 * separately and directly in usePhotoStore.source.test.ts (no rendering
 * involved, so it isn't exposed to that renderer bug).
 */
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  const withVariants = (obj: object) =>
    Object.assign(obj, { useVariants: jest.fn() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) =>
        withVariants(typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ isReady: true, isAuthenticated: true }),
}))
jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: () => true,
}))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))
jest.mock('@/src/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))
jest.mock('@/src/hooks/usePhotoStore', () => ({
  usePhotoStore: (sel: (s: { source: PhotoSource }) => unknown) =>
    sel({ source: mockSource }),
}))
jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  ImagePlus: () => null,
}))

let mockSource: PhotoSource = null

const gateMachine = createMachine({
  id: 'photoSourceGate',
  initial: 'emptyPool',
  states: {
    emptyPool: {
      on: {
        CAMERA_PICK: 'cameraDraft',
        LIBRARY_PICK: 'libraryDraft',
      },
    },
    cameraDraft: {
      on: { REMOVE_LAST: 'emptyPool', SUBMIT: 'emptyPool' },
    },
    libraryDraft: {
      on: { REMOVE_LAST: 'emptyPool', SUBMIT: 'emptyPool' },
    },
  },
})

describe('HomeScreen photo-source-exclusivity gate — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void
  let getByLabelText: ReturnType<typeof render>['getByLabelText']

  beforeEach(() => {
    jest.clearAllMocks()
    mockSource = null
    const result = render(<HomeScreen />)
    getByLabelText = result.getByLabelText
    rerender = result.rerender
  })

  const model = createTestModel(gateMachine)

  const expectDisabled = async (camera: boolean, library: boolean) => {
    await waitFor(() => {
      expect(
        getByLabelText('Take a Photo').props.accessibilityState.disabled,
      ).toBe(camera)
      expect(
        getByLabelText('Choose from Library').props.accessibilityState
          .disabled,
      ).toBe(library)
    })
  }

  const testParams = {
    states: {
      emptyPool: () => expectDisabled(false, false),
      cameraDraft: () => expectDisabled(false, true),
      libraryDraft: () => expectDisabled(true, false),
    },
    events: {
      CAMERA_PICK: () => {
        mockSource = 'camera'
        rerender(<HomeScreen />)
      },
      LIBRARY_PICK: () => {
        mockSource = 'library'
        rerender(<HomeScreen />)
      },
      // Post-removal state (source cleared) — the store-level clear-at-last-
      // photo edge itself is covered in usePhotoStore.source.test.ts.
      REMOVE_LAST: () => {
        mockSource = null
        rerender(<HomeScreen />)
      },
      SUBMIT: () => {
        mockSource = null
        rerender(<HomeScreen />)
      },
    },
  }

  const journeys = [
    {
      name: 'camera pick disables the library entrypoint',
      events: [{ type: 'CAMERA_PICK' }],
    },
    {
      name: 'library pick disables the camera entrypoint',
      events: [{ type: 'LIBRARY_PICK' }],
    },
    {
      name: 'removing the last camera photo re-enables both entrypoints',
      events: [{ type: 'CAMERA_PICK' }, { type: 'REMOVE_LAST' }],
    },
    {
      name: 'submitting a library-sourced draft re-enables both entrypoints',
      events: [{ type: 'LIBRARY_PICK' }, { type: 'SUBMIT' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
