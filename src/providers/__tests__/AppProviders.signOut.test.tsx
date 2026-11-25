import { act, render } from '@testing-library/react-native'
import { AppProviders } from '@/src/providers/AppProviders'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

/**
 * Sign-out must drop the last account's PostHog identity from SDK storage,
 * through the provider: the SDK-level reset alone never runs, because the
 * bridge unmounts on sign-out. Not before auth reports, when "no user" is
 * only a guess.
 */

const mockForget = jest.fn()
jest.mock('@/src/shared/analytics/posthogClient', () => ({
  ...jest.requireActual('@/src/shared/analytics/posthogClient'),
  forgetSignedOutIdentity: () => mockForget(),
}))
jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useSegments: () => [],
  useFocusEffect: jest.fn(),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}))

it('forgets the identity on a reported sign-out only', async () => {
  useAuthStore.setState({ user: null, isReady: false })
  await render(<AppProviders>{null}</AppProviders>)
  expect(mockForget).not.toHaveBeenCalled()

  await act(async () => {
    useAuthStore.setState({
      user: { uid: 'user-a', email: null },
      isReady: true,
    })
  })
  expect(mockForget).not.toHaveBeenCalled()

  await act(async () => {
    useAuthStore.setState({ user: null, isReady: true })
  })
  expect(mockForget).toHaveBeenCalledTimes(1)
})
