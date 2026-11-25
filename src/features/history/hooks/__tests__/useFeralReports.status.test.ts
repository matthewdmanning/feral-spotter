import { act, renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useFeralReports } from '@/src/features/history/hooks/useFeralReports'

// NAV-5 / NAV-T-4: loading, failed and empty used to read the same, so a
// failed history read looked like "No sightings yet".

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback]),
}))

beforeEach(() => {
  useAuthStore.setState({ user: { uid: 'uid-1', email: null }, isReady: true })
})

it('reports a rejected read and becomes ready after retry', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error('storage unavailable'))

  const { result } = await renderHook(() => useFeralReports())
  await waitFor(() => expect(result.current.status).toBe('failed'))

  await act(() => result.current.onRefresh())

  expect(result.current.status).toBe('ready')
  expect(result.current.caches).toEqual([])
})
