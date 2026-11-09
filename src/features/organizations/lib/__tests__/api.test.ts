import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { http, HttpResponse } from 'msw'
import {
  fakeOrganizationsService,
  ORGANIZATIONS_API_URL,
} from '@/src/test-utils/organizationsService'
import { server } from '@/src/test-utils/mswServer'
import { organizationRequest } from '@/src/features/organizations/lib/api'

beforeEach(async () => {
  useAuthStore.setState({ user: { uid: 'owner', email: null }, isReady: true })
  await fakeOrganizationsService(() => ({ status: 200, body: {} }))
})

test('a timed-out token lookup settles without sending credentials later', async () => {
  jest.useFakeTimers()
  let completeToken: (token: string) => void = () => {}
  jest.spyOn(authProvider, 'getToken').mockImplementation(
    () =>
      new Promise((resolve) => {
        completeToken = resolve
      }),
  )
  const sent = jest.spyOn(globalThis, 'fetch')
  try {
    const request = organizationRequest({ action: 'catalog' }, 'owner')
    const rejected = expect(request).rejects.toMatchObject({
      status: 408,
      retryable: true,
    })
    await jest.advanceTimersByTimeAsync(15000)
    await rejected
    completeToken('late-token')
    await Promise.resolve()
    expect(sent).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

test('account switching during JSON parsing cannot publish another account’s response', async () => {
  let complete: (value: unknown) => void = () => {}
  let parsing: () => void = () => {}
  const parseStarted = new Promise<void>((resolve) => {
    parsing = resolve
  })
  // The body arrives only when the test sends it, holding parsing open.
  server.use(
    http.post(ORGANIZATIONS_API_URL, () => {
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            parsing()
            complete = (value) => {
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(value)),
              )
              controller.close()
            }
          },
        },
        { highWaterMark: 0 },
      )
      return new HttpResponse(body, {
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  const request = organizationRequest({ action: 'memberships' }, 'owner')
  const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' })
  await parseStarted
  useAuthStore.setState({ user: { uid: 'other', email: null } })
  complete({ memberships: [{ displayName: 'Private name' }] })
  await rejected
})
