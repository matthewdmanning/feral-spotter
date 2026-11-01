import {
  startLocationCapture,
  getLocationCaptureState,
  __resetLocationCaptureForTests,
} from '@/src/lib/location'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'

const mockGetForegroundPermissionsAsync = jest.fn()
const mockWatchPositionAsync = jest.fn()
const removeMock = jest.fn()

jest.mock('expo-location', () => ({
  ...jest.requireActual('expo-location'),
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
}))

describe('startLocationCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    __resetLocationCaptureForTests()
    useConsentStore.setState({ accepted: false, acceptedVersion: null })
    mockWatchPositionAsync.mockResolvedValue({ remove: removeMock })
  })

  afterEach(() => {
    __resetLocationCaptureForTests()
  })

  it('never touches expo-location when consent has not been accepted', async () => {
    await startLocationCapture()

    expect(getLocationCaptureState().status).toBe('idle')
    expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled()
    expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  })

  it("stays idle when permission isn't granted", async () => {
    useConsentStore.getState().markAccepted()
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: false })

    await startLocationCapture()

    expect(getLocationCaptureState().status).toBe('idle')
    expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  })

  it('resolves to a stubbed fix in dev without watching for a real one', async () => {
    useConsentStore.getState().markAccepted()
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      android: { accuracy: 'fine' },
    })

    await startLocationCapture()

    const state = getLocationCaptureState()
    expect(state.status).toBe('resolved')
    expect(state.result).toMatchObject({
      latitude: 34.6834,
      longitude: -82.8374,
    })
    expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  })
})
