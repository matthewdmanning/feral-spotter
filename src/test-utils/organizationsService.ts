import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import type {
  Catalog,
  PermissionLedger,
} from '@/src/shared/types/Organizations'

type Body = Record<string, unknown> & { action: string }
type Reply = { status: number; body?: unknown } | Catalog | PermissionLedger
const isReply = (value: Reply): value is { status: number; body?: unknown } =>
  'status' in value && typeof value.status === 'number'

const API_URL = 'https://organizations.test/'

/**
 * Stands in for the organizations Cloud Function at the HTTP boundary, so the
 * app's own request wrapper (auth token, status mapping, account checks) runs.
 * Return a body for 200, or `{ status }` for an error response. Like the real
 * function, it answers 401 without a Bearer token. `restoreMocks` puts the
 * real `fetch` back after each test.
 */
export async function fakeOrganizationsService(
  respond: (body: Body) => Reply | Promise<Reply>,
) {
  const requests: Body[] = []
  process.env.EXPO_PUBLIC_ORGANIZATIONS_API_URL = API_URL
  // The Jest auth provider issues a token once signed in. Its sign-in also
  // publishes its own stub user, so the test's chosen user is put back.
  const { user } = useAuthStore.getState()
  await authProvider.signInWithEmail('observer@example.test', 'password')
  useAuthStore.setState({ user })
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    if (request.url !== API_URL || request.method !== 'POST')
      throw new Error(`Unexpected request: ${request.method} ${request.url}`)
    if (!/^Bearer \S+$/.test(request.headers.get('Authorization') ?? ''))
      return new Response(null, { status: 401 })
    const body = (await request.json()) as Body
    requests.push(body)
    const reply = await respond(body)
    const { status, body: json } = isReply(reply)
      ? reply
      : { status: 200, body: reply }
    return new Response(json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return {
    requests,
    actions: () => requests.map((body) => body.action),
  }
}
