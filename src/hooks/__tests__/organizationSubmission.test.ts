import { act, renderHook } from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSubmissionSubmit } from '../useSubmissionSubmit'
import { useSubmissionStore } from '../useSubmissionStore'
import { usePhotoStore } from '../usePhotoStore'
import { useUIStore } from '../useUIStore'
import { useOrganizationSharingStore } from '../useOrganizationSharingStore'
import { useOrganizationsFlag } from '../useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { sharingSignature } from '@/src/lib/organizations/consent'
import {
  createSubmissionCache,
  getSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { DEFAULT_SHARING } from '@/src/types/Organizations'
import { uploadSubmissionMetadata } from '@/src/lib/upload/firebaseUpload'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/src/lib/location', () => ({ stopLocationCapture: jest.fn() }))
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
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  useOrganizationSharingStore.getState().configure('owner', {
    ...DEFAULT_SHARING,
    name: 'Private name',
    phone: '123',
    fields: {
      ...DEFAULT_SHARING.fields,
      name: true,
      email: true,
      phone: true,
    },
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

test('confirmed permissions survive submission teardown, use the cloud ID, and omit anonymous contact values', async () => {
  const draft = {
    ownerUid: 'owner',
    selectedIds: ['rescue'],
    anonymous: true,
    catalogVersion: 'v1',
    confirmedSignature: null as string | null,
  }
  const account = useOrganizationSharingStore.getState().accounts.owner
  draft.confirmedSignature = sharingSignature(
    draft,
    account.settings,
    1,
    1,
    false,
    'owner@example.com',
    [{}, []],
  )
  useSubmissionStore.getState().setOrganizationSharing(draft)
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
    expect.objectContaining({
      grant: expect.objectContaining({
        submissionId: 'cloud-sighting',
        anonymous: true,
        settings: { fields: DEFAULT_SHARING.fields, name: '', phone: '' },
        contactEmail: null,
      }),
    }),
  ])
  expect(await getSubmissionCache('local-history')).toMatchObject({
    status: 'Submitted',
    cloud_submission_id: 'cloud-sighting',
  })
})
