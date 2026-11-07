import {
  act,
  render,
  renderHook,
  screen,
  userEvent,
} from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SubmissionOrganizations } from '@/src/components/organisms/organizations/SubmissionOrganizations'
import { useSubmissionSubmit } from '../useSubmissionSubmit'
import { useSubmissionStore } from '../useSubmissionStore'
import { usePhotoStore } from '../usePhotoStore'
import { useUIStore } from '../useUIStore'
import { useOrganizationSharingStore } from '../useOrganizationSharingStore'
import { useOrganizationDirectoryStore } from '../useOrganizationDirectory'
import { useOrganizationsFlag } from '../useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import {
  createSubmissionCache,
  getSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { DEFAULT_SHARING } from '@/src/types/Organizations'
import { uploadSubmissionMetadata } from '@/src/lib/upload/firebaseUpload'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))
jest.mock('@/src/lib/location', () => ({ stopLocationCapture: jest.fn() }))
// The supplied expo-crypto mock returns no UUIDs.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: jest.fn(),
}))
jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  uploadSubmissionMetadata: jest.fn().mockResolvedValue(undefined),
  finalizeSubmissionPhotoMetadata: jest.fn().mockResolvedValue(undefined),
}))

beforeEach(async () => {
  jest.mocked(randomUUID).mockReturnValue('test-mutation')
  useAuthStore.setState({
    user: { uid: 'owner', email: 'owner@example.com' },
    isReady: true,
  })
  useOrganizationsFlag.setState({ enabled: true })
  useOrganizationDirectoryStore.setState({ cache: null })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useOrganizationSharingStore.getState().configure('owner', {
    ...DEFAULT_SHARING,
    name: 'Private name',
    phone: '123',
    fields: { ...DEFAULT_SHARING.fields, name: true, email: true, phone: true },
  })
  useSubmissionStore.getState().clearDraft()
  useSubmissionStore
    .getState()
    .setSubmissionLocation({ latitude: 1, longitude: 1 })
  useSubmissionStore.getState().addCat(observedCat())
  usePhotoStore.setState({
    source: 'camera',
    submissionId: 'cloud-sighting',
    photos: [
      {
        local_id: 'photo',
        uri: 'file://photo.jpg',
        uploaded: true,
        cloud_storage_path: 'submissions/owner/cloud-sighting/photo.jpg',
        cloud_storage_url: 'https://private.example/photo',
        upload_progress: 100,
        width: 100,
        height: 100,
      },
    ],
  })
  useUIStore.setState({ dialog: null, isSubmitting: false })
  await createSubmissionCache('local-history', {
    location_method: 'device',
    time_method: 'device',
  })
})

test('a sighting confirmed in the form leaves a durable anonymous grant under its cloud ID after teardown', async () => {
  // Sync after submission fails offline, so the persisted outbox is what remains.
  await fakeOrganizationsService(({ action }) =>
    action === 'catalog'
      ? {
          version: 'v1',
          organizations: [
            {
              id: 'rescue',
              name: 'Rescue',
              active: true,
              coverage: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [2, 0],
                    [2, 2],
                    [0, 2],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        }
      : { status: 503 },
  )
  const user = userEvent.setup()
  const form = render(<SubmissionOrganizations />)
  await user.press(await screen.findByRole('checkbox', { name: 'Rescue' }))
  await user.press(
    screen.getByRole('checkbox', { name: 'Share this sighting' }),
  )
  // Submitting leaves the form; a mounted form would start the next draft.
  form.unmount()
  const { result } = renderHook(() => useSubmissionSubmit())
  await act(async () => {
    result.current.handleDone()
    await useUIStore
      .getState()
      .dialog!.buttons.find((button) => button.text === 'Submit')!.onPress!()
  })
  expect(uploadSubmissionMetadata).toHaveBeenCalled()
  expect(useSubmissionStore.getState().organizationSharing).toBeNull()
  const persisted = JSON.parse(
    (await AsyncStorage.getItem('organization-sharing-v1'))!,
  )
  expect(persisted.state.accounts.owner.outbox).toEqual([
    {
      action: 'grant',
      mutationId: 'test-mutation',
      organizationId: 'rescue',
      organizationName: 'Rescue',
      grant: {
        submissionId: 'cloud-sighting',
        organizationId: 'rescue',
        catalogVersion: 'v1',
        epoch: 0,
        anonymous: true,
        settings: { fields: DEFAULT_SHARING.fields, name: '', phone: '' },
        contactEmail: null,
        disclosureVersion: 1,
      },
    },
  ])
  expect(await getSubmissionCache('local-history')).toMatchObject({
    status: 'Submitted',
    cloud_submission_id: 'cloud-sighting',
  })
})
