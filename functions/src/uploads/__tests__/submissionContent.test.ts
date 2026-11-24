import sharp from 'sharp'
import { isValidJpeg, parseSubmissionMetadata } from '../submissionContent'

it('accepts a legacy Submission with no per-photo time or RAW pairs', () => {
  const payload = {
    submission: {},
    cats: [{}],
    photo_paths: ['submissions/uid/sighting/photo-0.jpeg'],
  }
  expect(
    parseSubmissionMetadata(
      Buffer.from(JSON.stringify(payload)),
      'uid',
      'sighting',
    ),
  ).toEqual(payload)
  expect(
    parseSubmissionMetadata(Buffer.from('null'), 'uid', 'sighting'),
  ).toBeNull()
})

it('checks the encoded photo format and rejects an incomplete image', async () => {
  const image = sharp({
    create: { width: 20, height: 10, channels: 3, background: 'red' },
  })
  const jpeg = await image.clone().jpeg().toBuffer()
  const png = await image.png().toBuffer()
  await expect(isValidJpeg(jpeg)).resolves.toBe(true)
  await expect(isValidJpeg(png)).resolves.toBe(false)
  await expect(isValidJpeg(jpeg.subarray(0, jpeg.length - 10))).resolves.toBe(
    false,
  )
})
