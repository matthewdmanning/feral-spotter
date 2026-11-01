import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import type { Catalog, PermissionLedger } from '@/src/types/Organizations'

type Body = Record<string, unknown> & { action: string }
type Reply = { status: number; body?: unknown } | Catalog | PermissionLedger
const isReply = (value: Reply): value is { status: number; body?: unknown } =>
  'status' in value && typeof value.status === 'number'

/**
 * Stands in for the organizations Cloud Function at the HTTP boundary, so the
 * app's own request wrapper (auth token, status mapping, account checks) runs.
 * Return a body for 200, or `{ status }` for an error response.
 */
export async function fakeOrganizationsService(
  respond: (body: Body) => Reply | Promise<Reply>,
) {
  const requests: Body[] = []
  process.env.EXPO_PUBLIC_ORGANIZATIONS_API_URL = 'https://organizations.test/'
  // The Jest auth provider issues a token once signed in. Its sign-in also
  // publishes its own stub user, so the test's chosen user is put back.
  const { user } = useAuthStore.getState()
  await authProvider.signInWithEmail('observer@example.test', 'password')
  useAuthStore.setState({ user })
  // Jest gives each test file its own global, so this never leaks between files.
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body
    requests.push(body)
    const reply = await respond(body)
    const { status, body: json } = isReply(reply)
      ? reply
      : { status: 200, body: reply }
    return { ok: status < 300, status, json: async () => json }
  }) as unknown as typeof fetch
  return {
    requests,
    actions: () => requests.map((body) => body.action),
  }
}
