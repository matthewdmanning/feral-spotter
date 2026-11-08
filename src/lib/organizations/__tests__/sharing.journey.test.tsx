import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SubmissionOrganizations } from '@/src/components/organisms/organizations/SubmissionOrganizations'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/hooks/useOrganizationSharingStore'
import {
  organizationsDirectory,
  useOrganizationDirectoryStore,
} from '@/src/hooks/useOrganizationDirectory'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { confirmedSharing } from '../consent'
import { DEFAULT_SHARING, type Catalog } from '@/src/types/Organizations'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
const square = (x: number): [number, number][][] => [
  [
    [x, x],
    [x + 2, x],
    [x + 2, x + 2],
    [x, x + 2],
    [x, x],
  ],
]
const catalog: Catalog = {
  version: 'v1',
  organizations: [
    {
      id: 'a',
      name: 'First rescue',
      active: true,
      coverage: { type: 'Polygon', coordinates: square(0) },
    },
    {
      id: 'b',
      name: 'Second rescue',
      active: true,
      coverage: { type: 'Polygon', coordinates: square(0) },
    },
    {
      id: 'far',
      name: 'Distant rescue',
      active: true,
      coverage: { type: 'Polygon', coordinates: square(10) },
    },
  ],
}
const shareBox = () =>
  screen.getByRole('checkbox', { name: 'Share this sighting' })
const setLocation = async (latitude: number, longitude: number) =>
  await act(async () => {
    useSubmissionStore.getState().setSubmissionLocation({ latitude, longitude })
  })

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'owner', email: 'owner@example.com' },
    isReady: true,
  })
  useOrganizationsFlag.setState({ enabled: true })
  useOrganizationDirectoryStore.setState({
    cache: null,
    loading: false,
    refreshFailed: false,
  })
  useSubmissionStore.getState().clearDraft()
  useSubmissionStore
    .getState()
    .setSubmissionLocation({ latitude: 1, longitude: 1 })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useOrganizationSharingStore.getState().configure('owner', {
    ...DEFAULT_SHARING,
    fields: { ...DEFAULT_SHARING.fields, email: true },
  })
})

test('submission journey: overlapping organizations, anonymous override, changed settings, restart and a fresh sighting', async () => {
  const service = await fakeOrganizationsService(() => catalog)
  const user = userEvent.setup()
  const view = await render(<SubmissionOrganizations />)
  await screen.findByRole('checkbox', { name: 'First rescue' })
  expect(service.actions()).toEqual(['catalog'])
  expect(screen.queryByText('Distant rescue')).toBeNull()
  expect(screen.queryByText(/saved coverage|unavailable/)).toBeNull()
  await user.press(screen.getByRole('checkbox', { name: 'First rescue' }))
  await user.press(screen.getByRole('checkbox', { name: 'Second rescue' }))
  expect(screen.getByRole('checkbox', { name: 'Anonymous' })).toBeChecked()
  expect(
    screen.getByText('Included: cat count, approximate area.'),
  ).toBeTruthy()
  expect(() => confirmedSharing('owner')).toThrow('confirm')
  await user.press(shareBox())
  expect(confirmedSharing('owner')?.draft.selectedIds).toEqual(['a', 'b'])
  await user.press(screen.getByRole('checkbox', { name: 'Anonymous' }))
  expect(
    screen.getByText('Included: cat count, approximate area, Email.'),
  ).toBeTruthy()
  expect(shareBox()).not.toBeChecked()
  await user.press(shareBox())
  await act(async () => {
    useOrganizationSharingStore.getState().configure('owner', {
      ...DEFAULT_SHARING,
      fields: { ...DEFAULT_SHARING.fields, photos: true },
    })
  })
  expect(shareBox()).not.toBeChecked()
  expect(() => confirmedSharing('owner')).toThrow('confirm')
  await user.press(shareBox())
  // A cold-start restore cannot silently reuse the checked confirmation.
  await act(async () => {
    await useSubmissionStore.persist.rehydrate()
  })
  expect(shareBox()).not.toBeChecked()
  await act(async () => {
    useOrganizationSharingStore.getState().remember('owner', ['a'])
    useSubmissionStore.getState().clearDraft()
    useSubmissionStore
      .getState()
      .setSubmissionLocation({ latitude: 1, longitude: 1 })
  })
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: 'First rescue' }),
    ).toBeChecked(),
  )
  expect(screen.getByRole('checkbox', { name: 'Anonymous' })).toBeChecked()
  expect(shareBox()).not.toBeChecked()
  await user.press(
    screen.getByRole('checkbox', { name: 'Report an injured cat' }),
  )
  expect(useSubmissionStore.getState().submission.report_injured).toBe(true)
  expect(
    screen.getByText(
      'This does not contact or notify an organization. No rescue response is requested.',
    ),
  ).toBeTruthy()
  await view.unmount()
})

