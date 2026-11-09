import { act, screen, userEvent } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import MembershipsScreen from '@/src/features/organizations/membership/screens/MembershipsScreen'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

test('join, approval refresh and name editing work while sharing is off; account switching clears names and forms', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({
    user: { uid: 'member', email: 'private@example.test' },
    isReady: true,
  })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: false })
  let members: MembershipSummary[] = []
  const service = await fakeOrganizationsService((body) => {
    if (body.action === 'joinOrganization')
      members = [
        {
          organizationId: 'org',
          organizationName: 'Rescue',
          displayName: String(body.displayName),
          status: 'pending',
          leaving: false,
        },
      ]
    if (body.action === 'renameMember')
      members[0] = { ...members[0], displayName: String(body.displayName) }
    return {
      status: 200,
      body: {
        memberships:
          useAuthStore.getState().user?.uid === 'member' ? members : [],
      },
    }
  })
  await renderRouter({ index: () => <MembershipsScreen /> })
  await user.type(screen.getByLabelText('Invite code'), 'a'.repeat(32))
  await user.type(screen.getByLabelText('Display name'), 'Member name')
  await user.press(screen.getByRole('button', { name: 'Request membership' }))
  expect(await screen.findByText('pending')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Members' })).toBeNull()
  members[0] = { ...members[0], status: 'active' }
  await user.press(screen.getByRole('button', { name: 'Refresh memberships' }))
  expect(
    await screen.findByRole('button', { name: 'Members' }),
  ).toBeOnTheScreen()
  await user.clear(screen.getByLabelText('Display name for Rescue'))
  await user.type(
    screen.getByLabelText('Display name for Rescue'),
    'Updated name',
  )
  await user.press(screen.getByRole('button', { name: 'Save display name' }))
  expect(await screen.findByDisplayValue('Updated name')).toBeOnTheScreen()
  expect(
    service.requests.find((body) => body.action === 'joinOrganization'),
  ).toMatchObject({ code: 'a'.repeat(32), displayName: 'Member name' })
  await user.type(screen.getByLabelText('Display name'), 'Unsubmitted name')
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  expect(screen.queryByDisplayValue('Updated name')).toBeNull()
  expect(screen.queryByDisplayValue('Unsubmitted name')).toBeNull()
})
