import { act, render, waitFor } from '@testing-library/react-native'
import { http, HttpResponse } from 'msw'
import { OrganizationsRuntime } from '@/src/features/organizations/components/OrganizationsRuntime'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { server } from '@/src/test-utils/mswServer'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'

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
          posthogProjectToken: 'public-project-token',
          posthogHost: 'https://flags.example.com',
        },
      },
    },
  }
})

const flags = FEATURE_FLAGS as { organizations: boolean }
const buildFlag = flags.organizations
const ledger = { epochs: {}, permissions: [] }

beforeEach(() => {
  flags.organizations = false
  useConsentStore.setState({ accepted: false, analyticsAccepted: null })
  useOrganizationsFlag.setState({
    enabled: false,
    pinInteractionsEnabled: false,
  })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useAuthStore.setState({ user: { uid: 'owner', email: null }, isReady: true })
  server.use(
    http.post('https://flags.example.com/flags/', () =>
      HttpResponse.json({ flags: { Organizations: { enabled: true } } }),
    ),
  )
})
afterEach(() => {
  flags.organizations = buildFlag
})

test('off with nothing pending, it sends no Organizations request', async () => {
  const service = await fakeOrganizationsService(() => ledger)
  useUIStore.setState({ isOnline: true })
  await render(<OrganizationsRuntime />)
  await act(async () => {})
  expect(useOrganizationsFlag.getState().enabled).toBe(false)
  expect(service.actions()).toEqual([])
})

test('off, it still delivers a pending revocation', async () => {
  const service = await fakeOrganizationsService(() => ledger)
  useOrganizationSharingStore.getState().enqueue('owner', {
    action: 'revoke',
    organizationId: 'rescue',
    submissionId: 'sighting',
  })
  useUIStore.setState({ isOnline: true })
  await render(<OrganizationsRuntime />)
  await waitFor(() => expect(service.actions()).toEqual(['list', 'revoke']))
})

test('granting analytics consent lets the rollout turn Organizations on', async () => {
  useUIStore.setState({ isOnline: false })
  await render(<OrganizationsRuntime />)
  await act(async () => {})
  expect(useOrganizationsFlag.getState().enabled).toBe(false)
  await act(async () => {
    useConsentStore.setState({
      accepted: true,
      acceptedVersion: CONSENT_VERSION,
      analyticsAccepted: true,
    })
  })
  await waitFor(() =>
    expect(useOrganizationsFlag.getState().enabled).toBe(true),
  )
})