test('only a revocation of a selected organization withdraws the confirmation', async () => {
  await fakeOrganizationsService(() => catalog)
  const user = userEvent.setup()
  await render(<SubmissionOrganizations />)
  await user.press(
    await screen.findByRole('checkbox', { name: 'First rescue' }),
  )
  await user.press(shareBox())
  const setEpochs = async (epochs: Record<string, number>) =>
    await act(async () => {
      useOrganizationSharingStore.setState((state) => ({
        accounts: {
          owner: {
            ...state.accounts.owner,
            ledger: { epochs, permissions: [] },
          },
        },
      }))
    })
  await setEpochs({ far: 1 })
  expect(shareBox()).toBeChecked()
  expect(confirmedSharing('owner')?.draft.selectedIds).toEqual(['a'])
  await setEpochs({ far: 1, a: 1 })
  expect(shareBox()).not.toBeChecked()
})

test('cached coverage filters by the sighting and account changes never reuse another user’s choices', async () => {
  await fakeOrganizationsService(() => catalog)
  const user = userEvent.setup()
  await render(<SubmissionOrganizations />)
  await user.press(
    await screen.findByRole('checkbox', { name: 'First rescue' }),
  )
  await setLocation(15, 15)
  await waitFor(() =>
    expect(screen.queryByRole('checkbox', { name: 'First rescue' })).toBeNull(),
  )
  expect(
    useSubmissionStore.getState().organizationSharing?.selectedIds,
  ).toEqual([])
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  await setLocation(1, 1)
  await waitFor(() =>
    expect(useSubmissionStore.getState().organizationSharing?.ownerUid).toBe(
      'other',
    ),
  )
  expect(
    useSubmissionStore.getState().organizationSharing?.selectedIds,
  ).toEqual([])
  expect(
    useOrganizationSharingStore.getState().accounts.other ??
      EMPTY_ORGANIZATION_ACCOUNT,
  ).toEqual(EMPTY_ORGANIZATION_ACCOUNT)
  await act(async () => {
    useOrganizationsFlag.setState({ enabled: false })
  })
  expect(screen.queryByText('Share with organizations')).toBeNull()
})

test('a failed refresh keeps the saved directory usable; a corrupt cache is ignored', async () => {
  await fakeOrganizationsService(() => catalog)
  await organizationsDirectory.save(await organizationsDirectory.fetch(1, 1))
  await fakeOrganizationsService(() => ({ status: 503 }))
  await render(<SubmissionOrganizations />)
  expect(await screen.findByText(/Using saved coverage/)).toBeTruthy()
  expect(
    screen.getByRole('checkbox', { name: 'First rescue' }),
  ).not.toBeChecked()
  expect(screen.getByText('Retry organization coverage')).toBeTruthy()
  await AsyncStorage.setItem('organizations-directory-v1', '{bad json')
  expect(await organizationsDirectory.cached()).toBeNull()
})
