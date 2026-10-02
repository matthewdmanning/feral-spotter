/**
 * The shared photo contract, asserted against the payload each capture backend
 * actually returns. Stage 1 findings 3 and 4 live here: Android could report
 * 0x0 dimensions, and `captured_at` meant a different instant per platform.
 *
 * This is the one test that makes the two capture hooks safe to share code,
 * so it is written against the payload shapes, not against the hooks.
 */

import { buildSubmissionPhotoFromCapture } from '@/src/utils/buildSubmissionPhoto'

jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }))

const SHUTTER = '2026-09-28T10:00:00.000Z'

describe('captured photo contract', () => {
  const accepted = [
    {
      backend: 'camerax, use case attached',
      frame: { uri: 'file:///cache/abc.jpg', width: 4032, height: 3024 },
    },
    {
      backend: 'avfoundation',
      frame: { uri: 'file:///tmp/abc.jpg', width: 4032, height: 3024 },
    },
    {
      backend: 'visioncamera, saveToTemporaryFileAsync',
      frame: {
        uri: 'file:///data/user/0/cache/mrousavy.jpg',
        width: 1920,
        height: 1080,
      },
    },
  ]

  it.each(accepted)('accepts the $backend payload', ({ frame }) => {
    const photo = buildSubmissionPhotoFromCapture(frame, SHUTTER)
    expect(photo.width).toBeGreaterThan(0)
    expect(photo.height).toBeGreaterThan(0)
    expect(photo.uri).toBe(frame.uri)
    expect(photo.uploaded).toBe(false)
  })

  const rejected = [
    {
      why: 'camerax resolutionInfo is null before the use case attaches',
      frame: { uri: 'file:///cache/abc.jpg', width: 0, height: 0 },
    },
    {
      why: 'one axis missing is still unusable',
      frame: { uri: 'file:///cache/abc.jpg', width: 4032, height: 0 },
    },
    {
      why: 'a gallery content uri is not a readable local file for upload',
      frame: {
        uri: 'content://media/external/images/1',
        width: 100,
        height: 100,
      },
    },
    {
      why: 'a bare path has no scheme, so upload cannot read it',
      frame: { uri: '/cache/abc.jpg', width: 100, height: 100 },
    },
  ]

  it.each(rejected)('rejects: $why', ({ frame }) => {
    expect(() => buildSubmissionPhotoFromCapture(frame, SHUTTER)).toThrow()
  })

  it('stamps captured_at from the shutter, never from the backend', () => {
    const frameWithOwnStamp = {
      uri: 'file:///cache/abc.jpg',
      width: 100,
      height: 100,
      capturedAt: '2020-01-01T00:00:00.000Z',
    }
    const photo = buildSubmissionPhotoFromCapture(frameWithOwnStamp, SHUTTER)
    expect(photo.captured_at).toBe(SHUTTER)
  })
})
