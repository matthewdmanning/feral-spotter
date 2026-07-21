import { useConsentStore } from '@/src/hooks/useConsentStore'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

describe('useConsentStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.clear()
    useConsentStore.setState({
      dataAgreementAcceptedAt: null,
      onboardingCompleted: false,
      primers: {
        location: { status: 'pending', decidedAt: null },
        camera: { status: 'pending', decidedAt: null },
        photo_library: { status: 'pending', decidedAt: null },
      },
    })
  })

  it('starts with no agreement accepted and onboarding incomplete', () => {
    const state = useConsentStore.getState()
    expect(state.dataAgreementAcceptedAt).toBeNull()
    expect(state.onboardingCompleted).toBe(false)
  })

  it('acceptDataAgreement records a timestamp', () => {
    useConsentStore.getState().acceptDataAgreement()
    const { dataAgreementAcceptedAt } = useConsentStore.getState()
    if (dataAgreementAcceptedAt === null) throw new Error('expected a timestamp')
    expect(new Date(dataAgreementAcceptedAt).toString()).not.toBe('Invalid Date')
  })

  it('setPrimerStatus updates only the targeted primer, leaving others untouched', () => {
    useConsentStore.getState().setPrimerStatus('camera', 'granted')

    const { primers } = useConsentStore.getState()
    expect(primers.camera.status).toBe('granted')
    expect(primers.camera.decidedAt).not.toBeNull()
    expect(primers.location).toEqual({ status: 'pending', decidedAt: null })
    expect(primers.photo_library).toEqual({ status: 'pending', decidedAt: null })
  })

  it('setPrimerStatus overwrites a prior decision for the same primer', () => {
    useConsentStore.getState().setPrimerStatus('location', 'deferred')
    useConsentStore.getState().setPrimerStatus('location', 'declined')

    expect(useConsentStore.getState().primers.location.status).toBe('declined')
  })

  it('completeOnboarding sets onboardingCompleted without touching consent fields', () => {
    useConsentStore.getState().completeOnboarding()

    const state = useConsentStore.getState()
    expect(state.onboardingCompleted).toBe(true)
    expect(state.dataAgreementAcceptedAt).toBeNull()
  })
})
