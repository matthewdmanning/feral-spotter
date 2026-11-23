import { render, screen, waitFor } from '@testing-library/react-native'
import { http, HttpResponse } from 'msw'
import CreateSubmissionScreen from '@/src/features/draft-submission/screens/create/index'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { server } from '@/src/test-utils/mswServer'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'
import { observedCat } from '@/src/test-utils/catFixtures'

/**
 * The Create screen's sharing card follows the evaluated Organizations flag:
 * with analytics consent the PostHog rollout decides; without it the build flag
 * does. The flag evaluation runs for real; PostHog is
 * the network boundary.
 */

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants')
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      expoConfig: {
        ...actual.default.expoConfig,
        extra: {
          ...actual.default.expoConfig?.extra,
          posthogProjectToken: 'public-project-token',
          posthogHost: 'https://flags.example.com',
        },
      },
    },
  }
})
jest.mock('@/src/shared/lib/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))
jest.mock('@/src/features/draft-submission/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
  }),
}))
jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

const flags = FEATURE_FLAGS as { organizations: boolean }
const buildFlag = flags.organizations
const SHARING_TITLE = 'Share with organizations'

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'owner', email: 'observer@example.test' },
    isReady: true,
  })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  // No location: the card shows without asking the directory.
  useSubmissionStore.setState({
    submission: { location_type: 'device', time_type: 'device' },
    cats: [observedCat()],
  })
  usePhotoStore.setState({ photos: [submissionPhoto()] })
})
afterEach(() => {
  flags.organizations = buildFlag
})

it.each([
  // build flag, analytics consent, PostHog rollout → sharing card shown
  [false, false, true, false],
  [true, false, false, true],
  [false, true, true, true],
  [false, true, false, false],
  [true, true, false, false],
  [true, true, true, true],
])(
  'build flag %s, analytics consent %s, rollout %s: sharing card shown is %s',
  async (build, analytics, rollout, shown) => {
    flags.organizations = build
    useConsentStore.setState({
      accepted: true,
      acceptedVersion: CONSENT_VERSION,
      analyticsAccepted: analytics,
    })
    server.use(
      http.post('https://flags.example.com/flags/', () =>
        HttpResponse.json({ flags: { Organizations: { enabled: rollout } } }),
      ),
    )
    useOrganizationsFlag.setState({ enabled: false })
    await useOrganizationsFlag.getState().refresh()
    await render(<CreateSubmissionScreen />)
    await waitFor(() =>
      expect(screen.getByText('Cats Recorded')).toBeOnTheScreen(),
    )
    expect(screen.queryByText(SHARING_TITLE) !== null).toBe(shown)
  },
)

it('hides the sharing card until a photo exists, even when on', async () => {
  flags.organizations = true
  useConsentStore.setState({
    accepted: true,
    acceptedVersion: CONSENT_VERSION,
    analyticsAccepted: true,
  })
  server.use(
    http.post('https://flags.example.com/flags/', () =>
      HttpResponse.json({ flags: { Organizations: { enabled: true } } }),
    ),
  )
  usePhotoStore.setState({ photos: [] })
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(true)
  await render(<CreateSubmissionScreen />)
  await waitFor(() =>
    expect(screen.getByText('Cats Recorded')).toBeOnTheScreen(),
  )
  expect(screen.queryByText(SHARING_TITLE)).toBeNull()
})
