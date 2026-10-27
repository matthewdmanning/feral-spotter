import type {
  CachedCat,
  SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'
import {
  groupReportsBySpot,
  mapViewForSpots,
  ownReports,
  pinBadge,
  profilePicUri,
} from '../history'

const cat = (local_id: string): CachedCat => ({
  local_id,
  age: 'adult',
  ear_tipped: 'unsure',
  health_label: 'unknown',
  owned_domesticated: 'unsure',
  pattern: 'solid',
  hair_length: 'short',
  color: 'black',
  sex: 'unknown',
  photo_local_ids: [],
  photos_reviewed: false,
})

function report(
  id: string,
  created_at: string,
  at: { latitude: number; longitude: number } | null,
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
    cats: Array.from({ length: catCount }, (_, i) => cat(`${id}-c${i}`)),
    ...extra,
  }
}

// ~11 m per 0.0001° of latitude.
const COLONY = { latitude: 34.6834, longitude: -82.8374 }
const SAME_COLONY = { latitude: 34.6835, longitude: -82.8374 }
const NEXT_BLOCK = { latitude: 34.6844, longitude: -82.8374 }

describe('groupReportsBySpot', () => {
  it('merges repeat visits to one spot and sums their cats for the badge', () => {
    const spots = groupReportsBySpot([
      report('old', '2026-10-01T00:00:00Z', COLONY, 2),
      report('new', '2026-10-20T00:00:00Z', SAME_COLONY, 3),
      report('far', '2026-10-10T00:00:00Z', NEXT_BLOCK, 1),
      report('nowhere', '2026-10-15T00:00:00Z', null, 4),
    ])

    expect(spots).toEqual([
      expect.objectContaining({ catCount: 5, reportIds: ['new', 'old'] }),
      expect.objectContaining({ catCount: 1, reportIds: ['far'] }),
    ])
  })

  // Anchored on one point, so a walk of close Sightings stays split.
  it('does not chain Sightings that are each near the next into one pin', () => {
    const step = (n: number) => ({
      latitude: COLONY.latitude + n * 0.0002,
      longitude: COLONY.longitude,
    })
    const spots = groupReportsBySpot(
      [0, 1, 2, 3].map((n) =>
        report(`r${n}`, `2026-10-0${n + 1}T00:00:00Z`, step(n), 1),
      ),
    )
    expect(spots.length).toBeGreaterThan(1)
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
  it('centres a single spot at street zoom, not world zoom', () => {
    expect(mapViewForSpots([COLONY])).toEqual({
      coordinates: COLONY,
      zoom: 15,
    })
  })

  it('zooms out far enough that a wider spread fits', () => {
    const near = mapViewForSpots([COLONY, NEXT_BLOCK])!
    const far = mapViewForSpots([COLONY, { latitude: 35.6, longitude: -80.8 }])!
    expect(far.zoom).toBeLessThan(near.zoom)
  })
})

describe('ownReports', () => {
  it("keeps this user's and unattributed rows, drops another account's", () => {
    const rows = [
      report('mine', '2026-10-01T00:00:00Z', null, 1, { user_id: 'u1' }),
      report('draft', '2026-10-01T00:00:00Z', null, 1),
      report('theirs', '2026-10-01T00:00:00Z', null, 1, { user_id: 'u2' }),
    ]
    expect(ownReports(rows, 'u1').map((r) => r.id)).toEqual(['mine', 'draft'])
  })
})

describe('profilePicUri', () => {
  const withPic = report('r', '2026-10-01T00:00:00Z', null, 0, {
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
      profilePicUri(withPic, { ...cat('c'), profile_box: box('p2') }),
    ).toBe('https://cloud/p2.jpg')
    expect(
      profilePicUri(withPic, { ...cat('c'), profile_box: box('p1') }),
    ).toBe('file:///cache/p1.jpg')
  })
})
