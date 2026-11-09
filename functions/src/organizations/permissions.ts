import { createHash } from 'node:crypto'
import type { Permission } from './domain'
import { RequestError } from './errors'

/** Authorization is supplied by the composing feature, never inferred from consent. */
export function requireOrganizationAccess(authorized: boolean): void {
  if (!authorized) throw new RequestError(403, 'Organization access denied')
}

export interface SharedSighting {
  id: string
  catCount: number
  generalLocation: Permission['data']['generalLocation']
  preciseLocation?: Permission['data']['preciseLocation']
  cats?: Permission['data']['cats']
  photoCount: number
}

export function sharedSighting(
  uid: string,
  permission: Permission,
): SharedSighting | null {
  if (permission.revokedAt) return null
  return {
    id: createHash('sha256')
      .update(`${uid}/${permission.organizationId}/${permission.submissionId}`)
      .digest('hex'),
    catCount: permission.data.catCount,
    generalLocation: permission.data.generalLocation,
    ...(permission.fields.preciseLocation && permission.data.preciseLocation
      ? { preciseLocation: permission.data.preciseLocation }
      : {}),
    ...(permission.fields.catDetails && permission.data.cats
      ? { cats: permission.data.cats }
      : {}),
    photoCount: permission.fields.photos
      ? (permission.data.photoPaths?.length ?? 0)
      : 0,
  }
}
