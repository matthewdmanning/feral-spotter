import { act, render, screen, userEvent } from '@testing-library/react-native'
import { LeaveChoices } from '@/src/features/organizations/membership/components/LeaveChoices'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import { DEFAULT_SHARING } from '@/src/shared/types/Organizations'
import type { LeaveChoice } from '@/functions/src/organizations/membership/domain'

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'member', email: 'member@example.test' },
    isReady: true,
  })
})

test('default leaving revokes everything, while retained sharing needs explicit field review', async () => {
  const user = userEvent.setup()
  const choices: LeaveChoice[] = []
  const onLeave = async (choice: LeaveChoice) => {
    choices.push(choice)
    return true
  }
  await fakeOrganizationsService((body) => {
    expect(body.action).toBe('reviewLeaving')
    return {
      status: 200,
      body: { epoch: 2, catalogVersion: 'current', shareCount: 3 },
    }
  })
  await render(
    <LeaveChoices
      uid="member"
      organizationId="org"
      busy={false}
      onLeave={onLeave}
    />,
  )
  expect(
    screen.getByRole('checkbox', {
      name: 'Keep sharing my existing Sightings',
    }),
  ).not.toBeChecked()
  await user.press(
    screen.getByRole('button', { name: 'Leave and unshare all my Sightings' }),
  )
  expect(choices[0]).toMatchObject({ mode: 'revoke' })
  await user.press(
    screen.getByRole('checkbox', {
      name: 'Keep sharing my existing Sightings',
    }),
  )
  expect(
    screen.getByRole('button', { name: 'Confirm sharing and leave' }),
  ).toBeDisabled()
  await user.press(screen.getByRole('checkbox', { name: 'Share photos' }))
  await user.press(
    screen.getByRole('button', { name: 'Review retained sharing' }),
  )
  expect(
    await screen.findByText(
      'Confirm these choices for 3 existing Sightings before leaving.',
    ),
  ).toBeOnTheScreen()
  await user.press(screen.getByRole('checkbox', { name: 'Share cat details' }))
  expect(
    screen.getByRole('button', { name: 'Confirm sharing and leave' }),
  ).toBeDisabled()
  await user.press(
    screen.getByRole('button', { name: 'Review retained sharing' }),
  )
  await user.press(
    screen.getByRole('button', { name: 'Confirm sharing and leave' }),
  )
  expect(choices[1]).toMatchObject({
    mode: 'keep',
    anonymous: true,
    epoch: 2,
    settings: { fields: { photos: true, catDetails: true } },
  })
})

test('server-confirmed leaving removes queued organization actions without affecting other organizations', async () => {
  const store = useOrganizationSharingStore.getState()
  store.configure('member', DEFAULT_SHARING)
  for (const organizationId of ['org', 'other'])
    store.enqueue('member', { action: 'revokeOrganization', organizationId })
  await act(async () => {
    store.acceptLedger('member', 'org', { epochs: { org: 1 }, permissions: [] })
  })
  const account = useOrganizationSharingStore.getState().accounts.member
  expect(account.outbox.map((item) => item.organizationId)).toEqual(['other'])
  expect(account.ledger.epochs.org).toBe(1)
})
