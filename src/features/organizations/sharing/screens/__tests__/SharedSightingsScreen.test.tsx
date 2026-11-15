import { act, screen, userEvent } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import SharedSightingsScreen from '@/src/features/organizations/sharing/screens/SharedSightingsScreen'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import { queryWrapper } from '@/src/test-utils/queryClient'

/**
 * Review regressions: shared cat details showed schema keys and raw values
 * ("ear_tipped: yes"), counts read "1 cats", and every photo was requested at
 * once from a single-instance function.
 */
test('a selected sighting shows readable cat details and loads its photos one at a time', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: true })
  let releasePhoto: () => void = () => {}
  const service = await fakeOrganizationsService((body) => {
    if (body.action === 'sharedPhoto')
      return new Promise((resolve) => {
        releasePhoto = () =>
          resolve({ status: 200, body: { image: 'data:image/jpeg;base64,' } })
      })
    return {
      status: 200,
      body: {
        sightings: [
          {
            id: 'pin',
            catCount: 1,
            generalLocation: { south: 1, north: 1.01, west: 2, east: 2.01 },
            cats: [{ ear_tipped: 'yes', age: 'adult' }],
            photoCount: 2,
          },
        ],
        cursor: null,
      },
    }
  })
  await renderRouter(
    { 'organizations/[id]/sightings': SharedSightingsScreen },
    {
      initialUrl: '/organizations/org/sightings',
      wrapper: queryWrapper().wrapper,
    },
  )
  await user.press(
    await screen.findByRole('button', {
      name: 'Sighting 1: 1 cat · Approximate area',
    }),
  )
  expect(screen.getByText('Ear Tipped')).toBeOnTheScreen()
  expect(screen.getByText('Yes')).toBeOnTheScreen()
  expect(screen.getByText('Adult')).toBeOnTheScreen()
  expect(screen.queryByText(/ear_tipped/)).toBeNull()
  const photoRequests = () =>
    service.requests.filter((body) => body.action === 'sharedPhoto')
  expect(photoRequests()).toHaveLength(1)
  await act(async () => releasePhoto())
  expect(photoRequests().map((body) => body.index)).toEqual([0, 1])
})
