import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useFeralReports } from '@/src/features/history/hooks/useFeralReports'
import { EVENTS, registerCapture } from '@/src/shared/analytics/analytics'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import {
  createSubmissionCache,
  updateSubmissionCache,
} from '@/src/shared/lib/submissionCache'

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback]),
}))

it('counts only the signed-in account’s Sightings once per view', async () => {
  useAuthStore.setState({ user: { uid: 'uid-1', email: null }, isReady: true })
  useConsentStore.setState({
    accepted: true,
    acceptedVersion: CONSENT_VERSION,
    activeUid: 'uid-1',
    choicesUid: 'uid-1',
    analyticsAccepted: true,
  })
  // After the account change: binding clears earlier registrations.
  const capture = jest.fn()
  registerCapture(capture)
  for (const [id, owner] of [
    ['mine', 'uid-1'],
    ['theirs', 'uid-2'],
    ['legacy', undefined],
  ] as const) {
    await createSubmissionCache(id, {
      location_method: 'device',
      time_method: 'device',
    })
    await updateSubmissionCache(id, { user_id: owner, status: 'Submitted' })
  }

  const { result } = await renderHook(() => useFeralReports())
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.caches.map(({ id }) => id).sort()).toEqual([
    'legacy',
    'mine',
  ])

  expect(capture).toHaveBeenCalledWith(
    EVENTS.SIGHTING_HISTORY_VIEWED,
    expect.objectContaining({ sighting_count: 1, submitted_count: 1 }),
  )
  await act(() => result.current.onRefresh())
  expect(capture).toHaveBeenCalledTimes(1)
  registerCapture(null)
})
