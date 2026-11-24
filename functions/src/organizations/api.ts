import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import type { Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { defineString } from 'firebase-functions/params'
import {
  covers,
  DEFAULT_CACHE_RADIUS_KM,
  effectiveSharingSettings,
  isSharedPhotoPath,
  projectData,
  SHARING_FIELD_KEYS,
  SHARING_NAME_MAX_LENGTH,
  SHARING_PHONE_MAX_LENGTH,
  validId,
  validLocation,
  type GrantRequest,
  type Permission,
  type PermissionLedger,
} from './domain'
import type { LedgerMutation } from './ledger'
import {
  readCatalog,
  readOrganization,
  readLedger,
  updateLedger,
} from './store'
import { errorCode, RequestError } from './errors'
import { isStoredPhotoFileName } from '../submissionLayout'

const CACHE_RADIUS_KM = defineString('ORGANIZATIONS_CACHE_RADIUS_KM', {
  default: String(DEFAULT_CACHE_RADIUS_KM),
})
const bucket = () => getStorage().bucket()
const publicLedger = ({ epochs, permissions }: PermissionLedger) => ({
  epochs,
  permissions,
})

export function validateGrant(input: unknown): GrantRequest {
  const request = input as GrantRequest
  if (
    !request ||
    !validId(request.submissionId) ||
    !validId(request.organizationId) ||
    typeof request.catalogVersion !== 'string' ||
    !Number.isSafeInteger(request.epoch) ||
    request.epoch < 0 ||
    typeof request.anonymous !== 'boolean' ||
    request.disclosureVersion !== 1
  )
    throw new RequestError(400, 'Invalid sharing confirmation')
  const settings = request.settings
  if (
    !settings ||
    typeof settings.name !== 'string' ||
    settings.name.length > SHARING_NAME_MAX_LENGTH ||
    typeof settings.phone !== 'string' ||
    settings.phone.length > SHARING_PHONE_MAX_LENGTH ||
    !settings.fields ||
    SHARING_FIELD_KEYS.some((key) => typeof settings.fields[key] !== 'boolean')
  )
    throw new RequestError(400, 'Invalid sharing settings')
  return request
}
async function readSubmission(uid: string, submissionId: string) {
  const prefix = `submissions/${uid}/${submissionId}/`
  let bytes: Buffer
  try {
    ;[bytes] = await bucket().file(`${prefix}metadata.json`).download()
  } catch (error) {
    if (errorCode(error) === 404)
      throw new RequestError(404, 'Sighting not found')
    throw error
  }
  const metadata = JSON.parse(bytes.toString()) as {
    submission: {
      latitude?: number
      longitude?: number
      report_injured?: boolean
    }
    cats: Record<string, unknown>[]
    photo_paths: string[]
    photo_pairs?: { jpeg_path: string; dng_path: string }[]
  }
  /** Use this function to reject metadata paths outside the owning Submission. */
  const pathInSubmission = (value: unknown): value is string => {
    if (typeof value !== 'string' || !value.startsWith(prefix)) return false
    const fileName = value.slice(prefix.length)
    return (
      fileName.length > 0 &&
      !fileName.includes('/') &&
      fileName !== 'metadata.json'
    )
  }
  /** Use this function to admit only supported artifact names in a pair. */
  const pairedPathInSubmission = (value: unknown): value is string =>
    pathInSubmission(value) && isStoredPhotoFileName(value.slice(prefix.length))
  const validPhotoPaths =
    Array.isArray(metadata.photo_paths) &&
    metadata.photo_paths.every((path) => pathInSubmission(path))
  const pairJpegs = new Set<string>()
  const pairDngs = new Set<string>()
  const validPhotoPairs =
    metadata.photo_pairs == null ||
    (validPhotoPaths &&
      Array.isArray(metadata.photo_pairs) &&
      metadata.photo_pairs.every((pair) => {
        if (
          pair == null ||
          !pairedPathInSubmission(pair.jpeg_path) ||
          !pairedPathInSubmission(pair.dng_path) ||
          pair.jpeg_path.endsWith('.dng') ||
          !pair.dng_path.endsWith('.dng') ||
          !metadata.photo_paths.includes(pair.jpeg_path)
        )
          return false
        const jpegSlot = pair.jpeg_path
          .slice(prefix.length)
          .replace(/\.[^.]+$/, '')
        const dngSlot = pair.dng_path
          .slice(prefix.length)
          .replace(/\.[^.]+$/, '')
        if (
          jpegSlot !== dngSlot ||
          pairJpegs.has(pair.jpeg_path) ||
          pairDngs.has(pair.dng_path)
        )
          return false
        pairJpegs.add(pair.jpeg_path)
        pairDngs.add(pair.dng_path)
        return true
      }))
  if (
    !Array.isArray(metadata.cats) ||
    metadata.cats.length < 1 ||
    !Array.isArray(metadata.photo_paths) ||
    !validPhotoPaths ||
    !validPhotoPairs
  )
    throw new RequestError(400, 'Invalid submitted sighting')
  return metadata
}
export async function makePermission(
  uid: string,
  email: string | undefined,
  request: GrantRequest,
): Promise<Permission> {
  if (
    !request.anonymous &&
    request.settings.fields.email &&
    request.contactEmail !== (email ?? null)
  )
    throw RequestError.confirmAgain('Contact email changed; confirm again')
  let selected: Awaited<ReturnType<typeof readOrganization>>
  try {
    selected = await readOrganization(request.organizationId)
  } catch (error) {
    if (error instanceof RequestError && error.status === 404)
      throw RequestError.confirmAgain('Organization unavailable; confirm again')
    throw error
  }
  const { catalog, organization: org } = selected
  if (catalog.version !== request.catalogVersion)
    throw RequestError.confirmAgain('Directory changed; confirm again')
  const metadata = await readSubmission(uid, request.submissionId)
  const location = metadata.submission
  if (
    !validLocation(location) ||
    !covers(org.coverage, location.latitude, location.longitude)
  )
    throw RequestError.confirmAgain('Sighting outside organization coverage')
  return {
    submissionId: request.submissionId,
    organizationId: org.id,
    organizationName: org.name,
    catalogVersion: catalog.version,
    epoch: request.epoch,
    confirmedAt: new Date().toISOString(),
    anonymous: request.anonymous,
    fields: effectiveSharingSettings(request.settings, request.anonymous)
      .fields,
    injured: metadata.submission.report_injured === true,
    disclosureVersion: 1,
    data: projectData({
      cats: metadata.cats,
      location,
      photoPaths: metadata.photo_paths.filter(isSharedPhotoPath),
      settings: request.settings,
      anonymous: request.anonymous,
      email,
    }),
  }
}
function parseMutation(
  uid: string,
  email: string | undefined,
  body: Record<string, unknown>,
): () => Promise<LedgerMutation> {
  const { action, organizationId, submissionId } = body
  if (!validId(organizationId))
    throw new RequestError(400, 'Invalid organization')
  if (action === 'grant') {
    const grant = validateGrant(body.grant)
    if (grant.organizationId !== organizationId)
      throw new RequestError(400, 'Organization mismatch')
    return async () => ({
      type: 'grant',
      organizationId,
      permission: await makePermission(uid, email, grant),
    })
  }
  if (action === 'revoke' && validId(submissionId))
    return async () => ({ type: 'revoke', organizationId, submissionId })
  if (action === 'revokeOrganization')
    return async () => ({ type: 'revokeOrganization', organizationId })
  throw new RequestError(400, 'Invalid action')
}
export type OrganizationExtension = (
  identity: DecodedIdToken,
  body: Record<string, unknown>,
  res: Response,
) => Promise<boolean>

/** Authenticated core consent API; optional feature routes are composed separately. */
export async function handleOrganizationsRequest(
  req: Pick<Request, 'method' | 'body' | 'header'>,
  res: Response,
  extension?: OrganizationExtension,
): Promise<void> {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  const authorization = req.header('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).end()
    return
  }
  let identity
  try {
    identity = await getAuth().verifyIdToken(authorization.slice(7), true)
  } catch (error) {
    const code = String(errorCode(error) ?? '')
    const invalid = [
      'auth/argument-error',
      'auth/id-token-expired',
      'auth/id-token-revoked',
      'auth/invalid-id-token',
      'auth/user-disabled',
      'auth/user-not-found',
    ].includes(code)
    res.status(invalid ? 401 : 503).json({
      code: invalid ? 'UNAUTHENTICATED' : 'UNAVAILABLE',
      retryable: !invalid,
    })
    return
  }
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
      throw new RequestError(400, 'Invalid request body')
    const body = req.body as Record<string, unknown>
    if (extension && (await extension(identity, body, res))) return
    if (body.action === 'catalog') {
      const radius = Number(CACHE_RADIUS_KM.value())
      res.json({
        ...(await readCatalog()),
        cacheRadiusKm:
          Number.isFinite(radius) && radius > 0
            ? radius
            : DEFAULT_CACHE_RADIUS_KM,
      })
      return
    }
    if (body.action === 'list') {
      res.json(publicLedger(await readLedger(identity.uid)))
      return
    }
    if (!validId(body.mutationId))
      throw new RequestError(400, 'Invalid mutation')
    const build = parseMutation(identity.uid, identity.email, body)
    res.json(
      publicLedger(await updateLedger(identity.uid, body.mutationId, build)),
    )
  } catch (error) {
    // Do not log tokens, submission contents or contact values.
    const status = error instanceof RequestError ? error.status : 503
    if (status === 429 || status === 503) res.set('Retry-After', '5')
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'REVIEW_REQUIRED',
      429: 'RATE_LIMITED',
      503: 'UNAVAILABLE',
    }
    res.status(status).json({
      code: codes[status],
      message:
        error instanceof RequestError
          ? error.message
          : 'Organization service is temporarily unavailable',
      requiresConfirmation: status === 409,
      retryable: status === 429 || status === 503,
    })
  }
}
