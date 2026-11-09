import { http, HttpResponse } from 'msw'
import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { server } from '@/src/test-utils/mswServer'
import type {
  Catalog,
  PermissionLedger,
} from '@/src/shared/types/Organizations'

type Body = Record<string, unknown> & { action: string }
type Reply = { status: number; body?: unknown } | Catalog | PermissionLedger
const isReply = (value: Reply): value is { status: number; body?: unknown } =>
  'status' in value && typeof value.status === 'number'

export const ORGANIZATIONS_API_URL = 'https://organizations.test/'

/**
 * Stands in for the organizations Cloud Function at the HTTP boundary (an
 * MSW handler), so the app's own request wrapper (auth token, status mapping,
 * account checks) runs. Return a body for 200, or `{ status }` for an error
 * response. Like the real function, it answers 401 without a Bearer token.
 * Any other URL or method is unhandled and fails the test.
 */
export async function fakeOrganizationsService(
  respond: (body: Body) => Reply | Promise<Reply>,
) {
  const requests: Body[] = []
  process.env.EXPO_PUBLIC_ORGANIZATIONS_API_URL = ORGANIZATIONS_API_URL
  // The Jest auth provider issues a token once signed in. Its sign-in also
  // publishes its own stub user, so the test's chosen user is put back.
  const { user } = useAuthStore.getState()
  await authProvider.signInWithEmail('observer@example.test', 'password')
  useAuthStore.setState({ user })
  server.use(
    http.post(ORGANIZATIONS_API_URL, async ({ request }) => {
      if (!/^Bearer \S+$/.test(request.headers.get('Authorization') ?? ''))
        return new HttpResponse(null, { status: 401 })
      const body = (await request.json()) as Body
      requests.push(body)
      const reply = await respond(body)
      const { status, body: json } = isReply(reply)
        ? reply
        : { status: 200, body: reply }
      return json === undefined
        ? new HttpResponse(null, { status })
        : HttpResponse.json(json, { status })
    }),
  )
  return {
    requests,
    actions: () => requests.map((body) => body.action),
  }
}
