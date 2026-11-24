import {
  buildCacheMetadata,
  buildSubmissionPayload,
  foldBoxesIntoCat,
} from '@/src/features/draft-submission/lib/payload'
import type { SubmissionDraft } from '@/src/shared/hooks/useSubmissionStore'
import type { SubmissionApiPayload, SubmissionPhoto } from '@/src/shared/types'
import type { BoundingBox } from '@/src/shared/types/BoundingBox'

const submission: SubmissionDraft = {
  location_type: 'device',
  time_type: 'device',
  address: '123 Main St',
  manual_time: '2026-08-01T10:00:00.000Z',
  captured_at: '2026-08-01T09:00:00.000Z',
  latitude: 34.6834,
  longitude: -82.8374,
  accuracy: 5,
}

describe('buildCacheMetadata', () => {
  it('re-spells location_type/time_type to location_method/time_method, passing the rest through', () => {
    expect(buildCacheMetadata(submission)).toEqual({
      location_method: 'device',
      time_method: 'device',
      address: '123 Main St',
      manual_time: '2026-08-01T10:00:00.000Z',
      captured_at: '2026-08-01T09:00:00.000Z',
      latitude: 34.6834,
      longitude: -82.8374,
      accuracy: 5,
    })
  })
})

describe('foldBoxesIntoCat', () => {
  const cat: Omit<SubmissionApiPayload['cats'][number], 'boxes'> = {
    local_id: 'cat-1',
    age: 'adult',
    ear_tipped: 'unsure',
    owned_domesticated: 'unsure',
    pattern: 'solid',
    hair_length: 'short',
    color: 'black',
    sex: 'unknown',
    health_label: 'unknown',
    photo_local_ids: ['p1'],
    photos_reviewed: true,
  }

  const box = (photo_local_id: string): BoundingBox => ({
    id: 'box-1',
    cat_id: 'cat-1',
    photo_local_id,
    lowerLeftX: 0.1,
    lowerLeftY: 0.2,
    upperRightX: 0.3,
    upperRightY: 0.4,
  })

  it('attaches each box its own cloud_storage_path via the photo it belongs to (#264)', () => {
    const cloudPathByLocalId = new Map([
      ['p2', 'submissions/u/s/p2.jpg'],
      ['p1', 'submissions/u/s/p1.jpg'],
    ])
    const secondBox = { ...box('p2'), lowerLeftX: 0.5, upperRightX: 0.8 }

    const result = foldBoxesIntoCat(
      { ...cat, photo_local_ids: ['p1', 'p2'] },
      [box('p1'), secondBox],
      cloudPathByLocalId,
    )

    expect(result.boxes).toEqual([
      {
        photo_local_id: 'p1',
        cloud_storage_path: 'submissions/u/s/p1.jpg',
        lowerLeftX: 0.1,
        lowerLeftY: 0.2,
        upperRightX: 0.3,
        upperRightY: 0.4,
      },
      {
        photo_local_id: 'p2',
        cloud_storage_path: 'submissions/u/s/p2.jpg',
        lowerLeftX: 0.5,
        lowerLeftY: 0.2,
        upperRightX: 0.8,
        upperRightY: 0.4,
      },
    ])
    expect(result.local_id).toBe('cat-1')
  })

  it('leaves cloud_storage_path undefined for a box whose photo never uploaded', () => {
    const result = foldBoxesIntoCat(cat, [box('missing')], new Map())

    expect(result.boxes[0].cloud_storage_path).toBeUndefined()
  })
})

// LOGIC-1/LOGIC-4: each photo's own time reaches metadata.json. A Library
// photo with no EXIF time and no manual time is `unknown`, never "now" and
// never another photo's time.
describe('photo_times', () => {
  const basePhoto: SubmissionPhoto = {
    local_id: 'p1',
    uri: 'file://p1.jpg',
    uploaded: true,
    upload_progress: 100,
    width: 100,
    height: 100,
  }
  const shutter = '2026-08-01T08:00:00.000Z'
  const exifIso = new Date('2026-07-15T14:30:00').toISOString()
  const { manual_time: _manual, ...noManual } = submission

  it.each([
    [
      'camera shutter time',
      { captured_at: shutter },
      submission,
      { time_source: 'capture', time: shutter },
    ],
    [
      'Library EXIF time',
      { exif: { timestamp: '2026:07:15 14:30:00' } },
      submission,
      { time_source: 'exif', time: exifIso },
    ],
    [
      'manual time for a timeless photo',
      {},
      submission,
      { time_source: 'manual', time: submission.manual_time },
    ],
    [
      'unknown, not the submission-wide captured_at',
      {},
      noManual,
      { time_source: 'unknown' },
    ],
  ])('records %s', (_label, photoFields, draft, expected) => {
    const payload = buildSubmissionPayload({
      submission: draft,
      catsWithBoxes: [],
      uploadedPhotos: [
        { ...basePhoto, ...photoFields, cloud_storage_path: 'u/s/photo-0' },
      ],
    })

    expect(payload.photo_times).toEqual([{ path: 'u/s/photo-0', ...expected }])
  })
})

describe('buildSubmissionPayload', () => {
  const uploadedPhoto = {
    ...({
      local_id: 'p1',
      uri: 'file://p1.jpg',
      uploaded: true,
      upload_progress: 100,
      width: 100,
      height: 100,
    } as SubmissionPhoto),
    cloud_storage_path: 'submissions/u/s/p1.jpg',
  }

  it('includes photo_locations when the submission has a GPS fix', () => {
    const payload = buildSubmissionPayload({
      submission,
      catsWithBoxes: [],
      uploadedPhotos: [uploadedPhoto],
    })

    expect(payload.photo_locations).toEqual([
      {
        path: 'submissions/u/s/p1.jpg',
        latitude: 34.6834,
        longitude: -82.8374,
      },
    ])
    expect(payload.photo_paths).toEqual(['submissions/u/s/p1.jpg'])
    // The whole draft passes through, not a field-by-field pick (see the
    // module doc comment) — manual_time/accuracy are already on the wire.
    expect(payload.submission).toEqual(submission)
  })

  it('links a paired DNG to its JPEG without inventing one for JPEG-only photos', () => {
    const jpegOnly = buildSubmissionPayload({
      submission,
      catsWithBoxes: [],
      uploadedPhotos: [uploadedPhoto],
    })
    expect(jpegOnly.photo_pairs).toBeUndefined()

    const withRaw = buildSubmissionPayload({
      submission,
      catsWithBoxes: [],
      uploadedPhotos: [
        {
          ...uploadedPhoto,
          raw_cloud_storage_path: 'submissions/u/s/p1.dng',
        },
      ],
    })
    expect(withRaw.photo_pairs).toEqual([
      {
        jpeg_path: 'submissions/u/s/p1.jpg',
        dng_path: 'submissions/u/s/p1.dng',
      },
    ])
  })

  it('omits photo_locations entirely when the submission has no GPS fix', () => {
    const { latitude: _latitude, longitude: _longitude, ...noFix } = submission

    const payload = buildSubmissionPayload({
      submission: noFix as SubmissionDraft,
      catsWithBoxes: [],
      uploadedPhotos: [uploadedPhoto],
    })

    expect(payload.photo_locations).toBeUndefined()
  })
})
