import { Text } from 'react-native'
import { act, screen, userEvent } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { useSharedSightings } from '@/src/features/organizations/sharing/hooks/useSharedSightings'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import { queryWrapper } from '@/src/test-utils/queryClient'

function SharedView() {
  const query = useSharedSightings('org')
  return (
    <>
      {query.sightings.map((s) => (
        <Text key={s.id}>{s.id}</Text>
      ))}
      {!!query.error && <Text>{query.error}</Text>}
      <TextButton
        disabled={query.busy}
        onPress={() => {
          void query.loadMore()
        }}
      >
        More
      </TextButton>
      <TextButton
        disabled={query.busy}
        onPress={() => {
          void query.refresh()
        }}
      >
        Refresh
      </TextButton>
    </>
  )
}

test('refresh and a failed refresh keep loaded pages; revoked access clears memory-only shared results', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: true })
  let denied = false
  let unavailable = false
  await fakeOrganizationsService((body) => {
    if (denied) return { status: 403 }
    if (unavailable) return { status: 503 }
    const id = body.cursor ? 'second-shared-pin' : 'first-shared-pin'
    return {
      status: 200,
      body: {
        sightings: [
          {
            id,
            catCount: 1,
            generalLocation: { south: 1, north: 2, west: 3, east: 4 },
            photoCount: 0,
          },
        ],
        cursor: body.cursor ? null : '0:1',
      },
    }
  })
  await renderRouter({ index: SharedView }, { wrapper: queryWrapper().wrapper })
  expect(await screen.findByText('first-shared-pin')).toBeOnTheScreen()
  await user.press(screen.getByRole('button', { name: 'More' }))
  expect(await screen.findByText('second-shared-pin')).toBeOnTheScreen()
  await user.press(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('second-shared-pin')).toBeOnTheScreen()
  // A temporary outage, such as one hit by the 30 s poll, keeps what was loaded.
  unavailable = true
  await user.press(screen.getByRole('button', { name: 'Refresh' }))
  expect(
    await screen.findByText(
      'The organization service is temporarily unavailable. Please retry.',
    ),
  ).toBeOnTheScreen()
  expect(screen.getByText('first-shared-pin')).toBeOnTheScreen()
  expect(screen.getByText('second-shared-pin')).toBeOnTheScreen()
  unavailable = false
  denied = true
  await user.press(screen.getByRole('button', { name: 'Refresh' }))
  expect(screen.queryByText('first-shared-pin')).toBeNull()
  expect(screen.queryByText('second-shared-pin')).toBeNull()
  await act(async () => {
    useAuthStore.setState({ user: { uid: 'other', email: null } })
  })
  expect(screen.queryByText('first-shared-pin')).toBeNull()
})
