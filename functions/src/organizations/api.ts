import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import type { Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { onRequest } from 'firebase-functions/v2/https'
import { defineString } from 'firebase-functions/params'
import {
  covers,
  parseCatalog,
  projectData,
  validId,
  validLocation,
  type GrantRequest,
  type Permission,
  type PermissionLedger,
} from './domain'
import { mutateLedger, type LedgerMutation } from './ledger'

const CATALOG_PATH = defineString('ORGANIZATIONS_CATALOG_PATH', {
  default: 'organizations/catalog.json',
})
const CACHE_RADIUS_KM = defineString('ORGANIZATIONS_CACHE_RADIUS_KM', {
  default: '50',
})
interface StoredLedger extends PermissionLedger {
  applied: string[]
}
const emptyLedger = (): StoredLedger => ({
  epochs: {},
  permissions: [],
  applied: [],
})

async function readCatalog() {
  try {
    const [bytes] = await getStorage()
      .bucket()
      .file(CATALOG_PATH.value())
      .download()
    return parseCatalog(JSON.parse(bytes.toString()))
  } catch (error) {
    if ((error as { code?: number }).code === 404)
      return { version: 'empty-v1', organizations: [] }
    throw error
  }
}
async function readLedger(
  uid: string,
): Promise<{ value: StoredLedger; generation: number }> {
  const bucket = getStorage().bucket()
  const path = `organization-permissions/${uid}/ledger.json`
  try {
    const [metadata] = await bucket.file(path).getMetadata()
    const generation = Number(metadata.generation)
    const [bytes] = await bucket.file(path, { generation }).download()
    return { value: JSON.parse(bytes.toString()) as StoredLedger, generation }
  } catch (error) {
    if ((error as { code?: number }).code === 404)
      return { value: emptyLedger(), generation: 0 }
    throw error
  }
}
async function updateLedger(
  uid: string,
  id: string,
  mutation: LedgerMutation,
): Promise<PermissionLedger> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { value, generation } = await readLedger(uid)
    if (value.applied.includes(id)) return value
    const next = {
      ...mutateLedger(value, mutation, new Date().toISOString()),
      applied: [...value.applied, id],
    }
    // Bound one user's ledger independently of the upload cap.
    if (
      mutation.type === 'grant' &&
      (next.permissions.length > 5000 || next.applied.length > 20000)
    )
      throw new Error('Permission limit reached')
    try {
      await getStorage()
        .bucket()
        .file(`organization-permissions/${uid}/ledger.json`)
        .save(JSON.stringify(next), {
          resumable: false,
          contentType: 'application/json',
          preconditionOpts: { ifGenerationMatch: generation },
        })
      return next
    } catch (error) {
      if ((error as { code?: number }).code !== 412) throw error
    }
  }
  throw new Error('Concurrent update; retry')
}
function validateGrant(input: unknown): GrantRequest {
  const request = input as GrantRequest
  if (
    !request ||
    !validId(request.submissionId) ||
    !validId(request.organizationId) ||
    typeof request.catalogVersion !== 'string' ||
    !Number.isSafeInteger(request.epoch) ||
    request.epoch < 0 ||
    typeof request.anonymous !== 'boolean' ||
    typeof request.injured !== 'boolean' ||
    request.disclosureVersion !== 1
  )
    throw new Error('Invalid sharing confirmation')
  const settings = request.settings
  if (
    !settings ||
    typeof settings.name !== 'string' ||
    settings.name.length > 200 ||
    typeof settings.phone !== 'string' ||
    settings.phone.length > 50 ||
    !settings.fields ||
    ['name', 'email', 'phone', 'catDetails', 'preciseLocation', 'photos'].some(
      (key) =>
        typeof settings.fields[key as keyof typeof settings.fields] !==
        'boolean',
    )
  )
    throw new Error('Invalid sharing settings')
  return request
}
async function makePermission(
  uid: string,
  email: string | undefined,
  input: unknown,
): Promise<Permission> {
  const request = validateGrant(input)
  if (
    !request.anonymous &&
    request.settings.fields.email &&
    request.contactEmail !== (email ?? null)
  )
    throw new Error('Contact email changed; confirm again')
  const catalog = await readCatalog()
  if (catalog.version !== request.catalogVersion)
    throw new Error('Directory changed; confirm again')
  const org = catalog.organizations.find(
    (o) => o.id === request.organizationId && o.active,
  )
  if (!org) throw new Error('Organization unavailable; confirm again')
  const prefix = `submissions/${uid}/${request.submissionId}/`
  const [bytes] = await getStorage()
    .bucket()
    .file(`${prefix}metadata.json`)
    .download()
  const metadata = JSON.parse(bytes.toString()) as {
    submission: {
      latitude?: number
      longitude?: number
      report_injured?: boolean
    }
    cats: Record<string, unknown>[]
    photo_paths: string[]
  }
  const { latitude, longitude } = metadata.submission
  if (
    !validLocation(latitude, longitude) ||
    !covers(org.coverage, latitude, longitude!)
  )
    throw new Error('Sighting outside organization coverage')
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
    throw new Error('Invalid submitted sighting')
  return {
    submissionId: request.submissionId,
    organizationId: org.id,
    organizationName: org.name,
    catalogVersion: catalog.version,
    epoch: request.epoch,
    confirmedAt: new Date().toISOString(),
    anonymous: request.anonymous,
    fields: {
      ...request.settings.fields,
      ...(request.anonymous ? { name: false, email: false, phone: false } : {}),
    },
    injured: metadata.submission.report_injured === true,
    disclosureVersion: 1,
    data: projectData({
      cats: metadata.cats,
      latitude,
      longitude: longitude!,
      photoPaths: metadata.photo_paths,
      fields: request.settings.fields,
      anonymous: request.anonymous,
      contact: {
        name: request.settings.name,
        phone: request.settings.phone,
        email,
      },
    }),
  }
}
/** Owner-only catalog/consent API. No endpoint grants organizations access to app data. */
export async function handleOrganizationsRequest(
  req: Pick<Request, 'method' | 'body' | 'header'>,
  res: Response,
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
    const { action, mutationId, organizationId, submissionId } = req.body ?? {}
    if (action === 'catalog') {
      const radius = Number(CACHE_RADIUS_KM.value())
      res.json({
        ...(await readCatalog()),
        cacheRadiusKm: Number.isFinite(radius) && radius > 0 ? radius : 50,
      })
      return
    }
    if (action === 'list') {
      const { value } = await readLedger(identity.uid)
      res.json({ epochs: value.epochs, permissions: value.permissions })
      return
    }
    if (!validId(mutationId) || !validId(organizationId)) {
      res.status(400).end()
      return
    }
    const previous = await readLedger(identity.uid)
    if (previous.value.applied.includes(mutationId)) {
      res.json({
        epochs: previous.value.epochs,
        permissions: previous.value.permissions,
      })
      return
    }
    let mutation: LedgerMutation
    if (action === 'grant') {
      const permission = await makePermission(
        identity.uid,
        identity.email,
        req.body.grant,
      )
      if (permission.organizationId !== organizationId)
        throw new Error('Organization mismatch')
      mutation = { type: 'grant', organizationId, permission }
    } else if (action === 'revoke' && validId(submissionId)) {
      mutation = { type: 'revoke', organizationId, submissionId }
    } else if (action === 'revokeOrganization') {
      mutation = { type: 'revokeOrganization', organizationId }
    } else {
      res.status(400).end()
      return
    }
    const result = await updateLedger(identity.uid, mutationId, mutation)
    res.json({ epochs: result.epochs, permissions: result.permissions })
  } catch (error) {
    // Do not log tokens, submission contents or contact values.
    const message =
      error instanceof Error ? error.message : 'Permission sync failed'
    const requiresConfirmation =
      /confirm again|outside organization|revoked/.test(message)
    res.status(requiresConfirmation ? 409 : 503).json({ requiresConfirmation })
  }
}

export const organizationsApi = onRequest(
  { cors: false },
  handleOrganizationsRequest,
)
