import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import type { Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { defineString } from 'firebase-functions/params'
import {
  covers,
  DEFAULT_CACHE_RADIUS_KM,
  effectiveSharingSettings,
  projectData,
  SHARING_FIELD_KEYS,
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
    settings.name.length > 200 ||
    typeof settings.phone !== 'string' ||
    settings.phone.length > 50 ||
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
  }
  if (
    !Array.isArray(metadata.cats) ||
    metadata.cats.length < 1 ||
    !Array.isArray(metadata.photo_paths) ||
    metadata.photo_paths.some(
      (path) =>
        typeof path !== 'string' ||
        !path.startsWith(prefix) ||
        path.slice(prefix.length).includes('/') ||
        path.endsWith('metadata.json'),
    )
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
      photoPaths: metadata.photo_paths,
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
  identity: import('firebase-admin/auth').DecodedIdToken,
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
