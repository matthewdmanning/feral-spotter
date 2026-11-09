const mockGetToken = jest.fn().mockResolvedValue('id-token')
jest.mock('@/src/features/auth/lib', () => ({
  authProvider: { getToken: () => mockGetToken() },
}))

const loadWithUrl = (url: string | undefined) => {
  jest.resetModules()
  if (url) process.env.EXPO_PUBLIC_EMAIL_SYNC_URL = url
  else delete process.env.EXPO_PUBLIC_EMAIL_SYNC_URL
  return jest.requireActual<
    typeof import('@/src/features/permissions/lib/syncEmailSubscription')
  >('@/src/features/permissions/lib/syncEmailSubscription')
    .syncEmailSubscription
}

describe('syncEmailSubscription', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>
  beforeEach(() => {
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected fetch'))
  })

  it('does nothing when no sync URL is configured', async () => {
    await loadWithUrl(undefined)(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the choice with the ID token and no address', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    await loadWithUrl('https://sync.example/fn')(true)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sync.example/fn',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
        body: JSON.stringify({ subscribed: true }),
      }),
    )
  })

  it('rejects when the backend refuses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }))
    await expect(loadWithUrl('https://sync.example/fn')(false)).rejects.toThrow(
      '502',
    )
  })
})
