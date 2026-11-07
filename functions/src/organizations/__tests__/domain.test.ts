import {
  covers,
  parseCatalog,
  nearby,
  projectData,
  DEFAULT_SHARING,
  validId,
  type Coverage,
} from '../domain'
import { mutateLedger } from '../ledger'
import type { Permission, PermissionLedger } from '../domain'

const square: Coverage = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
    [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ],
  ],
}

describe('organization boundaries and data minimization', () => {
  test.each(['__proto__', 'constructor', 'toString', 'prototype'])(
    'rejects unsafe identifier %s',
    (id) => expect(validId(id)).toBe(false),
  )
  test.each([
    [0.5, 0.5, true],
    [0, 0, true],
    [4, 2, true],
    [1.5, 1.5, false],
    [1, 1.5, false],
    [8, 1, false],
    [NaN, 1, false],
  ])('location %s,%s has eligibility %s', (lat, lon, expected) =>
    expect(covers(square, lat, lon)).toBe(expected),
  )

  test('multipolygon islands and dateline crossings do not include the opposite hemisphere', () => {
    const dateline: Coverage = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [179, -1],
            [-179, -1],
            [-179, 1],
            [179, 1],
            [179, -1],
          ],
        ],
        [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10],
          ],
        ],
      ],
    }
    expect(covers(dateline, 0, 179.5)).toBe(true)
    expect(covers(dateline, 0, -179.5)).toBe(true)
    expect(covers(dateline, 0, 0)).toBe(false)
    expect(covers(dateline, 10.5, 10.5)).toBe(true)
  })

  test('cache retains coverage around the user even when the organization centroid is far away', () => {
    expect(
      nearby(
        { id: 'wide', name: 'Wide coverage', active: true, coverage: square },
        0.001,
        -0.001,
        1,
      ),
    ).toBe(true)
    expect(
      nearby(
        { id: 'far', name: 'Far', active: true, coverage: square },
        20,
        20,
        1,
      ),
    ).toBe(false)
  })

  test.each([
    null,
    {},
    { version: 'v1', organizations: [{ id: 'x' }] },
    {
      version: 'v1',
      organizations: [
        {
          id: 'x',
          name: 'X',
          active: true,
          coverage: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 1],
                [2, 2],
                [0, 0],
              ],
            ],
          },
        },
      ],
    },
  ])('rejects invalid catalog %j', (catalog) =>
    expect(() => parseCatalog(catalog)).toThrow(),
  )

  test('optional fields cannot leak through cat objects, addresses or account identity', () => {
    const input = {
      cats: [
        {
          local_id: 'internal',
          health_label: 'poor',
          boxes: ['secret-photo'],
          photo_local_ids: ['photo'],
          address: 'Exact street',
        },
      ],
      latitude: 34.683456,
      longitude: -82.837456,
      photoPaths: ['private/photo.jpg'],
      fields: {
        name: true,
        email: true,
        phone: true,
        catDetails: true,
        preciseLocation: false,
        photos: false,
      },
      anonymous: true,
      contact: { name: 'Person', email: 'private@example.com', phone: '123' },
    }
    const anonymous = projectData(input)
    expect(anonymous).toEqual({
      catCount: 1,
      generalLocation: {
        south: 34.68,
        west: -82.84,
        north: 34.69,
        east: -82.83,
      },
      cats: [{ health_label: 'poor' }],
    })
    expect(projectData({ ...input, fields: DEFAULT_SHARING.fields })).toEqual({
      catCount: 1,
      generalLocation: anonymous.generalLocation,
    })
    expect(
      projectData({
        ...input,
        anonymous: false,
        fields: {
          ...input.fields,
          name: false,
          phone: false,
          preciseLocation: true,
          photos: true,
        },
      }),
    ).toMatchObject({
      contact: { email: 'private@example.com' },
      preciseLocation: { latitude: input.latitude, longitude: input.longitude },
      photoPaths: input.photoPaths,
    })
  })
})

