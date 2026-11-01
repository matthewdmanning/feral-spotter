import type { SubmissionCacheFile } from '@/src/lib/cache/submissionCache'
import { observedCat } from '@/src/test-utils/catFixtures'
import {
  groupSightingsBySpot,
  mapViewForSpots,
  ownSightings,
  pinBadge,
  profilePicUri,
  reportCardTime,
  sightingCardAction,
  sightingTime,
  sortBySightingTime,
  type MapSize,
  type SpotCoordinates,
} from '../history'

function sighting(
  id: string,
  created_at: string,
  at: SpotCoordinates | null,
  catCount: number,
  extra: Partial<SubmissionCacheFile> = {},
): SubmissionCacheFile {
  return {
    id,
    created_at,
    updated_at: created_at,
    status: 'Submitted',
    metadata: {
      location_method: 'device',
      time_method: 'device',
      ...(at ?? {}),
    },
    cats: Array.from({ length: catCount }, (_, i) =>
      observedCat({ local_id: `${id}-c${i}` }),
    ),
    ...extra,
  }
}

// ~11 m per 0.0001° of latitude.
const COLONY = { latitude: 34.6834, longitude: -82.8374 }
const SAME_COLONY = { latitude: 34.6835, longitude: -82.8374 }
const NEXT_BLOCK = { latitude: 34.6844, longitude: -82.8374 }

describe('groupSightingsBySpot', () => {
  it('merges repeat visits to one spot and sums their cats for the badge', () => {
    const spots = groupSightingsBySpot([
      sighting('old', '2026-10-01T00:00:00Z', COLONY, 2),
      sighting('new', '2026-10-20T00:00:00Z', SAME_COLONY, 3),
      sighting('far', '2026-10-10T00:00:00Z', NEXT_BLOCK, 1),
      sighting('nowhere', '2026-10-15T00:00:00Z', null, 4),
    ])

    expect(spots).toEqual([
      expect.objectContaining({ catCount: 5, sightingIds: ['new', 'old'] }),
      expect.objectContaining({ catCount: 1, sightingIds: ['far'] }),
    ])
  })

  // Anchored on one point, so a walk of close Sightings stays split. Points
  // 22 m apart: r3 anchors and takes r2 (22 m); r1 is 44 m out, so it
  // anchors a second pin and takes r0. A chaining bug gives one pin.
  it('does not chain Sightings that are each near the next into one pin', () => {
    const step = (n: number) => ({
      latitude: COLONY.latitude + n * 0.0002,
      longitude: COLONY.longitude,
    })
    const spots = groupSightingsBySpot(
      [0, 1, 2, 3].map((n) =>
        sighting(`r${n}`, `2026-10-0${n + 1}T00:00:00Z`, step(n), 1),
      ),
    )
    expect(spots.map((s) => s.sightingIds)).toEqual([
      ['r3', 'r2'],
      ['r1', 'r0'],
    ])
  })
})

describe('reportCardTime', () => {
  const shot = (local_id: string, captured_at?: string) => ({
    local_id,
    uri: `file://${local_id}.jpg`,
    captured_at,
  })

  it('shows the last camera photo, whatever order the photos are in', () => {
    const row = sighting('cam', '2026-11-01T13:40:00Z', null, 1, {
      photos: [
        shot('p1', '2026-11-01T13:30:00Z'),
        shot('p2', '2026-11-01T13:33:00Z'),
        shot('p3', '2026-11-01T13:31:00Z'),
      ],
    })
    expect(reportCardTime(row)).toBe('2026-11-01T13:33:00Z')
  })

  // Library picks carry no capture time; their EXIF time must not leak in.
  it('shows when the report was started if the camera was not used', () => {
    const row = sighting('lib', '2026-11-01T13:40:00Z', null, 1, {
      metadata: {
        location_method: 'device',
        time_method: 'device',
        captured_at: '2026-10-28T21:27:00Z',
      },
      photos: [shot('p1')],
    })
    expect(reportCardTime(row)).toBe('2026-11-01T13:40:00Z')
  })
})

describe('sortBySightingTime', () => {
  it('orders by the time the card shows, not when the row was made', () => {
    const rows = [
      sighting('made-late', '2026-10-20T00:00:00Z', null, 1, {
        photos: [
          {
            local_id: 'p1',
            uri: 'file://p1.jpg',
            captured_at: '2026-10-01T00:00:00Z',
          },
        ],
      }),
      sighting('made-early', '2026-10-10T00:00:00Z', null, 1),
    ]
    expect(sortBySightingTime(rows).map((r) => r.id)).toEqual([
      'made-early',
      'made-late',
    ])
  })
})

