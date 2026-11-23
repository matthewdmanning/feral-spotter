import { act, render, screen } from '@testing-library/react-native'
import SightingDetailScreen from '@/src/features/history/screens/sightingDetail/index'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { buildGrant } from '@/src/features/organizations/lib/permissions'
import { DEFAULT_SHARING } from '@/src/shared/types/Organizations'
import { organizationCopy } from '@/src/shared/config/text'
import {
  createSubmissionCache,
  updateSubmissionCache,
} from '@/src/shared/lib/submissionCache'
import { observedCat } from '@/src/test-utils/catFixtures'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sighting' }),
}))

it.each(['cloud-sighting', undefined])(
  'keeps sighting-level permissions before cats when cloud id is %s',
  async (cloudSubmissionId) => {
    useAuthStore.setState({
      user: { uid: 'owner', email: 'observer@example.test' },
      isReady: true,
    })
    useOrganizationsFlag.setState({ enabled: true })
    useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
    useOrganizationSharingStore.getState().enqueue('owner', {
      action: 'grant',
      organizationId: 'rescue',
      organizationName: 'Rescue',
      requiresConfirmation: true,
      grant: buildGrant({
        submissionId: 'cloud-sighting',
        organizationId: 'rescue',
        catalogVersion: 'v1',
        epoch: 0,
        anonymous: false,
        settings: DEFAULT_SHARING,
        email: 'observer@example.test',
      }),
    })
    await fakeOrganizationsService(() => ({ epochs: {}, permissions: [] }))
    await createSubmissionCache('sighting', {
      location_method: 'pin',
      time_method: 'device',
    })
    await updateSubmissionCache('sighting', {
      status: 'Submitted',
      cloud_submission_id: cloudSubmissionId,
      cats: [observedCat()],
    })

    await render(<SightingDetailScreen />)
    await screen.findByText('Cats Recorded')
    if (cloudSubmissionId) {
      await act(async () => {
        await useOrganizationSharingStore.getState().sync('owner')
      })
      expect(
        screen
          .getAllByText(/^(Organization permissions|Cats Recorded)$/i)
          .map((node) => node.props.children),
      ).toEqual([organizationCopy.permissions.title, 'Cats Recorded'])
    } else {
      expect(screen.queryByText(organizationCopy.permissions.title)).toBeNull()
    }
  },
)
