import { act, screen, userEvent } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { AppState, type AppStateStatus } from 'react-native'
import MembershipsScreen from '@/src/features/organizations/membership/screens/MembershipsScreen'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import { queryWrapper } from '@/src/test-utils/queryClient'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

test('join and approval refresh work with a read-only display name while sharing is off; account switching clears names and forms', async () => {
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
    return {
      status: 200,
      body: {
        memberships:
          useAuthStore.getState().user?.uid === 'member' ? members : [],
      },
    }
  })
  await renderRouter(
    { index: () => <MembershipsScreen /> },
    { wrapper: queryWrapper().wrapper },
  )
  await screen.findByText('No memberships or pending requests.')
  await user.type(screen.getByLabelText('Invite code'), 'a'.repeat(32))
  await user.type(screen.getByLabelText('Display name'), 'Member name')
  await user.press(screen.getByRole('button', { name: 'Request membership' }))
  expect(await screen.findByText('Pending approval')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Members' })).toBeNull()
  members[0] = { ...members[0], status: 'active' }
  await user.press(screen.getByRole('button', { name: 'Refresh memberships' }))
  expect(
    await screen.findByRole('button', { name: 'Members' }),
  ).toBeOnTheScreen()
  expect(screen.getByText('Display name: Member name')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Display name for Rescue')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save display name' })).toBeNull()
  expect(
    service.requests.find((body) => body.action === 'joinOrganization'),
  ).toMatchObject({ code: 'a'.repeat(32), displayName: 'Member name' })
  await user.type(screen.getByLabelText('Display name'), 'Unsubmitted name')
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  expect(screen.queryByText('Display name: Member name')).toBeNull()
  expect(screen.queryByDisplayValue('Unsubmitted name')).toBeNull()
})

test('initial loading is distinct from empty and a failed request offers recovery', async () => {
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  let finish: (result: { status: number }) => void = () => {}
  await fakeOrganizationsService(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await renderRouter(
    { index: () => <MembershipsScreen /> },
    { wrapper: queryWrapper().wrapper },
  )
  expect(screen.getByText('Loading memberships…')).toBeOnTheScreen()
  expect(screen.queryByText('No memberships or pending requests.')).toBeNull()
  await act(async () => {
    finish({ status: 503 })
  })
  expect(
    await screen.findByText(
      'The organization service is temporarily unavailable. Please retry.',
    ),
  ).toBeOnTheScreen()
  expect(screen.queryByText('No memberships or pending requests.')).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Refresh memberships' }),
  ).toBeEnabled()
})

test('foreground refresh cannot discard an in-flight membership mutation', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  // The native lifecycle boundary supplies events; application request/store logic stays real.
  const listeners = new Set<(state: AppStateStatus) => void>()
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      listeners.add(listener)
      return {
        remove: () => {
          listeners.delete(listener)
        },
      }
    })
  let finish: (reply: { status: number; body: unknown }) => void = () => {}
  const service = await fakeOrganizationsService((body) =>
    body.action === 'joinOrganization'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : { status: 200, body: { memberships: [] } },
  )
  await renderRouter(
    { index: () => <MembershipsScreen /> },
    { wrapper: queryWrapper().wrapper },
  )
  await screen.findByText('No memberships or pending requests.')
  await user.type(screen.getByLabelText('Invite code'), 'a'.repeat(32))
  await user.type(screen.getByLabelText('Display name'), 'Member')
  await user.press(screen.getByRole('button', { name: 'Request membership' }))
  await act(async () => {
    listeners.forEach((listener) => listener('background'))
    listeners.forEach((listener) => listener('active'))
  })
  expect(
    screen.getByRole('button', { name: 'Refresh memberships' }),
  ).toBeDisabled()
  await act(async () => {
    finish({
      status: 200,
      body: {
        memberships: [
          {
            organizationId: 'org',
            organizationName: 'Rescue',
            displayName: 'Member',
            status: 'pending',
            leaving: false,
          },
        ],
      },
    })
  })
  expect(await screen.findByText('Pending approval')).toBeOnTheScreen()
  expect(
    service.actions().filter((action) => action === 'joinOrganization'),
  ).toHaveLength(1)
  expect(
    service.actions().filter((action) => action === 'memberships'),
  ).toHaveLength(1)
})
