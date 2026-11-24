import sharp from 'sharp'
import { renderBackupJpeg, selectBackupCrop } from '../crop'

const path = 'submissions/uid/sighting/photo-0.jpg'
const box = {
  cloud_storage_path: path,
  lowerLeftX: 0.25,
  upperRightY: 0.25,
  upperRightX: 0.75,
  lowerLeftY: 0.75,
}
const crop = selectBackupCrop([{ boxes: [box] }], [path])!

it('uses the first inset box from the first cat with a usable crop', () => {
  expect(
    selectBackupCrop(
      [
        {},
        { boxes: [{ ...box, upperRightX: 2 }, box] },
        { boxes: [box], profile_photo_local_id: 'another-photo' },
      ],
      [path],
    ),
  ).toEqual({ path, left: 0.25, top: 0.25, right: 0.75, bottom: 0.75 })
  expect(selectBackupCrop([{ boxes: [box] }], [])).toBeUndefined()
})

it('crops in the display orientation and never enlarges the result', async () => {
  const source = await sharp({
    create: { width: 60, height: 20, channels: 3, background: 'red' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer()

  const jpeg = await renderBackupJpeg(source, 'image/jpeg', {
    ...crop,
    top: 0.5,
  })
  const result = await sharp(jpeg).metadata()
  expect(result).toMatchObject({ format: 'jpeg', width: 10, height: 15 })
  expect(result.orientation).toBeUndefined()
  expect(result.exif).toBeUndefined()
})

it('fits the crop inside 1920 by 1080 and checks the declared format', async () => {
  const png = await sharp({
    create: { width: 4000, height: 2400, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer()

  const jpeg = await renderBackupJpeg(png, 'image/png', crop)
  expect(await sharp(jpeg).metadata()).toMatchObject({
    width: 1800,
    height: 1080,
  })
  await expect(
    renderBackupJpeg(png, 'image/jpeg', crop),
  ).resolves.toBeUndefined()
})
