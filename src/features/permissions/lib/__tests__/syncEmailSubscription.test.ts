import { http, HttpResponse } from 'msw'
import { server } from '@/src/test-utils/mswServer'

const mockGetToken = jest.fn().mockResolvedValue('id-token')
jest.mock('@/src/features/auth/lib', () => ({
  authProvider: { getToken: () => mockGetToken() },
}))

const SYNC_URL = 'https://sync.example/fn'

const loadWithUrl = (url: string | undefined) => {
  jest.resetModules()
  if (url) process.env.EXPO_PUBLIC_EMAIL_SYNC_URL = url
  else delete process.env.EXPO_PUBLIC_EMAIL_SYNC_URL
  return jest.requireActual<
    typeof import('@/src/features/permissions/lib/syncEmailSubscription')
  >('@/src/features/permissions/lib/syncEmailSubscription')
    .syncEmailSubscription
}

/** Answers the sync endpoint with `status` and records what it received. */
const serveSync = (status: number) => {
  const received: Request[] = []
  server.use(
    http.post(SYNC_URL, ({ request }) => {
      received.push(request.clone())
      return new HttpResponse(null, { status })
    }),
  )
  return received
}

describe('syncEmailSubscription', () => {
  it('does nothing when no sync URL is configured', async () => {
    const received = serveSync(200)
    await loadWithUrl(undefined)(true)
    expect(received).toHaveLength(0)
  })

  it('posts the choice with the ID token and no address', async () => {
    const received = serveSync(200)
    await loadWithUrl(SYNC_URL)(true)

    expect(received).toHaveLength(1)
    expect(received[0].headers.get('Authorization')).toBe('Bearer id-token')
    expect(await received[0].json()).toEqual({ subscribed: true })
  })

  it('rejects when the backend refuses', async () => {
    serveSync(502)
    await expect(loadWithUrl(SYNC_URL)(false)).rejects.toThrow('502')
  })
})
