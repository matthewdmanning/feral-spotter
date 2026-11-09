import sharp from 'sharp'
import { sanitizePhoto, createSharingExtension } from '../api'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { Response } from 'express'

test('delivered photos are reencoded without embedded metadata', async () => {
  const source = await sharp({
    create: { width: 20, height: 10, channels: 3, background: 'red' },
  })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: {
          Artist: 'private observer',
          ImageDescription: 'private location',
        },
      },
    })
    .toBuffer()
  expect((await sharp(source).metadata()).exif).toBeDefined()
  const sanitized = await sanitizePhoto(source)
  const metadata = await sharp(sanitized).metadata()
  expect(metadata.exif).toBeUndefined()
  expect(metadata.xmp).toBeUndefined()
  expect(metadata.iptc).toBeUndefined()
  expect(metadata.format).toBe('jpeg')
})

test('unauthorized viewers fail before any organization data is read', async () => {
  const handle = createSharingExtension(async () => false)
  await expect(
    handle(
      { uid: 'outsider' } as DecodedIdToken,
      { action: 'sharedSightings', organizationId: 'org' },
      {} as Response,
    ),
  ).rejects.toMatchObject({ status: 403 })
})
