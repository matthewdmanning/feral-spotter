import { act, renderHook } from '@testing-library/react-native'
import { Alert, Linking } from 'react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useLibraryPhotoPicker } from '../useLibraryPhotoPicker'

/**
 * Models useLibraryPhotoPicker's explicit permission gate (#249): a decline
 * inside launchImageLibraryAsync() and backing out of the picker without
 * choosing anything both resolve as `{ canceled: true }` — indistinguishable
 * unless permission is checked explicitly first, mirroring the camera/
 * location "explicit yes, not absence of no" pattern (#66/#237/#243).
 * launchImageLibraryAsync() always resolves `canceled: true` here — the
 * pick-processing logic downstream of a successful pick is unchanged by
 * #249 and out of scope for this gate-only model.
 */
const mockGetMediaLibraryPermissionsAsync = jest.fn()
const mockRequestMediaLibraryPermissionsAsync = jest.fn()
const mockLaunchImageLibraryAsync = jest.fn(async () => ({ canceled: true }))
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  getMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockGetMediaLibraryPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) =>
    mockLaunchImageLibraryAsync(...args),
}))

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }))

jest.mock('@/src/hooks', () => ({
  usePhotoStore: (sel: (s: object) => unknown) =>
    sel({ photos: [], addPhotos: jest.fn() }),
  useSubmissionStore: (sel: (s: object) => unknown) =>
    sel({
      setLocationType: jest.fn(),
      setTimeType: jest.fn(),
      setCapturedAt: jest.fn(),
    }),
}))

jest.mock('@/src/lib/analytics/analytics', () => ({
  captureEvent: jest.fn(),
  EVENTS: { LIBRARY_PHOTOS_SELECTED: 'library_photos_selected' },
}))

describe('useLibraryPhotoPicker permission gate — model-based test', () => {
  let result: ReturnType<
    typeof renderHook<ReturnType<typeof useLibraryPhotoPicker>, void>
  >

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    result = renderHook(() => useLibraryPhotoPicker())
  })

  const gateMachine = createMachine({
    id: 'libraryPermissionGate',
    initial: 'idle',
    states: {
      idle: {
        on: {
          TAP_ALREADY_GRANTED: 'opened',
          TAP_NOT_DETERMINED_THEN_GRANT: 'opened',
          TAP_NOT_DETERMINED_THEN_DENY: 'blocked',
        },
      },
      opened: {},
      blocked: {},
    },
  })

  const model = createTestModel(gateMachine)

  const tap = async () => {
    await act(async () => {
      await result.result.current.pickFromLibrary()
    })
  }

  const testParams = {
    states: {
      idle: () => {
        expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled()
        expect(Alert.alert).not.toHaveBeenCalled()
      },
      opened: () => {
        expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1)
        expect(Alert.alert).not.toHaveBeenCalled()
      },
      blocked: () => {
        expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled()
        expect(Alert.alert).toHaveBeenCalledTimes(1)
      },
    },
    events: {
      TAP_ALREADY_GRANTED: async () => {
        mockGetMediaLibraryPermissionsAsync.mockResolvedValue({
          status: 'granted',
        })
        await tap()
      },
      TAP_NOT_DETERMINED_THEN_GRANT: async () => {
        mockGetMediaLibraryPermissionsAsync.mockResolvedValue({
          status: 'undetermined',
        })
        mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
          status: 'granted',
        })
        await tap()
      },
      TAP_NOT_DETERMINED_THEN_DENY: async () => {
        mockGetMediaLibraryPermissionsAsync.mockResolvedValue({
          status: 'undetermined',
        })
        mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
          status: 'denied',
        })
        await tap()
      },
    },
  }

  // UX journeys, matching the issue's own Testing Decisions 1:1.
  const journeys = [
    {
      name: 'already granted opens the picker directly, no request call',
      events: [{ type: 'TAP_ALREADY_GRANTED' }],
    },
    {
      name: 'first tap: undetermined, user grants, picker opens',
      events: [{ type: 'TAP_NOT_DETERMINED_THEN_GRANT' }],
    },
    {
      name: 'first tap: undetermined, user denies, Settings-recovery message shown, picker never opens',
      events: [{ type: 'TAP_NOT_DETERMINED_THEN_DENY' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })

  it('already granted never calls requestMediaLibraryPermissionsAsync (short-circuit)', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' })
    await tap()
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled()
  })

  it('denial message offers Open Settings, wired to Linking.openSettings', async () => {
    jest.spyOn(Linking, 'openSettings').mockImplementation(() => {})
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
    })
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'denied',
    })
    await tap()

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0]
    const openSettingsButton = buttons.find(
      (b: { text: string }) => b.text === 'Open Settings',
    )
    openSettingsButton.onPress()
    expect(Linking.openSettings).toHaveBeenCalledTimes(1)
  })
})
