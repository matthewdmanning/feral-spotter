import { act, render } from '@testing-library/react-native'
import React from 'react'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import CreateSubmissionScreen from '../index'

/**
 * Regression test for the reacquire-must-not-clobber invariant (Q5 of the
 * sprint:location-mvp grilling): the Submission draft's location is only
 * ever written when the background Live-fix singleton (src/lib/location.ts)
 * reports 'resolved' — never while it's mid-reacquire ('pending') — so a
 * worse in-flight candidate can't overwrite the fix already on the draft.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
  updateSubmissionCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/src/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({ handleDone: jest.fn(), isSubmitting: false }),
}))

let mockCapture: {
  status: 'idle' | 'pending' | 'resolved'
  startedAt: number | null
  result: { latitude: number; longitude: number; accuracy?: number } | undefined
}

jest.mock('@/src/lib/location', () => ({
  useLocationCapture: () => mockCapture,
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: () => anyProp() })
  const theme = new Proxy({}, { get: () => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  CheckCircle: () => null,
}))

describe('Create screen — location-commit invariant', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSubmissionStore.setState({
      cats: [],
      submission: { location_type: 'device', time_type: 'device' },
      currentStep: 'create',
    })
  })

  it('commits on resolve, ignores a worse in-flight candidate during reacquire, and commits the reacquire result once it resolves', async () => {
    mockCapture = {
      status: 'resolved',
      startedAt: 1,
      result: { latitude: 1, longitude: 2, accuracy: 20 },
    }
    const { rerender } = render(<CreateSubmissionScreen />)
    await act(async () => {})

    expect(useSubmissionStore.getState().submission).toMatchObject({
      latitude: 1,
      longitude: 2,
      accuracy: 20,
    })

    // Reacquire kicks off: worse in-flight candidate while still pending.
    mockCapture = {
      status: 'pending',
      startedAt: 2,
      result: { latitude: 9, longitude: 9, accuracy: 80 },
    }
    rerender(<CreateSubmissionScreen />)
    await act(async () => {})

    expect(useSubmissionStore.getState().submission).toMatchObject({
      latitude: 1,
      longitude: 2,
      accuracy: 20,
    })

    // Reacquire resolves — now it commits, even though the new fix is worse
    // than the original (Q5: replace once resolved, not "only if better").
    mockCapture = {
      status: 'resolved',
      startedAt: 2,
      result: { latitude: 9, longitude: 9, accuracy: 80 },
    }
    rerender(<CreateSubmissionScreen />)
    await act(async () => {})

    expect(useSubmissionStore.getState().submission).toMatchObject({
      latitude: 9,
      longitude: 9,
      accuracy: 80,
    })
  })

  it('never writes a manually-pinned location, even once the background fix resolves', async () => {
    useSubmissionStore.setState({
      cats: [],
      submission: {
        location_type: 'pin',
        time_type: 'device',
        latitude: 5,
        longitude: 6,
      },
      history: [],
      currentStep: 'create',
    })
    mockCapture = {
      status: 'resolved',
      startedAt: 1,
      result: { latitude: 1, longitude: 2, accuracy: 20 },
    }
    render(<CreateSubmissionScreen />)
    await act(async () => {})

    expect(useSubmissionStore.getState().submission).toMatchObject({
      latitude: 5,
      longitude: 6,
    })
  })
})
