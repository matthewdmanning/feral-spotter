import { act, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { router } from 'expo-router'
import { Text } from 'react-native'
import RootLayout from '@/src/app/_layout'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'

jest.mock('@/src/shared/config/unistyles', () => ({}))
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'),
)
jest.mock('@/src/providers/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@expo-google-fonts/nunito/useFonts', () => ({
  useFonts: () => [true, null],
}))

const routes = {
  _layout: RootLayout,
  index: () => <Text>Home route</Text>,
  'organizations/index': () => <Text>Organizations route</Text>,
}

it.each([false, true])(
  'opens the Organizations route only while Organizations is %s',
  async (enabled) => {
    useOrganizationsFlag.setState({ enabled })
    await renderRouter(routes, { initialUrl: '/' })
    await screen.findByText('Home route')
    await act(async () => {
      router.push('/organizations')
    })
    expect(screen.queryByText('Organizations route') !== null).toBe(enabled)
  },
)

it('turning Organizations off leaves its open route', async () => {
  useOrganizationsFlag.setState({ enabled: true })
  await renderRouter(routes, { initialUrl: '/organizations' })
  await screen.findByText('Organizations route')
  await act(async () => {
    useOrganizationsFlag.setState({ enabled: false })
  })
  expect(screen.queryByText('Organizations route')).toBeNull()
  expect(screen.getByText('Home route')).toBeOnTheScreen()
})
