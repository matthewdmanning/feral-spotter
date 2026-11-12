import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { waitFor } from '@testing-library/react-native'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { buildGrant } from '@/src/features/organizations/lib/permissions'
import { DEFAULT_SHARING } from '@/src/shared/types/Organizations'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'

let nextId = 0
const grant = buildGrant({
  submissionId: 'sighting',
  organizationId: 'rescue',
  catalogVersion: 'v1',
  epoch: 0,
  anonymous: true,
  settings: DEFAULT_SHARING,
  email: null,
})
const ledger = { epochs: {}, permissions: [] }
const outbox = () =>
  useOrganizationSharingStore.getState().accounts.owner?.outbox ?? []
const enqueueGrant = (organizationId = 'rescue') =>
  useOrganizationSharingStore.getState().enqueue('owner', {
    action: 'grant',
    organizationId,
    grant: { ...grant, organizationId },
  })
const sync = () => useOrganizationSharingStore.getState().sync('owner')
beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `mutation-${++nextId}` as ReturnType<typeof randomUUID>,
    )
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useOrganizationsFlag.setState({ enabled: true })
  useAuthStore.setState({ user: { uid: 'owner', email: null }, isReady: true })
})

test('the store persists a deduplicated outbox by itself and drains it after a cold start', async () => {
  const service = await fakeOrganizationsService(() => ({ status: 503 }))
  enqueueGrant()
  enqueueGrant()
  await sync()
  expect(service.actions()).toEqual(['list'])
  let disk = ''
  await waitFor(async () => {
    disk = (await AsyncStorage.getItem('organization-sharing-v1'))!
    expect(JSON.parse(disk).state.accounts.owner.outbox).toHaveLength(1)
  })
  // Cold start: memory is lost, then the store restores from the saved image.
  useOrganizationSharingStore.setState({ accounts: {} })
  await AsyncStorage.setItem('organization-sharing-v1', disk)
  await useOrganizationSharingStore.persist.rehydrate()
  const drained = await fakeOrganizationsService(() => ledger)
  await sync()
  expect(drained.requests).toEqual([
    { action: 'list' },
    {
      action: 'grant',
      mutationId: 'mutation-1',
      organizationId: 'rescue',
      grant,
    },
  ])
  expect(outbox()).toEqual([])
})

test('a 409 marks the grant for review; a 400 leaves it pending but not for review', async () => {
  await fakeOrganizationsService(({ action, organizationId }) =>
    action === 'list'
      ? ledger
      : { status: organizationId === 'rescue' ? 409 : 400 },
  )
  enqueueGrant('rescue')
  await sync()
  enqueueGrant('invalid')
  await sync()
  expect(
    outbox().map((item) => [item.organizationId, !!item.requiresConfirmation]),
  ).toEqual([
    ['rescue', true],
    ['invalid', false],
  ])
})

test('a permanent grant rejection does not starve later grants or retry in the same drain', async () => {
  const service = await fakeOrganizationsService(
    ({ action, organizationId }) =>
      action === 'list'
        ? ledger
        : organizationId === 'invalid'
          ? { status: 400 }
          : ledger,
  )
  enqueueGrant('invalid')
  enqueueGrant('rescue')

  await sync()
  expect(service.actions()).toEqual(['list', 'grant', 'grant'])
  expect(outbox().map((item) => item.organizationId)).toEqual(['invalid'])

  await sync()
  expect(service.actions()).toEqual(['list', 'grant', 'grant', 'list', 'grant'])
  expect(outbox().map((item) => item.organizationId)).toEqual(['invalid'])
})

test('flag-off still sends revocations first while withholding grants', async () => {
  const service = await fakeOrganizationsService(() => ledger)
  enqueueGrant('other')
  useOrganizationSharingStore.getState().enqueue('owner', {
    action: 'revokeOrganization',
    organizationId: 'rescue',
  })
  useOrganizationsFlag.setState({ enabled: false })
  await sync()
  expect(service.actions()).toEqual(['list', 'revokeOrganization'])
  expect(outbox().map((item) => item.action)).toEqual(['grant'])
})

test('another signed-in user cannot flush an owner’s pending choices', async () => {
  const service = await fakeOrganizationsService(() => ledger)
  enqueueGrant()
  useAuthStore.setState({ user: { uid: 'other', email: null } })
  await sync()
  expect(service.requests).toEqual([])
  expect(outbox()).toHaveLength(1)
})

test('review rebuilds from current settings and email; a stale or cancelled review cannot be confirmed', async () => {
  const state = useOrganizationSharingStore.getState()
  state.configure('owner', {
    ...DEFAULT_SHARING,
    fields: { ...DEFAULT_SHARING.fields, email: true },
  })
  useAuthStore.setState({ user: { uid: 'owner', email: 'new@example.test' } })
  state.enqueue('owner', {
    action: 'grant',
    organizationId: 'rescue',
    requiresConfirmation: true,
    grant: { ...grant, anonymous: false, contactEmail: 'old@example.test' },
  })
  await fakeOrganizationsService(({ action }) =>
    action === 'catalog'
      ? {
          version: 'v2',
          organizations: [
            { id: 'rescue', name: 'Rescue', active: true, coverage: null! },
          ],
        }
      : { epochs: { rescue: 1 }, permissions: [] },
  )
  const [pending] = outbox()
  const reviewed = (await state.prepareReview('owner', pending.mutationId))!
  expect(reviewed.grant).toMatchObject({
    contactEmail: 'new@example.test',
    catalogVersion: 'v2',
    epoch: 1,
  })
  // Settings changed after the dialog opened: the shown grant is stale.
  state.configure('owner', DEFAULT_SHARING)
  expect(state.reconfirm('owner', pending.mutationId, reviewed)).toBe(false)
  state.configure('owner', {
    ...DEFAULT_SHARING,
    fields: { ...DEFAULT_SHARING.fields, email: true },
  })
  expect(state.reconfirm('owner', pending.mutationId, reviewed)).toBe(true)
  const [replaced] = outbox()
  expect(replaced).toMatchObject({ grant: reviewed.grant })
  expect(replaced.mutationId).not.toBe(pending.mutationId)
  expect(state.reconfirm('owner', pending.mutationId, reviewed)).toBe(false)
})
