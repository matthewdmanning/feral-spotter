import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import type { Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { onRequest } from 'firebase-functions/v2/https'
import { defineString } from 'firebase-functions/params'
import {
  covers,
  DEFAULT_CACHE_RADIUS_KM,
  effectiveSharingSettings,
  parseCatalog,
  projectData,
  SHARING_FIELD_KEYS,
  validId,
  validLocation,
  type Catalog,
  type GrantRequest,
  type Permission,
  type PermissionLedger,
} from './domain'
import { mutateLedger, type LedgerMutation } from './ledger'
import { errorCode, RequestError } from './errors'

const CATALOG_PATH = defineString('ORGANIZATIONS_CATALOG_PATH', {
  default: 'organizations/catalog.json',
})
const CACHE_RADIUS_KM = defineString('ORGANIZATIONS_CACHE_RADIUS_KM', {
  default: String(DEFAULT_CACHE_RADIUS_KM),
})
const MAX_PERMISSIONS = 5000
const MAX_APPLIED_MUTATIONS = 20000
const LEDGER_WRITE_ATTEMPTS = 6

interface StoredLedger extends PermissionLedger {
  applied: string[]
}
const emptyLedger = (): StoredLedger => ({
  epochs: {},
  permissions: [],
  applied: [],
})
const ledgerPath = (uid: string) =>
  `organization-permissions/${uid}/ledger.json`
const bucket = () => getStorage().bucket()
const publicLedger = ({ epochs, permissions }: PermissionLedger) => ({
  epochs,
  permissions,
})

export async function readCatalog(): Promise<Catalog> {
  try {
    const [bytes] = await bucket().file(CATALOG_PATH.value()).download()
    return parseCatalog(JSON.parse(bytes.toString()))
  } catch (error) {
    if (errorCode(error) === 404)
      return { version: 'empty-v1', organizations: [] }
    throw error
  }
}
export async function readLedger(
  uid: string,
): Promise<{ value: StoredLedger; generation: number }> {
  const path = ledgerPath(uid)
  try {
    const [metadata] = await bucket().file(path).getMetadata()
    const generation = Number(metadata.generation)
    const [bytes] = await bucket().file(path, { generation }).download()
    return { value: JSON.parse(bytes.toString()) as StoredLedger, generation }
  } catch (error) {
    if (errorCode(error) === 404) return { value: emptyLedger(), generation: 0 }
    throw error
  }
}
/** Compare-and-swap on the ledger generation. A replayed mutation ID is answered without rebuilding it. */
export async function updateLedger(
  uid: string,
  id: string,
  build: () => Promise<LedgerMutation>,
): Promise<PermissionLedger> {
  let mutation: LedgerMutation | undefined
  for (let attempt = 0; attempt < LEDGER_WRITE_ATTEMPTS; attempt++) {
    const { value, generation } = await readLedger(uid)
    if (value.applied.includes(id)) return value
    mutation ??= await build()
    const next = {
      ...mutateLedger(value, mutation, new Date().toISOString()),
      applied: [...value.applied, id],
    }
    // Bound one user's ledger independently of the upload cap; revocations stay available.
    if (
      mutation.type === 'grant' &&
      (next.permissions.length > MAX_PERMISSIONS ||
        next.applied.length > MAX_APPLIED_MUTATIONS)
    )
      throw new RequestError(429, 'Permission limit reached')
    try {
      await bucket()
        .file(ledgerPath(uid))
        .save(JSON.stringify(next), {
          resumable: false,
          contentType: 'application/json',
          preconditionOpts: { ifGenerationMatch: generation },
        })
      return next
    } catch (error) {
      if (errorCode(error) !== 412) throw error
    }
  }
  throw new Error('Concurrent update; retry')
}
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
  const catalog = await readCatalog()
  if (catalog.version !== request.catalogVersion)
    throw RequestError.confirmAgain('Directory changed; confirm again')
  const org = catalog.organizations.find(
    (o) => o.id === request.organizationId && o.active,
  )
  if (!org)
    throw RequestError.confirmAgain('Organization unavailable; confirm again')
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

/** Owner-only catalog/consent API. No endpoint grants organizations access to app data. */
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
  } catch {
    res.status(401).end()
    return
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
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
      res.json(publicLedger((await readLedger(identity.uid)).value))
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
    res.status(status).json({ requiresConfirmation: status === 409 })
  }
}

export const organizationsApi = onRequest(
  { cors: false },
  handleOrganizationsRequest,
)
