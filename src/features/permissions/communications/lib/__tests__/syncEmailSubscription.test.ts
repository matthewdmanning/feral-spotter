const mockGetToken = jest.fn().mockResolvedValue('id-token')
jest.mock('@/src/features/auth/lib', () => ({
  authProvider: { getToken: () => mockGetToken() },
}))

const loadWithUrl = (url: string | undefined) => {
  jest.resetModules()
  if (url) process.env.EXPO_PUBLIC_EMAIL_SYNC_URL = url
  else delete process.env.EXPO_PUBLIC_EMAIL_SYNC_URL
  return require('@/src/features/permissions/communications/lib/syncEmailSubscription').syncEmailSubscription as (
    subscribed: boolean,
  ) => Promise<void>
}

describe('syncEmailSubscription', () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock
  })

  it('does nothing when no sync URL is configured', async () => {
    await loadWithUrl(undefined)(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the choice with the ID token and no address', async () => {
    fetchMock.mockResolvedValue({ ok: true })
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
    fetchMock.mockResolvedValue({ ok: false, status: 502 })
    await expect(loadWithUrl('https://sync.example/fn')(false)).rejects.toThrow(
      '502',
    )
  })
})
