import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { buildGrant } from '@/src/features/organizations/lib/permissions'
import { DEFAULT_SHARING } from '@/src/shared/types/Organizations'
import { pressDialogButton } from '@/src/test-utils/dialog'
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import OrganizationScreen from '@/src/features/organizations/membership/screens/OrganizationScreen'
import MembershipsScreen from '@/src/features/organizations/membership/screens/MembershipsScreen'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import {
  fakeOrganizationsService,
  membershipSummary,
} from '@/src/test-utils/organizationsService'
import { queryWrapper } from '@/src/test-utils/queryClient'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

/**
 * Flow: opening one organization, and its privacy settings
 * From the memberships list, a member opens an organization. It shows
 * their approval status and the area it covers. Refresh updates pending
 * to approved. Shared Sightings appears only once sharing is switched on.
 * Another account never sees this member's organization.
 * Privacy settings apply to this organization only and need confirmation.
 * A revocation made offline shows as pending, even with sharing switched
 * off.
 *
 * States:
 * - Organization open: pending; area shown ("Near …"); no Members button;
 *   no second load of the memberships list.
 * - Approved: after refresh.
 * - Sharing on: Shared Sightings shown.
 * - Other account: the organization is gone.
 * - Privacy: per organization; "Revocation pending connection" when offline.
 * Events: open, refresh, sharing switched on or off, switch account,
 * change privacy, confirm.
 */

test('open an organization, refresh approval, honor sharing rollout, and clear another account’s membership', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: false })
  let status: MembershipSummary['status'] = 'pending'
  const service = await fakeOrganizationsService(() => ({
    status: 200,
    body: {
      memberships:
        useAuthStore.getState().user?.uid === 'member'
          ? [
              membershipSummary({
                organizationId: 'rescue',
                organizationName: 'Local Rescue',
                status,
                location: {
                  label: null,
                  center: { latitude: 30.2672, longitude: -97.7431 },
                },
              }),
            ]
          : [],
    },
  }))
  await renderRouter(
    {
      index: () => <MembershipsScreen />,
      'organizations/[id]/index': OrganizationScreen,
    },
    { wrapper: queryWrapper().wrapper },
  )
  await user.press(
    await screen.findByRole('button', { name: 'View Local Rescue' }),
  )
  expect(await screen.findByText('Pending approval')).toBeOnTheScreen()
  // The list and this screen share one memberships query; leaving the list
  // must not drop it while this screen shows it.
  expect(screen.queryByText('Loading organization…')).toBeNull()
  expect(service.actions()).toEqual(['memberships'])
  // No catalog label: the coverage center names the area.
  expect(screen.getByText('Near 30.27, -97.74')).toBeOnTheScreen()
  expect(screen.queryByText(/Volunteer|Display name/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Members' })).toBeNull()
  status = 'active'
  await user.press(screen.getByRole('button', { name: 'Refresh organization' }))
  expect(
    await screen.findByRole('button', { name: 'Members' }),
  ).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Shared Sightings' })).toBeNull()
  await act(async () => {
    useOrganizationsFlag.setState({ enabled: true })
  })
  expect(
    screen.getByRole('button', { name: 'Shared Sightings' }),
  ).toBeOnTheScreen()
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  expect(screen.queryByText('Near 30.27, -97.74')).toBeNull()
  expect(
    await screen.findByText('This organization is not in your memberships.'),
  ).toBeOnTheScreen()
})

test('privacy is organization-scoped and requires confirmation, including when sharing is off', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: false })
  useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
  const state = useOrganizationSharingStore.getState()
  for (const id of ['rescue', 'other']) {
    state.enqueue('member', {
      action: 'grant',
      organizationId: id,
      organizationName: id,
      requiresConfirmation: true,
      grant: buildGrant({
        organizationId: id,
        submissionId: 'sighting',
        catalogVersion: 'v1',
        epoch: 0,
        anonymous: true,
        email: null,
        settings: DEFAULT_SHARING,
      }),
    })
  }
  await fakeOrganizationsService(({ action }) =>
    action === 'memberships'
      ? {
          status: 200,
          body: {
            memberships: [membershipSummary({ organizationId: 'rescue' })],
          },
        }
      : { status: 503 },
  )
  await renderRouter(
    { 'organizations/[id]/index': OrganizationScreen },
    {
      initialUrl: '/organizations/rescue',
      wrapper: queryWrapper().wrapper,
    },
  )
  await screen.findByText('Active member')
  expect(
    screen.queryByRole('button', { name: 'Cancel sharing permission' }),
  ).toBeNull()
  await user.press(screen.getByRole('button', { name: 'Privacy settings' }))
  expect(
    screen.getAllByRole('button', { name: 'Cancel sharing permission' }),
  ).toHaveLength(1)
  expect(screen.queryByText(/other: Not shared/)).toBeNull()
  await user.press(
    screen.getByRole('button', { name: 'Cancel sharing permission' }),
  )
  expect(useUIStore.getState().dialog?.message).toContain('rescue')
  expect(useUIStore.getState().dialog?.message).toContain('sighting')
  await pressDialogButton('Cancel')
  expect(
    useOrganizationSharingStore
      .getState()
      .accounts.member.outbox.filter((item) => item.action === 'grant'),
  ).toHaveLength(2)
  await user.press(
    screen.getByRole('button', { name: 'Cancel sharing permission' }),
  )
  await pressDialogButton('Revoke')
  await waitFor(() => {
    expect(
      useOrganizationSharingStore.getState().accounts.member.outbox,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'revoke', organizationId: 'rescue' }),
        expect.objectContaining({ action: 'grant', organizationId: 'other' }),
      ]),
    )
  })
  expect(screen.getByText(/Revocation pending connection/)).toBeOnTheScreen()
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'new', email: null } })
  })
  expect(
    screen.getByRole('button', { name: 'Privacy settings' }),
  ).toBeOnTheScreen()
  expect(screen.queryByText(/Revocation pending connection/)).toBeNull()
})
