import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native'
import { File, Paths } from 'expo-file-system'
import { http, HttpResponse } from 'msw'
import SettingsScreen from '@/src/features/settings/screens/settings'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { server } from '@/src/test-utils/mswServer'
import { queryWrapper } from '@/src/test-utils/queryClient'

/**
 * Flow: account deletion from Settings (#433)
 * A signed-in user opens Settings and deletes their account. They choose
 * whether their Sightings go too; choosing yes asks a second time. They
 * confirm their password, the server erases the account, and the device
 * forgets it. Why it matters: Sightings must be deleted if and only if the
 * user chose so, and a failed or cancelled deletion must leave everything.
 *
 * States:
 * - Settings: the Account card shows Delete Account; signed in, data saved.
 * - Warning: "Delete your account?" with "Also delete my Sightings".
 * - Sightings warning: only when that box is checked.
 * - Password: "Confirm your password".
 * - Deleted: sent to the intro flow; signed out; no account data left in
 *   app storage or the camera cache; "Account deleted" shown.
 * - Failed: "Could not delete account"; still signed in; data kept.
 * Events: tap Delete Account, check the box, Cancel, confirm, type the
 * password, server success or failure.
 */

const URL = 'https://functions.example.com/deleteAccount'

jest.mock('@/src/shared/config/constants', () => ({
  ...jest.requireActual('@/src/shared/config/constants'),
  DELETE_ACCOUNT_URL: 'https://functions.example.com/deleteAccount',
}))

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: (href: string) => mockReplace(href),
    canDismiss: () => false,
    dismissAll: jest.fn(),
  },
}))

// The supplied mock helper is outside the package's public exports map.
const { __resetMockFileSystem } = jest.requireActual(
  require
    .resolve('expo-file-system/package.json')
    .replace('package.json', 'mocks/FileSystem.ts'),
)

let requests: unknown[]

function answerDeletion(status = 200) {
  server.use(
    http.post(URL, async ({ request }) => {
      requests.push(await request.json())
      return status === 200
        ? HttpResponse.json({ result: { deleted: true } })
        : HttpResponse.json({ error: { message: 'INTERNAL' } }, { status })
    }),
  )
}

async function seedAccount() {
  await authProvider.signInWithEmail('me@example.com', 'secret')
  useConsentStore.getState().markAccepted()
  useConsentStore.getState().setAnalyticsAccepted(true)
  useSettingsStore.getState().updateSetting('keep_photos_on_device', true)
  await AsyncStorage.setItem('submission_cache_1', '{"id":"1"}')
  new File(Paths.cache, 'capture.jpg').create()
}

async function startDeletion() {
  await render(<SettingsScreen />, { wrapper: queryWrapper().wrapper })
  await userEvent.press(screen.getByRole('button', { name: 'Delete Account' }))
}

async function confirmPassword() {
  await userEvent.type(screen.getByLabelText('Password'), 'secret')
  await userEvent.press(screen.getByRole('button', { name: 'Confirm' }))
}

beforeEach(async () => {
  __resetMockFileSystem()
  requests = []
  await seedAccount()
})

afterEach(() => authProvider.signOut())

it.each([
  [false, []],
  [true, ['Delete Sightings and Account']],
])(
  'deleteSightings=%s: deletes the account and forgets it on the device',
  async (deleteSightings, extraConfirms) => {
    answerDeletion()
    await startDeletion()
    expect(screen.getByText('Delete your account?')).toBeOnTheScreen()

    if (deleteSightings) {
      await userEvent.press(
        screen.getByRole('checkbox', { name: 'Also delete my Sightings' }),
      )
    }
    await userEvent.press(
      screen.getAllByRole('button', { name: 'Delete Account' }).at(-1)!,
    )
    for (const name of extraConfirms) {
      expect(screen.getByText('Delete your Sightings too?')).toBeOnTheScreen()
      await userEvent.press(screen.getByRole('button', { name }))
    }
    await confirmPassword()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/intro-flow'))
    expect(requests).toEqual([{ data: { deleteSightings } }])
    expect(useAuthStore.getState().user).toBeNull()
    // Only ui-store (connectivity) is written again, by the success dialog.
    const keys = await AsyncStorage.getAllKeys()
    expect(keys.filter((key) => key !== 'ui-store')).toEqual([])
    expect(useConsentStore.getState().accepted).toBe(false)
    expect(useConsentStore.getState().analyticsAccepted).toBeNull()
    expect(new File(Paths.cache, 'capture.jpg').exists).toBe(false)
    expect(useUIStore.getState().dialog?.title).toBe('Account deleted')
  },
)

it('checking the box asks a second time; Cancel there deletes nothing', async () => {
  answerDeletion()
  await startDeletion()
  await userEvent.press(
    screen.getByRole('checkbox', { name: 'Also delete my Sightings' }),
  )
  await userEvent.press(
    screen.getAllByRole('button', { name: 'Delete Account' }).at(-1)!,
  )

  await userEvent.press(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByText('Delete your Sightings too?')).toBeNull()
  expect(requests).toEqual([])
  expect(useAuthStore.getState().user).not.toBeNull()
})

it('a server failure keeps the account and its data', async () => {
  answerDeletion(500)
  await startDeletion()
  await userEvent.press(
    screen.getAllByRole('button', { name: 'Delete Account' }).at(-1)!,
  )
  await confirmPassword()

  await waitFor(() =>
    expect(useUIStore.getState().dialog?.title).toBe(
      'Could not delete account',
    ),
  )
  expect(useAuthStore.getState().user).not.toBeNull()
  expect(useConsentStore.getState().analyticsAccepted).toBe(true)
  expect(await AsyncStorage.getItem('submission_cache_1')).not.toBeNull()
  expect(new File(Paths.cache, 'capture.jpg').exists).toBe(true)
  expect(mockReplace).not.toHaveBeenCalled()
})
