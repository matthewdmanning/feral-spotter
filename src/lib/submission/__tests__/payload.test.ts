import {
  buildCacheMetadata,
  buildSubmissionPayload,
  foldBoxesIntoCat,
  resolvePhotoTime,
} from '../payload'
import type { SubmissionDraft } from '@/src/hooks/useSubmissionStore'
import type { SubmissionApiPayload, SubmissionPhoto } from '@/src/types'
import type { BoundingBox } from '@/src/types/BoundingBox'

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
    const cloudPathByLocalId = new Map([['p1', 'submissions/u/s/p1.jpg']])

    const result = foldBoxesIntoCat(cat, [box('p1')], cloudPathByLocalId)

    expect(result.boxes).toEqual([
      {
        photo_local_id: 'p1',
        cloud_storage_path: 'submissions/u/s/p1.jpg',
        lowerLeftX: 0.1,
        lowerLeftY: 0.2,
        upperRightX: 0.3,
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

describe('resolvePhotoTime', () => {
  const fallback = '2026-08-01T12:00:00.000Z'
  const basePhoto: SubmissionPhoto = {
    local_id: 'p1',
    uri: 'file://p1.jpg',
    uploaded: true,
    upload_progress: 100,
    width: 100,
    height: 100,
  }

  it("prefers the photo's own captured_at (camera capture) over everything else", () => {
    const photo = { ...basePhoto, captured_at: '2026-08-01T08:00:00.000Z' }

    expect(resolvePhotoTime(photo, submission, fallback)).toBe(
      '2026-08-01T08:00:00.000Z',
    )
  })

  it('falls back to the photo EXIF timestamp when captured_at is absent', () => {
    const photo = {
      ...basePhoto,
      exif: { timestamp: '2026:07:15 14:30:00' },
    }

    expect(resolvePhotoTime(photo, submission, fallback)).toBe(
      new Date('2026-07-15T14:30:00').toISOString(),
    )
  })

  it('falls back to submission.captured_at when the photo has neither', () => {
    expect(resolvePhotoTime(basePhoto, submission, fallback)).toBe(
      submission.captured_at,
    )
  })

  it('falls back to submission.manual_time when submission.captured_at is unset', () => {
    const { captured_at: _captured_at, ...rest } = submission
    expect(resolvePhotoTime(basePhoto, rest, fallback)).toBe(
      submission.manual_time,
    )
  })

  it('falls back to the given fallback time when nothing else resolves', () => {
    expect(resolvePhotoTime(basePhoto, {}, fallback)).toBe(fallback)
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
