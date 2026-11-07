import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useOrganizationSharingStore,
  persistOrganizationSharing,
} from '../useOrganizationSharingStore'
import { useOrganizationsFlag } from '../useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'
import {
  organizationRequest,
  OrganizationSyncError,
} from '@/src/lib/organizations/api'
import { DEFAULT_SHARING, type GrantRequest } from '@/src/types/Organizations'

jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: jest.fn(),
}))
let mockNextId = 0
jest.mock('@/src/lib/organizations/api', () => ({
  organizationRequest: jest.fn(),
  OrganizationSyncError: jest.requireActual('@/src/lib/organizations/api')
    .OrganizationSyncError,
}))
const request = jest.mocked(organizationRequest)
const grant: GrantRequest = {
  submissionId: 'sighting',
  organizationId: 'rescue',
  epoch: 0,
  catalogVersion: 'v1',
  anonymous: true,
  settings: DEFAULT_SHARING,
  injured: false,
  disclosureVersion: 1,
}
const ledger = { epochs: {}, permissions: [] }
beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `mutation-${++mockNextId}` as ReturnType<typeof randomUUID>,
    )
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useOrganizationsFlag.setState({ enabled: true })
  useAuthStore.setState({ user: { uid: 'owner', email: null }, isReady: true })
  request.mockReset()
})

test('offline outbox survives restoration, deduplicates grants and retries after reconnect', async () => {
  const state = useOrganizationSharingStore.getState()
  state.enqueue('owner', { action: 'grant', organizationId: 'rescue', grant })
  state.enqueue('owner', { action: 'grant', organizationId: 'rescue', grant })
  request.mockRejectedValue(new Error('offline'))
  await state.sync('owner')
  await persistOrganizationSharing()
  expect(
    JSON.parse((await AsyncStorage.getItem('organization-sharing-v1'))!).state
      .accounts.owner.outbox,
  ).toHaveLength(1)
  const disk = (await AsyncStorage.getItem('organization-sharing-v1'))!
  useOrganizationSharingStore.setState({ accounts: {} })
  // Restore the saved disk image after clearing the in-process store for this cold-start simulation.
  await AsyncStorage.setItem('organization-sharing-v1', disk)
  await useOrganizationSharingStore.persist.rehydrate()
  request.mockResolvedValue(ledger)
  await state.sync('owner')
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'grant', grant }),
    'owner',
  )
  expect(useOrganizationSharingStore.getState().accounts.owner.outbox).toEqual(
    [],
  )
})

test('changed eligibility requires review, and flag-off still permits revocations while withholding grants', async () => {
  const state = useOrganizationSharingStore.getState()
  state.enqueue('owner', { action: 'grant', organizationId: 'rescue', grant })
  request
    .mockResolvedValueOnce(ledger)
    .mockRejectedValueOnce(new OrganizationSyncError(true))
  await state.sync('owner')
  expect(
    useOrganizationSharingStore.getState().accounts.owner.outbox[0]
      .requiresConfirmation,
  ).toBe(true)
  state.enqueue('owner', {
    action: 'grant',
    organizationId: 'other',
    grant: { ...grant, organizationId: 'other' },
  })
  state.enqueue('owner', {
    action: 'revokeOrganization',
    organizationId: 'rescue',
  })
  useOrganizationsFlag.setState({ enabled: false })
  request.mockReset().mockResolvedValue(ledger)
  await state.sync('owner')
  expect(request.mock.calls.map(([body]) => body.action)).toEqual([
    'list',
    'revokeOrganization',
  ])
  expect(
    useOrganizationSharingStore.getState().accounts.owner.outbox,
  ).toHaveLength(2)
})

test('another signed-in user cannot flush an owner’s pending choices', async () => {
  const state = useOrganizationSharingStore.getState()
  state.enqueue('owner', { action: 'grant', organizationId: 'rescue', grant })
  useAuthStore.setState({ user: { uid: 'other', email: null } })
  await state.sync('owner')
  expect(request).not.toHaveBeenCalled()
  expect(
    useOrganizationSharingStore.getState().accounts.owner.outbox,
  ).toHaveLength(1)
})

test('reconfirmation uses current global settings and email, and cannot restore a cancelled permission', async () => {
  const state = useOrganizationSharingStore.getState()
  state.configure('owner', {
    ...DEFAULT_SHARING,
    fields: { ...DEFAULT_SHARING.fields, email: true },
  })
  useAuthStore.setState({ user: { uid: 'owner', email: 'new@example.test' } })
  state.enqueue('owner', {
    action: 'grant',
    organizationId: 'rescue',
    grant: { ...grant, contactEmail: 'old@example.test', anonymous: false },
  })
  request
    .mockResolvedValueOnce(ledger)
    .mockRejectedValueOnce(new OrganizationSyncError(true))
  await state.sync('owner')
  const pending =
    useOrganizationSharingStore.getState().accounts.owner.outbox[0]
  const reviewed = {
    ...grant,
    anonymous: false,
    settings: useOrganizationSharingStore.getState().accounts.owner.settings,
    contactEmail: 'new@example.test',
    catalogVersion: 'v2',
    epoch: 1,
  }
  expect(
    state.reconfirm(
      'owner',
      pending.mutationId,
      { ...reviewed, contactEmail: 'old@example.test' },
      'Rescue',
    ),
  ).toBe(false)
  expect(state.reconfirm('owner', pending.mutationId, reviewed, 'Rescue')).toBe(
    true,
  )
  const replaced =
    useOrganizationSharingStore.getState().accounts.owner.outbox[0]
  expect(replaced.grant).toEqual(reviewed)
  expect(replaced.mutationId).not.toBe(pending.mutationId)
  expect(state.reconfirm('owner', pending.mutationId, reviewed, 'Rescue')).toBe(
    false,
  )
  state.configure('owner', DEFAULT_SHARING)
  expect(
    state.reconfirm('owner', replaced.mutationId, reviewed, 'Rescue'),
  ).toBe(false)
})
