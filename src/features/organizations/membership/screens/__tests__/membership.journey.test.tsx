import { act, screen, userEvent } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { AppState, type AppStateStatus } from 'react-native'
import MembershipsScreen from '@/src/features/organizations/membership/screens/MembershipsScreen'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useMembershipOrderStore } from '@/src/features/organizations/membership/hooks/useMembershipOrderStore'
import {
  fakeOrganizationsService,
  membershipSummary,
} from '@/src/test-utils/organizationsService'
import { queryWrapper } from '@/src/test-utils/queryClient'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

test('the account name is never entered or shown on cards; cards show status, members and location; switching accounts clears forms', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({
    user: { uid: 'member', email: 'private@example.test', displayName: null },
    isReady: true,
  })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: false })
  let members: MembershipSummary[] = []
  const service = await fakeOrganizationsService((body) => {
    if (body.action === 'joinOrganization')
      members = [membershipSummary({ status: 'pending', memberCount: 1 })]
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
  expect(screen.queryByLabelText('Display name')).toBeNull()
  await user.type(screen.getByLabelText('Invite code'), 'a'.repeat(32))
  // An account without a name cannot join: members would see no one.
  expect(
    screen.getByText('Your account needs a name to join an organization.'),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole('button', { name: 'Request membership' }),
  ).toBeDisabled()
  await act(async () => {
    useAuthStore.setState({
      user: { uid: 'member', email: null, displayName: 'Member name' },
    })
  })
  await user.press(screen.getByRole('button', { name: 'Request membership' }))
  expect(await screen.findByText('Pending approval')).toBeOnTheScreen()
  expect(screen.getByText('1 member')).toBeOnTheScreen()
  expect(screen.getByText('Riverside')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Cancel request' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'View Rescue' })).toBeEnabled()
  expect(
    service.requests.find((body) => body.action === 'joinOrganization'),
  ).toEqual({ action: 'joinOrganization', code: 'a'.repeat(32) })
  members[0] = { ...members[0], status: 'active', location: null }
  await user.press(screen.getByRole('button', { name: 'Refresh memberships' }))
  expect(await screen.findByText('Active member')).toBeOnTheScreen()
  expect(
    screen.getByRole('button', { name: 'Leave organization' }),
  ).toBeEnabled()
  // Members and Shared Sightings live on the organization screen only.
  expect(screen.queryByRole('button', { name: 'Members' })).toBeNull()
  expect(screen.queryByText(/Member name/)).toBeNull()
  await user.type(screen.getByLabelText('Invite code'), 'unsubmitted')
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  expect(screen.queryByText('Active member')).toBeNull()
  expect(screen.queryByDisplayValue('unsubmitted')).toBeNull()
})

const touch = (y: number) => ({
  touchHistory: {
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: 1,
    numberActiveTouches: 1,
    touchBank: [
      {
        touchActive: true,
        startPageX: 0,
        startPageY: 0,
        startTimeStamp: 0,
        currentPageX: 0,
        currentPageY: y,
        currentTimeStamp: 1,
        previousPageX: 0,
        previousPageY: 0,
        previousTimeStamp: 0,
      },
    ],
  },
})
type Handlers = Record<string, (event: unknown) => unknown>
const ROW_HEIGHT = 100
const cardOrder = (): string[] =>
  screen
    .getAllByRole('header')
    .map((header) => header.props.children)
    .filter((name) => ['Alpha', 'Beta', 'Gamma'].includes(name))

/** Drags one handle by `dy`, after giving every row, in screen order, its native layout. */
async function drag(name: string, dy: number) {
  await act(async () => {
    for (const [index, label] of cardOrder().entries())
      (
        screen.getByLabelText(`Move ${label}`).parent!.props as Handlers
      ).onLayout({
        nativeEvent: {
          layout: { x: 0, y: index * ROW_HEIGHT, width: 1, height: 88 },
        },
      })
  })
  const handle = screen.getByLabelText(`Move ${name}`).props as Handlers
  await act(async () => {
    handle.onResponderGrant(touch(0))
    handle.onResponderMove(touch(dy))
    handle.onResponderRelease(touch(dy))
  })
}

test('Arrange reorders cards by drag; Cancel discards, Save keeps the order for this account', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({
    user: { uid: 'member', email: null, displayName: 'Member' },
    isReady: true,
  })
  useUIStore.setState({ isOnline: true })
  await fakeOrganizationsService(() => ({
    status: 200,
    body: {
      memberships: ['Alpha', 'Beta', 'Gamma'].map((name) =>
        membershipSummary({ organizationId: name, organizationName: name }),
      ),
    },
  }))
  // A Stack layout renders the header that holds Arrange.
  await renderRouter(
    { _layout: () => <Stack />, index: () => <MembershipsScreen /> },
    { wrapper: queryWrapper().wrapper },
  )
  await screen.findByText('Alpha')
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  await user.press(screen.getByRole('button', { name: 'Arrange' }))
  expect(screen.queryByRole('button', { name: 'Arrange' })).toBeNull()
  expect(screen.queryByLabelText('Invite code')).toBeNull()
  await drag('Alpha', 2 * ROW_HEIGHT + 20)
  expect(cardOrder()).toEqual(['Beta', 'Gamma', 'Alpha'])
  await user.press(screen.getByRole('button', { name: 'Cancel' }))
  expect(cardOrder()).toEqual(['Alpha', 'Beta', 'Gamma'])
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()

  await user.press(screen.getByRole('button', { name: 'Arrange' }))
  await drag('Gamma', -2 * ROW_HEIGHT - 20)
  // A short drag that crosses no midpoint keeps the order.
  await drag('Beta', 10)
  await user.press(screen.getByRole('button', { name: 'Save' }))
  expect(cardOrder()).toEqual(['Gamma', 'Alpha', 'Beta'])
  expect(screen.getByLabelText('Invite code')).toBeOnTheScreen()
  expect(useMembershipOrderStore.getState().orders).toEqual({
    member: ['Gamma', 'Alpha', 'Beta'],
  })
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
  useAuthStore.setState({
    user: { uid: 'member', email: null, displayName: 'Member' },
    isReady: true,
  })
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
        memberships: [membershipSummary({ status: 'pending' })],
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
