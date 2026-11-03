import { handleDeleteAccount } from '../erasure/deleteAccount'
import type { ErasurePorts } from '../erasure/eraseAccount'

/**
 * #433's rules, at the callable: Sightings go if and only if the user chose
 * so at the guard; email and analytics always go; the Auth user goes last,
 * so a failure leaves an account to retry from; the caller can only delete
 * themselves, and only right after signing in.
 */

const NOW = 1_800_000_000

function fakePorts(failAt?: string) {
  const calls: string[] = []
  const step = (name: string) => async () => {
    calls.push(name)
    if (failAt === name) throw new Error(`${name} down`)
  }
  const ports: ErasurePorts = {
    email: {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      remove: step('email'),
    },
    analytics: { erasePerson: step('analytics') },
    submissions: { deleteUserSubmissions: step('sightings') },
    accounts: { deleteUser: step('auth') },
  }
  return { ports, calls }
}

const request = (data: unknown, authTime = NOW - 60) => ({
  auth: { uid: 'u1', token: { email: 'me@x.com', auth_time: authTime } },
  data,
})

it.each([
  [true, ['email', 'analytics', 'sightings', 'auth']],
  [false, ['email', 'analytics', 'auth']],
])('deleteSightings=%s erases in order: %j', async (deleteSightings, order) => {
  const { ports, calls } = fakePorts()
  await handleDeleteAccount(request({ deleteSightings }), ports, NOW)
  expect(calls).toEqual(order)
})

it('keeps the Auth user when an earlier step fails', async () => {
  const { ports, calls } = fakePorts('analytics')
  await expect(
    handleDeleteAccount(request({ deleteSightings: true }), ports, NOW),
  ).rejects.toThrow('analytics down')
  expect(calls).not.toContain('auth')
})

it.each([
  [
    'signed out',
    { auth: undefined, data: { deleteSightings: true } },
    'unauthenticated',
  ],
  ['no choice', request({}), 'invalid-argument'],
  [
    'stale sign-in',
    request({ deleteSightings: false }, NOW - 3600),
    'failed-precondition',
  ],
])(
  'refuses a %s request before erasing anything',
  async (_label, req, code) => {
    const { ports, calls } = fakePorts()
    await expect(handleDeleteAccount(req, ports, NOW)).rejects.toMatchObject({
      code,
    })
    expect(calls).toEqual([])
    expect(HttpsError).toBeDefined()
  },
)
