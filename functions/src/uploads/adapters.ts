/**
 * Admin SDK adapters for the upload admission (#486). Kept apart from
 * index.ts so tests can run them against a fake bucket or the emulators.
 */
import { createHmac } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import {
  UPLOAD_GRANTS_CLAIM,
  parseSubmissionObject,
  personLedgerPath,
  uidIndexPath,
  userPrefix,
} from '../submissionLayout'
import {
  emptyLedger,
  ERASED_ACCOUNT,
  retireUid,
  type AdmissionPorts,
  type PersonIndex,
  type PersonLedger,
  type UploadGrants,
} from './admission'

const code = (error: unknown) => (error as { code?: unknown } | null)?.code
const LEDGER_WRITE_ATTEMPTS = 6

interface PersonPointer {
  personId?: string
  erasing?: true
  deleteSightings?: boolean
}

function decodePointer(bytes: Buffer): PersonPointer {
  return JSON.parse(bytes.toString()) as PersonPointer
}

/** Use this function to copy one uid's live grants into its custom claims. */
export async function publishUploadGrants(
  uid: string,
  grants: UploadGrants,
): Promise<void> {
  const { customClaims } = await getAuth().getUser(uid)
  await getAuth().setCustomUserClaims(uid, {
    ...customClaims,
    [UPLOAD_GRANTS_CLAIM]: grants,
  })
}

function ledgerStore(bucketName: string) {
  const bucket = () => getStorage().bucket(bucketName)
  return {
    read: async (
      personId: string,
    ): Promise<{ value: PersonLedger; generation: number }> => {
      const path = personLedgerPath(personId)
      try {
        const [metadata] = await bucket().file(path).getMetadata()
        const generation = Number(metadata.generation)
        // Read the generation just checked, so the precondition matches it.
        const [bytes] = await bucket().file(path, { generation }).download()
        return {
          value: {
            ...emptyLedger(),
            ...(JSON.parse(bytes.toString()) as Partial<PersonLedger>),
          },
          generation,
        }
      } catch (error) {
        if (code(error) === 404) return { value: emptyLedger(), generation: 0 }
        throw error
      }
    },
    write: async (
      personId: string,
      value: PersonLedger,
      generation: number,
    ): Promise<boolean> => {
      try {
        // ifGenerationMatch 0 means "only if absent".
        await bucket()
          .file(personLedgerPath(personId))
          .save(JSON.stringify(value), {
            resumable: false,
            contentType: 'application/json',
            preconditionOpts: { ifGenerationMatch: generation },
          })
        return true
      } catch (error) {
        if (code(error) === 412) return false
        throw error
      }
    },
  }
}

/** Use this function to build the write-once person index over one bucket. */
export function createPersonIndex(
  bucketName: string,
  identityKey: () => string,
): PersonIndex {
  const bucket = () => getStorage().bucket(bucketName)
  const read = async (path: string) => {
    try {
      const [bytes] = await bucket().file(path).download()
      const pointer = decodePointer(bytes)
      return pointer.erasing ? ERASED_ACCOUNT : pointer.personId
    } catch (error) {
      if (code(error) === 404) return undefined
      throw error
    }
  }
  return {
    read,
    bind: async (path, personId) => {
      try {
        await bucket()
          .file(path)
          .save(JSON.stringify({ personId }), {
            resumable: false,
            contentType: 'application/json',
            preconditionOpts: { ifGenerationMatch: 0 },
          })
        return personId
      } catch (error) {
        if (code(error) !== 412) throw error
        const bound = await read(path)
        if (!bound) throw error
        return bound
      }
    },
    emailKey: (email) =>
      createHmac('sha256', identityKey()).update(email).digest('hex'),
  }
}

