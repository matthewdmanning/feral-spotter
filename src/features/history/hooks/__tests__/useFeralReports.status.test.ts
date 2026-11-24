import { act, renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFeralReports } from '@/src/features/history/hooks/useFeralReports'

// NAV-5 / NAV-T-4: loading, failed and empty used to read the same, so a
// failed history read looked like "No sightings yet".

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/src/features/auth/lib/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
}))

it('is on a rejected read, ready after a retry', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const getItem = jest
    .spyOn(AsyncStorage, 'getItem')
    .mockRejectedValue(new Error('storage unavailable'))

  const { result } = await renderHook(() => useFeralReports())
  await waitFor(() => expect(result.current.status).toBe('failed'))

  getItem.mockRestore()
  await act(() => result.current.onRefresh())

  expect(result.current.status).toBe('ready')
  expect(result.current.caches).toEqual([])
})
