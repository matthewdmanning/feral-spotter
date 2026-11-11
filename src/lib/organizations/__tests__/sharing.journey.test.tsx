import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SharingSettings } from '@/src/components/organisms/organizations/SharingSettings'
import { SubmissionOrganizations } from '@/src/components/organisms/organizations/SubmissionOrganizations'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { confirmedSharing } from '../consent'
import { Organizations } from '../Organizations'
import { DEFAULT_SHARING, type Catalog } from '@/src/types/Organizations'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
const coverage = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  ] as [number, number][][],
}
const catalog: Catalog = {
  version: 'v1',
  organizations: [
    { id: 'a', name: 'First rescue', active: true, coverage },
    { id: 'b', name: 'Second rescue', active: true, coverage },
    {
      id: 'far',
      name: 'Distant rescue',
      active: true,
      coverage: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10],
          ],
        ],
      },
    },
  ],
}

beforeEach(async () => {
  useAuthStore.setState({
    user: { uid: 'owner', email: 'owner@example.com' },
    isReady: true,
  })
  useOrganizationsFlag.setState({ enabled: true })
  useSubmissionStore.getState().clearDraft()
  useSubmissionStore
    .getState()
    .setSubmissionLocation({ latitude: 1, longitude: 1 })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useOrganizationSharingStore.getState().configure('owner', {
    ...DEFAULT_SHARING,
    fields: { ...DEFAULT_SHARING.fields, email: true },
  })
  await new Organizations(async () => catalog).refresh(1, 1)
})

test('submission journey: overlapping organizations, anonymous override, changed settings, restart and a fresh sighting', async () => {
  const user = userEvent.setup()
  const view = render(<SubmissionOrganizations />)
  await screen.findByRole('checkbox', { name: 'First rescue' })
  expect(screen.queryByText('Distant rescue')).toBeNull()
  expect(
    screen.getByText('Organization delivery is not available yet.'),
  ).toBeTruthy()
  await user.press(screen.getByRole('checkbox', { name: 'First rescue' }))
  await user.press(screen.getByRole('checkbox', { name: 'Second rescue' }))
  expect(screen.getByRole('checkbox', { name: 'Anonymous' })).toBeChecked()
  expect(
    screen.getByText('Included: cat count, approximate area.'),
  ).toBeTruthy()
  expect(() => confirmedSharing('owner')).toThrow('confirm')
  await user.press(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  )
  expect(confirmedSharing('owner')?.draft.selectedIds).toEqual(['a', 'b'])
  await user.press(screen.getByRole('checkbox', { name: 'Anonymous' }))
  expect(
    screen.getByText('Included: cat count, approximate area, Email.'),
  ).toBeTruthy()
  expect(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  ).not.toBeChecked()
  await user.press(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  )
  await act(async () => {
    useOrganizationSharingStore.getState().configure('owner', {
      ...DEFAULT_SHARING,
      fields: { ...DEFAULT_SHARING.fields, photos: true },
    })
  })
  expect(() => confirmedSharing('owner')).toThrow('confirm')
  await user.press(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  )
  // A cold-start restore cannot silently reuse the checked confirmation.
  await act(async () => {
    await useSubmissionStore.persist.rehydrate()
  })
  expect(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  ).not.toBeChecked()
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
  expect(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  ).not.toBeChecked()
  await user.press(
    screen.getByRole('checkbox', { name: 'Report an injured cat' }),
  )
  expect(useSubmissionStore.getState().submission.report_injured).toBe(true)
  expect(screen.getByText('No rescue response is requested.')).toBeTruthy()
  view.unmount()
})

test('cached coverage filters by the sighting and account changes never reuse another user’s choices', async () => {
  const user = userEvent.setup()
  render(<SubmissionOrganizations />)
  await user.press(
    await screen.findByRole('checkbox', { name: 'First rescue' }),
  )
  await act(async () => {
    useSubmissionStore
      .getState()
      .setSubmissionLocation({ latitude: 15, longitude: 15 })
  })
  await waitFor(() =>
    expect(screen.queryByRole('checkbox', { name: 'First rescue' })).toBeNull(),
  )
  expect(
    useSubmissionStore.getState().organizationSharing?.selectedIds,
  ).toEqual([])
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
    useSubmissionStore
      .getState()
      .setSubmissionLocation({ latitude: 1, longitude: 1 })
  })
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

test('bad cache is ignored and a failed refresh preserves the last offline directory', async () => {
  const directory = new Organizations(async () => {
    throw new Error('offline')
  })
  await expect(directory.refresh(1, 1)).rejects.toThrow('offline')
  expect((await directory.cached())?.version).toBe('v1')
  await AsyncStorage.setItem('organizations-directory-v1', '{bad json')
  expect(await directory.cached()).toBeNull()
})

// Reachability check: missing contact values must be created through the form,
// not by inventing an email-less account or mutating saved preferences.
test('a user can save a selected name field with no name and see it in the disclosure', async () => {
  const user = userEvent.setup()
  const settings = render(<SharingSettings />)
  await user.press(screen.getByRole('checkbox', { name: 'Share name' }))
  expect(screen.getByLabelText('Name to share').props.value).toBe('')
  await user.press(
    screen.getByRole('button', { name: 'Save sharing preferences' }),
  )
  settings.unmount()

  render(<SubmissionOrganizations />)
  await user.press(
    await screen.findByRole('checkbox', { name: 'First rescue' }),
  )
  await user.press(screen.getByRole('checkbox', { name: 'Anonymous' }))
  expect(
    screen.getByText('Included: cat count, approximate area, Name, Email.'),
  ).toBeTruthy()
  expect(screen.getByText('Name: not configured')).toBeTruthy()
})