describe('sightingTime', () => {
  // ADR 0003: a camera Sighting's time is when it was sent, and the Sighting
  // view labels it "Time of submission". The draft's start is a different time.
  it('shows a sent camera Sighting at its Submit time, not the draft start', () => {
    const row = sighting('cam', '2026-11-01T13:32:00Z', null, 1, {
      submitted_at: '2026-11-01T13:34:00Z',
    })
    expect(sightingTime(row)).toBe('2026-11-01T13:34:00Z')
  })
})

describe('sightingCardAction', () => {
  const draft = (id: string) =>
    sighting(id, '2026-10-01T00:00:00Z', null, 0, { status: 'In Progress' })

  it.each([
    [
      'a sent Sighting opens read-only',
      sighting('s', '2026-10-01T00:00:00Z', null, 1),
      'view',
    ],
    ['the resumable draft resumes', draft('current'), 'resume'],
    ['an abandoned draft does nothing', draft('stale'), null],
  ])('%s', (_, cache, expected) => {
    expect(sightingCardAction(cache, 'current')).toBe(expected)
  })
})

describe('pinBadge', () => {
  it.each([
    [1, 'none'],
    [2, 2],
    [9, 9],
    [10, 'many'],
  ])('%i cats -> %p', (count, badge) => {
    expect(pinBadge(count)).toBe(badge)
  })
})

describe('mapViewForSpots', () => {
  const TILE = 256
  const mercatorY = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

  // Every pin must land inside the map frame at the chosen zoom.
  function allInside(spots: SpotCoordinates[], size: MapSize) {
    const view = mapViewForSpots(spots, size)!
    const world = TILE * 2 ** view.zoom
    return spots.every((s) => {
      const dx = ((s.longitude - view.coordinates.longitude) / 360) * world
      const dy =
        ((mercatorY(s.latitude) - mercatorY(view.coordinates.latitude)) /
          (2 * Math.PI)) *
        world
      return Math.abs(dx) <= size.width / 2 && Math.abs(dy) <= size.height / 2
    })
  }

  const WIDE = { width: 360, height: 220 }
  const TALL = { width: 220, height: 360 }

  it('centres a single spot at street zoom, not world zoom', () => {
    expect(mapViewForSpots([COLONY], WIDE)).toEqual({
      coordinates: COLONY,
      zoom: 15,
    })
  })

  it.each([
    ['a block, north-south', [COLONY, NEXT_BLOCK]],
    ['a town, east-west', [COLONY, { ...COLONY, longitude: -82.79 }]],
    ['a region, diagonal', [COLONY, { latitude: 35.6, longitude: -80.8 }]],
    [
      'far north, where Mercator stretches',
      [
        { latitude: 64.1, longitude: -21.9 },
        { latitude: 64.3, longitude: -21.9 },
      ],
    ],
  ])('fits %s inside wide and tall frames', (_, spots) => {
    expect(allInside(spots, WIDE)).toBe(true)
    expect(allInside(spots, TALL)).toBe(true)
  })
})

describe('ownSightings', () => {
  it("keeps this user's and unattributed rows, drops another account's", () => {
    const rows = [
      sighting('mine', '2026-10-01T00:00:00Z', null, 1, { user_id: 'u1' }),
      sighting('draft', '2026-10-01T00:00:00Z', null, 1),
      sighting('theirs', '2026-10-01T00:00:00Z', null, 1, { user_id: 'u2' }),
    ]
    expect(ownSightings(rows, 'u1').map((r) => r.id)).toEqual(['mine', 'draft'])
  })
})

describe('profilePicUri', () => {
  const withPic = sighting('r', '2026-10-01T00:00:00Z', null, 0, {
    photos: [
      { local_id: 'p1', uri: 'file:///cache/p1.jpg' },
      {
        local_id: 'p2',
        uri: 'file:///cache/p2.jpg',
        cloud_storage_url: 'https://cloud/p2.jpg',
      },
    ],
  })
  const box = (photo_local_id: string) => ({
    photo_local_id,
    lowerLeftX: 0,
    lowerLeftY: 1,
    upperRightX: 1,
    upperRightY: 0,
  })

  // The camera file is deleted at draft teardown; the cloud copy is not.
  it('prefers the cloud copy, falling back to the local file', () => {
    expect(
      profilePicUri(withPic, { ...observedCat(), profile_box: box('p2') }),
    ).toBe('https://cloud/p2.jpg')
    expect(
      profilePicUri(withPic, { ...observedCat(), profile_box: box('p1') }),
    ).toBe('file:///cache/p1.jpg')
  })
})
