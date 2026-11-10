import { mutateLedger } from '../ledger'
import { sharedSighting, requireOrganizationAccess } from '../permissions'
import type { Permission, PermissionLedger } from '../domain'

const permission: Permission = {
  submissionId: 's',
  organizationId: 'o',
  organizationName: 'Org',
  catalogVersion: 'v',
  epoch: 0,
  confirmedAt: 'now',
  anonymous: false,
  injured: false,
  disclosureVersion: 1,
  fields: {
    name: true,
    email: true,
    phone: true,
    catDetails: false,
    preciseLocation: false,
    photos: false,
  },
  data: {
    catCount: 1,
    generalLocation: { south: 1, north: 2, west: 3, east: 4 },
    contact: { email: 'private' },
    preciseLocation: { latitude: 1.2, longitude: 3.4 },
    photoPaths: ['private'],
    cats: [{ sex: 'male' }],
  },
}

test('member projection does not leak contacts, source IDs, unselected details or revoked content', () => {
  const summary = sharedSighting('owner', permission)!
  expect(summary).toEqual({
    id: expect.any(String),
    catCount: 1,
    generalLocation: permission.data.generalLocation,
    photoCount: 0,
  })
  expect(
    sharedSighting('owner', { ...permission, revokedAt: 'now' }),
  ).toBeNull()
  expect(() => requireOrganizationAccess(false)).toThrow()
})

test('leaving blocks concurrent grants, replaces consent explicitly and invalidates stale grants', () => {
  let ledger: PermissionLedger = { epochs: {}, permissions: [permission] }
  ledger = mutateLedger(
    ledger,
    { type: 'blockOrganization', organizationId: 'o', token: 'exit' },
    'now',
  )
  expect(() =>
    mutateLedger(
      ledger,
      { type: 'grant', organizationId: 'o', permission },
      'now',
    ),
  ).toThrow()
  ledger = mutateLedger(
    ledger,
    {
      type: 'replaceOrganization',
      organizationId: 'o',
      epoch: 0,
      token: 'exit',
      permissions: [
        {
          ...permission,
          anonymous: true,
          data: {
            catCount: 1,
            generalLocation: permission.data.generalLocation,
          },
        },
      ],
    },
    'now',
  )
  expect(ledger.permissions[0].data.contact).toBeUndefined()
  ledger = mutateLedger(
    ledger,
    { type: 'unblockOrganization', organizationId: 'o', token: 'exit' },
    'now',
  )
  expect(() =>
    mutateLedger(
      ledger,
      { type: 'grant', organizationId: 'o', permission },
      'now',
    ),
  ).toThrow()
  expect(ledger.epochs.o).toBe(1)
})
