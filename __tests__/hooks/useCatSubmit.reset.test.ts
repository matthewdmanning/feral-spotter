import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useCatSubmit } from '@/src/hooks/useCatSubmit'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import type { CatFormValues } from '@/src/hooks/useCatForm'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'cat-1') }))

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

const mockStopLocationCapture = jest.fn()
jest.mock('@/src/lib/location', () => ({
  stopLocationCapture: () => mockStopLocationCapture(),
}))

const emptyForm: CatFormValues = {
  age: 'adult',
  earTipped: 'yes',
  owned: 'no',
  pattern: 'tabby',
  hairLength: 'short',
  color: 'orange',
  sex: 'female',
  health: 3,
  photoIds: [],
}

describe('useCatSubmit handleReset', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.clear()
    useSubmissionStore.setState({
      cats: [],
      submission: { location_type: 'device', time_type: 'device' },
      history: [],
      currentStep: 'create',
    })
    usePhotoStore.setState({ photos: [] })
  })

  it('tears down the background Live-fix reacquire on reset', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Reset')?.onPress?.()
    })

    const { result } = renderHook(() =>
      useCatSubmit({ form: emptyForm, annotationEnabled: false }),
    )

    await act(async () => {
      result.current.handleReset()
    })

    expect(mockStopLocationCapture).toHaveBeenCalled()
  })
})
