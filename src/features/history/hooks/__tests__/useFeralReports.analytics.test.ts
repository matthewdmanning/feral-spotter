import { renderHook, waitFor } from '@testing-library/react-native'
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

// The device cache can hold another account's Sightings. The view event
// must count only what the signed-in account's list shows.

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/src/features/auth/lib/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
}))

it('counts only the signed-in account’s Sightings', async () => {
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
  ]) {
    await createSubmissionCache(id, {
      location_method: 'device',
      time_method: 'device',
    })
    await updateSubmissionCache(id, { user_id: owner, status: 'Submitted' })
  }

  const { result } = await renderHook(() => useFeralReports())
  await waitFor(() => expect(result.current.status).toBe('ready'))

  expect(capture).toHaveBeenCalledWith(
    EVENTS.SIGHTING_HISTORY_VIEWED,
    expect.objectContaining({ sighting_count: 1, submitted_count: 1 }),
  )
  registerCapture(null)
})
