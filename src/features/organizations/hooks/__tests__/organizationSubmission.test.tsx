import { act, render, screen, userEvent } from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SubmissionOrganizations } from '@/src/features/organizations/components/SubmissionOrganizations'
import {
  submitDraft,
  type SubmitOutcome,
} from '@/src/features/draft-submission/lib/draft'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationDirectoryStore } from '@/src/features/organizations/hooks/useOrganizationDirectory'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import {
  createSubmissionCache,
  getSubmissionCache,
} from '@/src/shared/lib/submissionCache'
import { DEFAULT_SHARING } from '@/src/shared/types/Organizations'
import { uploadSubmissionMetadata } from '@/src/features/draft-submission/lib/upload/firebaseUpload'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))
jest.mock('@/src/core/location/liveFix', () => ({
  stopLocationCapture: jest.fn(),
}))
// The supplied expo-crypto mock returns no UUIDs.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: jest.fn(),
}))
jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
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
  useUIStore.setState({ dialog: null })
  await createSubmissionCache('local-history', {
    location_method: 'device',
    time_method: 'device',
  })
})

test.each(['unchanged', 'withdrawn', 'anonymous'] as const)(
  'a confirmed sighting finishes without stale grants when consent is %s during upload',
  async (choice) => {
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
    const form = await render(<SubmissionOrganizations />)
    await user.press(await screen.findByRole('checkbox', { name: 'Rescue' }))
    if (choice === 'anonymous')
      await user.press(screen.getByRole('checkbox', { name: 'Anonymous' }))
    await user.press(
      screen.getByRole('checkbox', { name: 'Share this sighting' }),
    )
    let releaseUpload!: () => void
    let uploadStarted!: () => void
    const started = new Promise<void>((resolve) => {
      uploadStarted = resolve
    })
    jest.mocked(uploadSubmissionMetadata).mockImplementationOnce(async () => {
      uploadStarted()
      await new Promise<void>((resolve) => {
        releaseUpload = resolve
      })
    })
    let sending!: Promise<SubmitOutcome>
    await act(async () => {
      sending = submitDraft()
      await started
    })
    if (choice === 'withdrawn')
      await user.press(
        form.getByRole('button', { name: 'Don’t share this sighting' }),
      )
    if (choice === 'anonymous')
      await user.press(form.getByRole('checkbox', { name: 'Anonymous' }))
    // The real screen leaves after completion; avoid starting a new draft here.
    await form.unmount()
    await act(async () => {
      releaseUpload()
      expect(await sending).toEqual({ kind: 'sent' })
    })
    expect(uploadSubmissionMetadata).toHaveBeenCalled()
    expect(useSubmissionStore.getState().organizationSharing).toBeNull()
    const persisted = JSON.parse(
      (await AsyncStorage.getItem('organization-sharing-v1'))!,
    )
    expect(persisted.state.accounts.owner.outbox).toEqual(
      choice === 'unchanged'
        ? [
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
                settings: {
                  fields: DEFAULT_SHARING.fields,
                  name: '',
                  phone: '',
                },
                contactEmail: null,
                disclosureVersion: 1,
              },
            },
          ]
        : [],
    )
    expect(await getSubmissionCache('local-history')).toMatchObject({
      status: 'Submitted',
      cloud_submission_id: 'cloud-sighting',
    })
  },
)
