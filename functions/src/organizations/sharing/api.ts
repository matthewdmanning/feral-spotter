import { getStorage } from 'firebase-admin/storage'
import sharp from 'sharp'
import type { OrganizationExtension } from '../api'
import { readCatalog, readLedger } from '../api'
import { validId, type Permission } from '../domain'
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
    (await readCatalog()).organizations.some(
      (o) => o.id === organizationId && o.active,
    ),
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

async function ledgerPage(cursor?: string) {
  const [files, next] = await getStorage().bucket().getFiles({
    prefix: 'organization-permissions/',
    matchGlob: '**/ledger.json',
    autoPaginate: false,
    maxResults: 1,
    pageToken: cursor,
  })
  return {
    files,
    cursor: (next as { pageToken?: string } | undefined)?.pageToken,
  }
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
      // Numeric positions avoid exposing Storage cursors that can encode owner IDs.
      if (
        body.cursor !== undefined &&
        (typeof body.cursor !== 'string' ||
          !/^\d{1,9}:\d{1,9}$/.test(body.cursor))
      )
        throw new RequestError(400, 'Invalid cursor')
      let [fileIndex, permissionIndex] = String(body.cursor ?? '0:0')
        .split(':')
        .map(Number)
      const [files] = await getStorage().bucket().getFiles({
        prefix: 'organization-permissions/',
        matchGlob: '**/ledger.json',
      })
      const sightings = []
      let scanned = 0
      while (
        fileIndex < files.length &&
        sightings.length < 50 &&
        scanned++ < 25
      ) {
        const uid = files[fileIndex].name.split('/')[1]
        const ledger = (await readLedger(uid)).value
        while (
          permissionIndex < ledger.permissions.length &&
          sightings.length < 50
        ) {
          const permission = ledger.permissions[permissionIndex++]
          if (
            permission.organizationId !== organizationId ||
            ledger.blockedOrganizations?.[organizationId]
          )
            continue
          const summary = sharedSighting(uid, permission)
          if (summary) sightings.push(summary)
        }
        if (permissionIndex >= ledger.permissions.length) {
          fileIndex++
          permissionIndex = 0
        }
      }
      await assertAccess(authorize, identity.uid, organizationId)
      res.json({
        sightings,
        cursor:
          fileIndex < files.length ? `${fileIndex}:${permissionIndex}` : null,
      })
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
    let cursor: string | undefined
    let found: { uid: string; permission: Permission } | undefined
    do {
      const page = await ledgerPage(cursor)
      cursor = page.cursor
      for (const file of page.files) {
        const uid = file.name.split('/')[1]
        const ledger = (await readLedger(uid)).value
        if (ledger.blockedOrganizations?.[organizationId]) continue
        const permission = ledger.permissions.find(
          (p) =>
            p.organizationId === organizationId &&
            sharedSighting(uid, p)?.id === body.id &&
            !p.revokedAt,
        )
        if (permission) {
          found = { uid, permission }
          break
        }
      }
    } while (cursor && !found)
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
    const [metadata] = await file.getMetadata()
    if (Number(metadata.size) > 20 * 1024 * 1024)
      throw new RequestError(400, 'Photo too large')
    const [bytes] = await file.download()
    const sanitized = await sanitizePhoto(bytes)
    const current = (await readLedger(found.uid)).value
    const stillShared = current.permissions.find(
      (p) =>
        p.organizationId === organizationId &&
        p.submissionId === found!.permission.submissionId,
    )
    if (
      current.blockedOrganizations?.[organizationId] ||
      !stillShared ||
      stillShared.revokedAt ||
      !stillShared.fields.photos ||
      stillShared.data.photoPaths?.[index] !== path
    )
      throw new RequestError(404, 'Photo unavailable')
    await assertAccess(authorize, identity.uid, organizationId)
    res.json({
      image: `data:image/jpeg;base64,${sanitized.toString('base64')}`,
    })
    return true
  }
}