describe('revocation is monotonic across retries and races', () => {
  const permission: Permission = {
    submissionId: 'sighting',
    organizationId: 'rescue',
    organizationName: 'Rescue',
    catalogVersion: 'v1',
    epoch: 0,
    confirmedAt: '2026-11-07',
    anonymous: true,
    fields: DEFAULT_SHARING.fields,
    injured: false,
    disclosureVersion: 1,
    data: {
      catCount: 1,
      generalLocation: { south: 0, west: 0, north: 0.01, east: 0.01 },
    },
  }
  const empty: PermissionLedger = { epochs: {}, permissions: [] }
  const grant = { type: 'grant' as const, organizationId: 'rescue', permission }
  test('repeated grants preserve the original confirmation and individual revocation blocks replay', () => {
    const first = mutateLedger(empty, grant, 'first')
    expect(
      mutateLedger(
        first,
        { ...grant, permission: { ...permission, confirmedAt: 'retry' } },
        'retry',
      ),
    ).toEqual(first)
    const revoked = mutateLedger(
      first,
      { type: 'revoke', organizationId: 'rescue', submissionId: 'sighting' },
      'revoked',
    )
    expect(() => mutateLedger(revoked, grant, 'late')).toThrow('revoked')
    expect(
      mutateLedger(
        revoked,
        { type: 'revoke', organizationId: 'rescue', submissionId: 'sighting' },
        'again',
      ).permissions[0].revokedAt,
    ).toBe('revoked')
  })
  test('a revocation arriving before an in-flight grant leaves a tombstone', () => {
    const revoked = mutateLedger(
      empty,
      { type: 'revoke', organizationId: 'rescue', submissionId: 'sighting' },
      'revoked',
    )
    expect(() => mutateLedger(revoked, grant, 'late')).toThrow('revoked')
  })
  test('organization revocation rejects stale grants but permits a newly confirmed future sighting', () => {
    const revoked = mutateLedger(
      mutateLedger(empty, grant, 'first'),
      { type: 'revokeOrganization', organizationId: 'rescue' },
      'revoked',
    )
    expect(revoked.permissions[0].revokedAt).toBe('revoked')
    expect(() =>
      mutateLedger(
        revoked,
        { ...grant, permission: { ...permission, submissionId: 'later' } },
        'stale',
      ),
    ).toThrow('revoked')
    expect(
      mutateLedger(
        revoked,
        {
          ...grant,
          permission: { ...permission, submissionId: 'later', epoch: 1 },
        },
        'fresh',
      ).permissions,
    ).toHaveLength(2)
  })
})

describe('coverage geometry validation', () => {
  function parse(coordinates: [number, number][][]) {
    return parseCatalog({
      version: 'v1',
      organizations: [
        {
          id: 'rescue',
          name: 'Rescue',
          active: true,
          coverage: { type: 'Polygon', coordinates },
        },
      ],
    })
  }
  const outer: [number, number][] = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ]
  test.each<[string, [number, number][][]]>([
    [
      'crossed exterior',
      [
        [
          [0, 0],
          [3, 3],
          [0, 3],
          [2, 0],
          [0, 0],
        ],
      ],
    ],
    [
      'repeated edge',
      [
        [
          [0, 0],
          [4, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    ],
    [
      'outside hole',
      [
        outer,
        [
          [5, 5],
          [6, 5],
          [6, 6],
          [5, 6],
          [5, 5],
        ],
      ],
    ],
    [
      'crossing hole',
      [
        outer,
        [
          [3, 3],
          [5, 3],
          [5, 5],
          [3, 5],
          [3, 3],
        ],
      ],
    ],
    [
      'overlapping holes',
      [
        outer,
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
        [
          [2, 2],
          [3.5, 2],
          [3.5, 3.5],
          [2, 3.5],
          [2, 2],
        ],
      ],
    ],
  ])('rejects %s', (_name, coordinates) =>
    expect(() => parse(coordinates)).toThrow(),
  )
  test('accepts valid dateline coverage with a hole and normal coverage independent of winding', () => {
    expect(() =>
      parse(square.coordinates as [number, number][][]),
    ).not.toThrow()
    expect(() => parse([outer.slice().reverse()])).not.toThrow()
    expect(() =>
      parse([
        [
          [179, -2],
          [-179, -2],
          [-179, 2],
          [179, 2],
          [179, -2],
        ],
        [
          [179.5, -1],
          [-179.5, -1],
          [-179.5, 1],
          [179.5, 1],
          [179.5, -1],
        ],
      ]),
    ).not.toThrow()
  })
})
