import { getStorage } from 'firebase-admin/storage'
import sharp from 'sharp'
import type { OrganizationExtension } from '../api'
import {
  currentPermission,
  sharedPermissionPage,
  readOrganization,
} from '../store'
import { errorCode } from '../errors'
import { validId } from '../domain'
import { RequestError } from '../errors'
import { requireOrganizationAccess, sharedSighting } from '../permissions'

export type OrganizationAuthorizer = (
  uid: string,
  organizationId: string,
) => Promise<boolean>

async function assertAccess(
  authorize: OrganizationAuthorizer,
  uid: string,
  organizationId: string,
) {
  requireOrganizationAccess(await authorize(uid, organizationId))
  requireOrganizationAccess(
    (await readOrganization(organizationId)).organization.active,
  )
}

export async function sanitizePhoto(bytes: Buffer): Promise<Buffer> {
  // Sharp strips EXIF/XMP/IPTC by default. Never attach source customMetadata.
  return sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer()
}

export function createSharingExtension(
  authorize: OrganizationAuthorizer,
): OrganizationExtension {
  return async (identity, body, res) => {
    if (body.action !== 'sharedSightings' && body.action !== 'sharedPhoto')
      return false
    if (!validId(body.organizationId))
      throw new RequestError(400, 'Invalid organization')
    const organizationId = body.organizationId
    await assertAccess(authorize, identity.uid, organizationId)
    if (body.action === 'sharedSightings') {
      if (body.cursor !== undefined && typeof body.cursor !== 'string')
        throw new RequestError(400, 'Invalid cursor')
      const page = await sharedPermissionPage(
        organizationId,
        body.cursor as string | undefined,
      )
      const sightings = page.permissions
        .map(({ uid, permission }) => sharedSighting(uid, permission))
        .filter(Boolean)
      await assertAccess(authorize, identity.uid, organizationId)
      res.json({ sightings, cursor: page.cursor })
      return true
    }
    if (
      typeof body.id !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.id) ||
      !Number.isInteger(body.index) ||
      Number(body.index) < 0 ||
      Number(body.index) > 9
    )
      throw new RequestError(400, 'Invalid photo')
    const found = await currentPermission(body.id, organizationId)
    const index = Number(body.index)
    const path = found?.permission.fields.photos
      ? found.permission.data.photoPaths?.[index]
      : undefined
    if (
      !found ||
      !path ||
      !path.startsWith(
        `submissions/${found.uid}/${found.permission.submissionId}/`,
      ) ||
      !/^photo-[0-9]\.(jpg|jpeg|png|heic|heif)$/.test(path.split('/').pop()!)
    )
      throw new RequestError(404, 'Photo unavailable')
    const file = getStorage().bucket().file(path)
    let sanitized: Buffer
    try {
      const [metadata] = await file.getMetadata()
      if (Number(metadata.size) > 20 * 1024 * 1024)
        throw new RequestError(400, 'Photo too large')
      // Pin the downloaded generation to the one whose size was checked.
      const [bytes] = await getStorage()
        .bucket()
        .file(path, { generation: Number(metadata.generation) })
        .download()
      try {
        sanitized = await sanitizePhoto(bytes)
      } catch {
        throw new RequestError(404, 'Photo unavailable')
      }
    } catch (error) {
      if (errorCode(error) === 404)
        throw new RequestError(404, 'Photo unavailable')
      throw error
    }
    const stillShared = await currentPermission(body.id, organizationId)
    if (
      !stillShared ||
      stillShared.uid !== found.uid ||
      !stillShared.permission.fields.photos ||
      stillShared.permission.data.photoPaths?.[index] !== path
    )
      throw new RequestError(404, 'Photo unavailable')
    await assertAccess(authorize, identity.uid, organizationId)
    res.json({
      image: `data:image/jpeg;base64,${sanitized.toString('base64')}`,
    })
    return true
  }
}
