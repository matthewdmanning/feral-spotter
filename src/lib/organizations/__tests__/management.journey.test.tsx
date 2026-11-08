import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'
import { OrganizationPermissions } from '@/src/components/organisms/organizations/OrganizationPermissions'
import { SharingSettings } from '@/src/components/organisms/organizations/SharingSettings'
import { useOrganizationSharingStore } from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { useUIStore } from '@/src/hooks/useUIStore'
import { buildGrant } from '../sharing'
import { DEFAULT_SHARING } from '@/src/types/Organizations'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'

// The supplied expo-crypto mock returns no UUIDs.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: jest.fn(),
}))
let nextId = 0
const pressDialogButton = async (text: string) =>
  await act(async () => {
    await useUIStore
      .getState()
      .dialog!.buttons.find((button) => button.text === text)!.onPress!()
  })
beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `management-${++nextId}` as ReturnType<typeof randomUUID>,
    )
  useAuthStore.setState({
    user: { uid: 'owner', email: 'current@example.test' },
    isReady: true,
  })
  useOrganizationsFlag.setState({ enabled: true })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useUIStore.setState({ dialog: null })
})

test('settings values are saved explicitly and stay scoped to the current user', async () => {
  const user = userEvent.setup()
  await render(<SharingSettings />)
  expect(screen.getByRole('checkbox', { name: 'Share name' })).not.toBeChecked()
  await user.press(screen.getByRole('checkbox', { name: 'Share name' }))
  await user.type(screen.getByLabelText('Name to share'), 'Observer')
  expect(useOrganizationSharingStore.getState().accounts.owner).toBeUndefined()
  await user.press(
    screen.getByRole('button', { name: 'Save sharing preferences' }),
  )
  expect(
    useOrganizationSharingStore.getState().accounts.owner.settings,
  ).toMatchObject({ name: 'Observer', fields: { name: true } })
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  expect(screen.getByRole('checkbox', { name: 'Share name' })).not.toBeChecked()
  expect(screen.queryByDisplayValue('Observer')).toBeNull()
})

test('review uses the current email and global settings; cancellation still works after flag-off', async () => {
  const user = userEvent.setup()
  const state = useOrganizationSharingStore.getState()
  state.configure('owner', {
    ...DEFAULT_SHARING,
    fields: { ...DEFAULT_SHARING.fields, email: true },
  })
  state.enqueue('owner', {
    action: 'grant',
    organizationId: 'rescue',
    organizationName: 'Rescue',
    requiresConfirmation: true,
    grant: buildGrant({
      organizationId: 'rescue',
      submissionId: 'sighting',
      catalogVersion: 'old',
      epoch: 0,
      anonymous: false,
      settings: {
        ...DEFAULT_SHARING,
        fields: { ...DEFAULT_SHARING.fields, email: true, photos: true },
      },
      email: 'outdated@example.test',
    }),
  })
  const service = await fakeOrganizationsService(({ action }) => {
    if (action === 'catalog')
      return {
        version: 'current',
        organizations: [
          { id: 'rescue', name: 'Rescue', active: true, coverage: null! },
        ],
      }
    if (action === 'list') return { epochs: { rescue: 1 }, permissions: [] }
    return { status: 503 }
  })
  await render(<OrganizationPermissions />)
  await user.press(screen.getByRole('button', { name: 'Review sharing' }))
  await waitFor(() =>
    expect(useUIStore.getState().dialog?.title).toBe('Confirm sharing again'),
  )
  expect(useUIStore.getState().dialog!.message).toBe(
    'Rescue: cat count, approximate area, Email. Contact: current@example.test. Current coverage will be checked before permission is saved.',
  )
  await pressDialogButton('Share this sighting')
  await waitFor(() =>
    expect(service.requests).toContainEqual(
      expect.objectContaining({
        action: 'grant',
        grant: expect.objectContaining({
          contactEmail: 'current@example.test',
          catalogVersion: 'current',
          epoch: 1,
          settings: expect.objectContaining({
            fields: expect.objectContaining({ email: true, photos: false }),
          }),
        }),
      }),
    ),
  )
  await act(async () => {
    useOrganizationsFlag.setState({ enabled: false })
  })
  expect(screen.queryByRole('button', { name: 'Review sharing' })).toBeNull()
  await user.press(
    screen.getByRole('button', { name: 'Cancel sharing permission' }),
  )
  await pressDialogButton('Revoke')
  await waitFor(() =>
    expect(
      useOrganizationSharingStore
        .getState()
        .accounts.owner.outbox.map((item) => item.action),
    ).toEqual(['revoke']),
  )
  expect(screen.getByText(/Revocation pending connection/)).toBeTruthy()
})
