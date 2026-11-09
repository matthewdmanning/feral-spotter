import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { getFirestore, Transaction } from 'firebase-admin/firestore'
import sharp from 'sharp'
import { handleOrganizationsRequest } from '../api'
import { organizationFeatures } from '../features'
import { writeCatalog, eraseOrganizationData } from '../store'
import {
  DEFAULT_SHARING,
  type Catalog,
  type GrantRequest,
  type PermissionLedger,
} from '../domain'

let app: App
let server: Server
let apiUrl: string
export const fixtureId = `org-emulator-${process.pid}-${Date.now()}`
const createdUids: string[] = []
const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ] as [number, number][],
  ],
}
export const catalog: Catalog = {
  version: 'integration-v1',
  organizations: ['first', 'second'].map((id) => ({
    id,
    name: `${id} rescue`,
    active: true,
    coverage: square,
  })),
}

/** Fails before initializing Admin SDK if a live endpoint could be used. */
function requireLoopback(name: string, protocol = 'http://'): string {
  const value = process.env[name]
  const url = value
    ? new URL(value.includes('://') ? value : `${protocol}${value}`)
    : null
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error(`${name} must point to a local emulator`)
  return url.origin
}
export const bucket = () => getStorage().bucket()
export async function save(path: string, value: unknown) {
  await bucket().file(path).save(JSON.stringify(value), {
    resumable: false,
    contentType: 'application/json',
  })
}
/** A real emulator account with one submitted sighting at the given point. */
export async function signedInUser(
  label: string,
  sighting = { latitude: 1.00123, longitude: 1.00456 },
) {
  const uid = `${fixtureId}-${label}-${createdUids.length}`
  createdUids.push(uid)
  await getAuth().createUser({ uid, email: `${uid}@example.test` })
  const response = await fetch(
    `${requireLoopback('FIREBASE_AUTH_EMULATOR_HOST')}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: await getAuth().createCustomToken(uid),
        returnSecureToken: true,
      }),
    },
  )
  if (!response.ok) throw new Error('Emulator sign-in failed')
  await save(`submissions/${uid}/sighting/metadata.json`, {
    submission: { ...sighting, report_injured: true },
    cats: [{ health_label: 'poor', local_id: 'internal' }],
    photo_paths: [`submissions/${uid}/sighting/cat.jpg`],
  })
  const { idToken } = (await response.json()) as { idToken: string }
  return { uid, email: `${uid}@example.test`, token: idToken }
}
export async function call(body: unknown, token?: string) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    body: response.headers.get('content-type')?.includes('application/json')
      ? ((await response.json()) as PermissionLedger & {
          requiresConfirmation?: boolean
        })
      : null,
  }
}
let organizationCount = 0
/** New organizations for one test, so no test reads another test's shares or members. */
export async function createOrganizations(count: number) {
  const ids = Array.from(
    { length: count },
    () => `org-${process.pid}-${++organizationCount}`,
  )
  await writeCatalog({
    ...catalog,
    organizations: [
      ...catalog.organizations,
      ...ids.map((id) => ({ ...catalog.organizations[0], id, name: id })),
    ],
  })
  return ids
}
/** Adds one photo carrying private EXIF and storage metadata to the user's sighting. */
export async function savePhoto(uid: string) {
  const path = `submissions/${uid}/sighting/photo-0.jpg`
  const photo = await sharp({
    create: { width: 20, height: 10, channels: 3, background: 'red' },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'private' } } })
    .toBuffer()
  await bucket()
    .file(path)
    .save(photo, {
      resumable: false,
      contentType: 'image/jpeg',
      metadata: { metadata: { latitude: 'private' } },
    })
  const metadata = bucket().file(`submissions/${uid}/sighting/metadata.json`)
  const [bytes] = await metadata.download()
  await save(metadata.name, {
    ...JSON.parse(bytes.toString()),
    photo_paths: [path],
  })
  return path
}
/** Fails the first Firestore write ending this user's membership; application logic stays real. */
export async function withMembershipEndFailure<T>(
  uid: string,
  run: () => Promise<T>,
) {
  const prototype = Transaction.prototype as unknown as {
    set: (...args: unknown[]) => unknown
  }
  const setOriginal = prototype.set
  let failed = false
  const fault = jest.spyOn(prototype, 'set').mockImplementation(function (
    this: unknown,
    ...args: unknown[]
  ) {
    const [reference, data] = args as [
      { path: string },
      { ownerUid?: string; status?: string },
    ]
    if (
      !failed &&
      reference.path.startsWith('organizationMemberships/') &&
      data.ownerUid === uid &&
      data.status === 'left'
    ) {
      failed = true
      throw Object.assign(new Error('Temporary Firestore failure'), {
        code: 503,
      })
    }
    return setOriginal.apply(this, args)
  })
  try {
    return await run()
  } finally {
    fault.mockRestore()
  }
}
export function grant(
  organizationId: string,
  overrides: Partial<GrantRequest> = {},
  mutationId = `grant-${organizationId}`,
) {
  return {
    action: 'grant',
    mutationId,
    organizationId,
    grant: {
      submissionId: 'sighting',
      organizationId,
      catalogVersion: catalog.version,
      epoch: 0,
      anonymous: true,
      settings: DEFAULT_SHARING,
      disclosureVersion: 1,
      ...overrides,
    },
  }
}

/** Serves the real organizations API against local emulators for one test file. */
export function serveEmulatorApi() {
  beforeAll(async () => {
    requireLoopback('FIREBASE_AUTH_EMULATOR_HOST')
    requireLoopback('FIREBASE_STORAGE_EMULATOR_HOST')
    if (process.env.STORAGE_EMULATOR_HOST)
      requireLoopback('STORAGE_EMULATOR_HOST')
    const projectId = process.env.GCLOUD_PROJECT
    if (!projectId)
      throw new Error('Run through the repository emulator runner')
    requireLoopback('FIRESTORE_EMULATOR_HOST')
    app = initializeApp({
      projectId,
      storageBucket: `${projectId}.firebasestorage.app`,
    })
    const service = express()
    service.use(express.json())
    service.post('/', (req, res, next) => {
      void handleOrganizationsRequest(req, res, organizationFeatures).catch(
        next,
      )
    })
    server = await new Promise<Server>((resolve) => {
      const listening = service.listen(0, '127.0.0.1', () => resolve(listening))
    })
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  })
  beforeEach(() => writeCatalog(catalog))
  // Global cleanup: safe only because the emulator lane runs files serially (--runInBand).
  afterAll(async () => {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    if (!app) return
    await getFirestore().doc('organizationCatalog/current').delete()
    for (const doc of (await getFirestore().collection('organizations').get())
      .docs)
      await doc.ref.delete()
    for (const uid of createdUids) {
      await bucket().deleteFiles({ prefix: `submissions/${uid}/` })
      await eraseOrganizationData(uid)
      await getAuth()
        .deleteUser(uid)
        .catch(() => {})
    }
    await deleteApp(app)
  })
}
