import type { Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { DEFAULT_SHARING } from '../domain'

const mockObjects = new Map<string, { generation: number; text: string }>()
let mockConflict = false
const mockReads: string[] = []
const mockVerify = jest.fn(async (token: string) => {
  if (token === 'invalid') throw new Error('invalid token')
  return { uid: token, email: `${token}@example.com` }
})
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mockVerify }),
}))
jest.mock('firebase-functions/params', () => ({
  defineString: (_name: string, config: { default: string }) => ({
    value: () => config.default,
  }),
}))
jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string, options?: { generation: number }) => ({
        getMetadata: async () => {
          const value = mockObjects.get(path)
          if (!value) throw Object.assign(new Error('missing'), { code: 404 })
          return [{ generation: String(value.generation) }]
        },
        download: async () => {
          mockReads.push(path)
          const value = mockObjects.get(path)
          if (!value || (options && options.generation !== value.generation))
            throw Object.assign(new Error('missing'), { code: 404 })
          return [Buffer.from(value.text)]
        },
        save: async (
          text: string,
          config: { preconditionOpts: { ifGenerationMatch: number } },
        ) => {
          const value = mockObjects.get(path)
          if (mockConflict) {
            mockConflict = false
            throw Object.assign(new Error('conflict'), { code: 412 })
          }
          if (
            (value?.generation ?? 0) !==
            config.preconditionOpts.ifGenerationMatch
          )
            throw Object.assign(new Error('conflict'), { code: 412 })
          mockObjects.set(path, {
            generation: (value?.generation ?? 0) + 1,
            text,
          })
        },
      }),
    }),
  }),
}))
import { handleOrganizationsRequest } from '../api'

async function request(body: unknown, token: string | null = 'owner') {
  const result = { code: 200, body: undefined as unknown }
  const req = {
    method: 'POST',
    body,
    header: () => (token == null ? undefined : `Bearer ${token}`),
  } as unknown as Request
  const res = {
    set: () => res,
    status: (code: number) => {
      result.code = code
      return res
    },
    json: (value: unknown) => {
      result.body = value
      return res
    },
    end: () => res,
  } as unknown as Response
  await handleOrganizationsRequest(req, res)
  return result
}
function seed(path: string, value: unknown) {
  mockObjects.set(path, { generation: 1, text: JSON.stringify(value) })
}
const grant = () => ({
  action: 'grant',
  organizationId: 'rescue',
  mutationId: 'grant-one',
  grant: {
    organizationId: 'rescue',
    submissionId: 'sighting',
    catalogVersion: 'v1',
    epoch: 0,
    anonymous: true,
    settings: {
      ...DEFAULT_SHARING,
      fields: {
        ...DEFAULT_SHARING.fields,
        name: true,
        email: true,
        phone: true,
      },
      name: 'Private',
      phone: '123',
    },
    injured: false,
    disclosureVersion: 1,
  },
})

beforeEach(() => {
  mockObjects.clear()
  mockReads.length = 0
  mockConflict = false
  mockVerify.mockClear()
  seed('organizations/catalog.json', {
    version: 'v1',
    organizations: [
      {
        id: 'rescue',
        name: 'Rescue',
        active: true,
        coverage: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  })
  seed('submissions/owner/sighting/metadata.json', {
    submission: { latitude: 0.5, longitude: 0.5, report_injured: true },
    cats: [{ health_label: 'poor', local_id: 'secret' }],
    photo_paths: ['submissions/owner/sighting/cat.jpg'],
  })
})

test('authentication and ownership are checked before accessing another user’s data', async () => {
  expect((await request(grant(), null)).code).toBe(401)
  expect((await request(grant(), 'invalid')).code).toBe(401)
  expect((await request(grant(), 'attacker')).code).toBe(503)
  expect(mockReads).not.toContain('submissions/owner/sighting/metadata.json')
  expect(mockObjects.has('organization-permissions/attacker/ledger.json')).toBe(
    false,
  )
})

test('server minimizes data, derives injury from the actual submission, and retries generation conflicts', async () => {
  mockConflict = true
  const result = await request(grant())
  expect(result.code).toBe(200)
  const permission = (result.body as { permissions: unknown[] }).permissions[0]
  expect(permission).toMatchObject({
    anonymous: true,
    injured: true,
    fields: { name: false, email: false, phone: false },
    data: { catCount: 1 },
  })
  expect(JSON.stringify((permission as { data: unknown }).data)).not.toMatch(
    /Private|owner@example|cat.jpg|preciseLocation/,
  )
})

test('catalog changes and out-of-area submissions require a fresh decision', async () => {
  const stale = grant()
  stale.grant.catalogVersion = 'old'
  expect((await request(stale)).code).toBe(409)
  seed('submissions/owner/sighting/metadata.json', {
    submission: { latitude: 8, longitude: 8 },
    cats: [{}],
    photo_paths: [],
  })
  expect((await request(grant())).code).toBe(409)
  expect(mockObjects.has('organization-permissions/owner/ledger.json')).toBe(
    false,
  )
})

test('mutation retries remain idempotent after a catalog change and revocation', async () => {
  await request(grant())
  const revoke = {
    action: 'revokeOrganization',
    organizationId: 'rescue',
    mutationId: 'revoke-one',
  }
  await request(revoke)
  const retry = await request(revoke)
  expect((retry.body as { epochs: Record<string, number> }).epochs.rescue).toBe(
    1,
  )
  mockObjects.delete('organizations/catalog.json')
  const replay = await request(grant())
  expect(replay.code).toBe(200)
  expect(
    (replay.body as { permissions: { revokedAt?: string }[] }).permissions[0]
      .revokedAt,
  ).toBeDefined()
})

test('missing catalog is an empty production directory', async () => {
  mockObjects.delete('organizations/catalog.json')
  expect((await request({ action: 'catalog' })).body).toEqual({
    version: 'empty-v1',
    organizations: [],
    cacheRadiusKm: 50,
  })
})

test('capacity limits reject new grants but never prevent revoking existing permissions', async () => {
  await request(grant())
  const path = 'organization-permissions/owner/ledger.json'
  const saved = JSON.parse(mockObjects.get(path)!.text)
  seed(path, {
    ...saved,
    applied: Array.from({ length: 20000 }, (_, i) => `operation-${i}`),
  })
  const second = grant()
  second.mutationId = 'new-grant'
  expect((await request(second)).code).toBe(503)
  expect(
    (
      await request({
        action: 'revoke',
        organizationId: 'rescue',
        submissionId: 'sighting',
        mutationId: 'revoke-at-limit',
      })
    ).code,
  ).toBe(200)
  const result = await request({
    action: 'revokeOrganization',
    organizationId: 'rescue',
    mutationId: 'revoke-all-at-limit',
  })
  expect(result.code).toBe(200)
  expect(
    (result.body as { permissions: { revokedAt?: string }[] }).permissions[0]
      .revokedAt,
  ).toBeDefined()
})