/** Use this function to build the admission's ports over one bucket. */
export function createUploadAdmissionPorts(
  bucketName: string,
  identityKey: () => string,
): AdmissionPorts {
  const bucket = () => getStorage().bucket(bucketName)
  const ledgers = ledgerStore(bucketName)
  return {
    verifyIdToken: async (token) => {
      const auth = getAuth()
      const { uid } = await auth.verifyIdToken(token)
      const { email, emailVerified, disabled } = await auth.getUser(uid)
      if (disabled) throw new Error('Account disabled')
      return { uid, email, emailVerified }
    },
    index: createPersonIndex(bucketName, identityKey),
    readLedger: ledgers.read,
    writeLedger: ledgers.write,
    listStored: async (uids) => {
      const stored = new Map<string, number>()
      for (const uid of uids) {
        const [files] = await bucket().getFiles({ prefix: userPrefix(uid) })
        for (const file of files)
          stored.set(file.name, Number(file.metadata?.size ?? 0))
      }
      return stored
    },
    publishGrants: publishUploadGrants,
    now: () => Date.now(),
  }
}

/**
 * Mark the UID as erasing before touching its ledger. Keep the person
 * binding until retirement succeeds, so an interrupted erasure can retry.
 */
export async function retireUploadIdentity(
  bucketName: string,
  uid: string,
  sightingsDeleted: boolean,
): Promise<void> {
  const marker = await updateErasurePointer(bucketName, uid, sightingsDeleted)
  if (!marker.personId) return
  const personId = marker.personId
  const ledgers = ledgerStore(bucketName)
  for (let attempt = 0; ; attempt++) {
    const { value, generation } = await ledgers.read(personId)
    // Even an empty ledger must advance its generation to fence a first
    // admission that saw the original pointer and is about to write.
    if (
      await ledgers.write(
        personId,
        retireUid(value, uid, marker.deleteSightings === true),
        generation,
      )
    )
      break
    if (attempt + 1 >= LEDGER_WRITE_ATTEMPTS)
      throw new Error('Concurrent ledger update; retry')
  }
  if (marker.deleteSightings)
    await updateErasurePointer(bucketName, uid, true, true)
}

async function updateErasurePointer(
  bucketName: string,
  uid: string,
  deleteSightings: boolean,
  retirementComplete = false,
): Promise<PersonPointer> {
  const bucket = getStorage().bucket(bucketName)
  const path = uidIndexPath(uid)
  const file = bucket.file(path)
  for (let attempt = 0; attempt < LEDGER_WRITE_ATTEMPTS; attempt++) {
    let generation = 0
    let current: PersonPointer = {}
    try {
      const [metadata] = await file.getMetadata()
      generation = Number(metadata.generation)
      const [bytes] = await bucket.file(path, { generation }).download()
      current = decodePointer(bytes)
    } catch (error) {
      if (code(error) !== 404) throw error
      if (generation !== 0) continue
    }
    const next: PersonPointer = {
      erasing: true,
      personId: retirementComplete ? undefined : current.personId,
      deleteSightings: current.deleteSightings === true || deleteSightings,
    }
    try {
      await file.save(JSON.stringify(next), {
        resumable: false,
        contentType: 'application/json',
        preconditionOpts: { ifGenerationMatch: generation },
      })
      return next
    } catch (error) {
      if (code(error) !== 412) throw error
    }
  }
  throw new Error('Concurrent erasure pointer update; retry')
}

/** Remove an object finalized under a grant that predates account erasure. */
export async function deleteLateErasedUpload(
  bucketName: string,
  name: string,
  generation: number,
): Promise<boolean> {
  const object = parseSubmissionObject(name)
  if (!object) return false
  const bucket = getStorage().bucket(bucketName)
  let marker: PersonPointer
  try {
    const [bytes] = await bucket.file(uidIndexPath(object.uid)).download()
    marker = decodePointer(bytes)
  } catch (error) {
    if (code(error) === 404) return false
    throw error
  }
  if (!marker.erasing || !marker.deleteSightings) return false
  await bucket.file(name, { generation }).delete({ ignoreNotFound: true })
  return true
}
