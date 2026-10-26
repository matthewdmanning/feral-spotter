import { createEmailOctopusProvider } from '../emailOctopus'
import { createEmailListProvider } from '../index'
import { setEmailSubscription } from '../setEmailSubscription'
import type { EmailListProvider } from '../EmailListProvider'

const config = { apiKey: 'k', listId: 'L' }
const fakeFetch = (ok: boolean, status = 200) =>
  jest.fn().mockResolvedValue({ ok, status }) as jest.Mock & typeof fetch
const sentBody = (f: jest.Mock) => JSON.parse(f.mock.calls[0][1].body)

describe('EmailOctopus provider', () => {
  it.each([
    [true, 'subscribed'],
    [false, 'pending'],
  ])(
    'subscribes a verified=%s address as %s',
    async (emailVerified, status) => {
      const fetchImpl = fakeFetch(true)
      await createEmailOctopusProvider(config, fetchImpl).subscribe('a@b.com', {
        emailVerified,
      })

      expect(fetchImpl).toHaveBeenCalledWith(
        'https://api.emailoctopus.com/lists/L/contacts',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ Authorization: 'Bearer k' }),
        }),
      )
      expect(sentBody(fetchImpl)).toEqual({ email_address: 'a@b.com', status })
    },
  )

  it('unsubscribes', async () => {
    const fetchImpl = fakeFetch(true)
    await createEmailOctopusProvider(config, fetchImpl).unsubscribe('a@b.com')
    expect(sentBody(fetchImpl).status).toBe('unsubscribed')
  })

  it('throws when the service rejects the request', async () => {
    await expect(
      createEmailOctopusProvider(config, fakeFetch(false, 401)).unsubscribe(
        'a@b.com',
      ),
    ).rejects.toThrow('401')
  })
})

describe('createEmailListProvider', () => {
  it('rejects an unknown provider name', () => {
    expect(() => createEmailListProvider('nope', config)).toThrow(
      'Unknown email provider: nope',
    )
  })
})

describe('setEmailSubscription', () => {
  const provider: jest.Mocked<EmailListProvider> = {
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  }
  const verify = jest
    .fn()
    .mockResolvedValue({ email: 'me@x.com', email_verified: true })
  const call = (authorization: string | undefined, body: unknown) =>
    setEmailSubscription({ authorization, body }, provider, verify)

  beforeEach(() => jest.clearAllMocks())

  it('subscribes the token address, ignoring any address in the body', async () => {
    const result = await call('Bearer t', {
      subscribed: true,
      email: 'victim@x.com',
    })
    expect(result.status).toBe(204)
    expect(provider.subscribe).toHaveBeenCalledWith('me@x.com', {
      emailVerified: true,
    })
  })

  it('unsubscribes', async () => {
    await call('Bearer t', { subscribed: false })
    expect(provider.unsubscribe).toHaveBeenCalledWith('me@x.com')
  })

  it.each([
    ['no token', undefined, { subscribed: true }, 401],
    ['bad body', 'Bearer t', { subscribed: 'yes' }, 400],
  ])('rejects %s', async (_name, authorization, body, status) => {
    expect((await call(authorization, body)).status).toBe(status)
    expect(provider.subscribe).not.toHaveBeenCalled()
  })

  it('rejects an invalid token', async () => {
    verify.mockRejectedValueOnce(new Error('expired'))
    expect((await call('Bearer t', { subscribed: true })).status).toBe(401)
  })
})
