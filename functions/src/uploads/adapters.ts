/**
 * Admin SDK adapters for the upload admission (#486). Kept apart from
 * index.ts so tests can run them against a fake bucket or the emulators.
 */
import { createHmac } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import {
  UPLOAD_GRANTS_CLAIM,
  personLedgerPath,
  uidIndexPath,
  userPrefix,
} from '../submissionLayout'
import {
  emptyLedger,
  retireUid,
  type AdmissionPorts,
  type PersonIndex,
  type PersonLedger,
  type UploadGrants,
} from './admission'

const code = (error: unknown) => (error as { code?: unknown } | null)?.code
const LEDGER_WRITE_ATTEMPTS = 6

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
      return (JSON.parse(bytes.toString()) as { personId: string }).personId
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
    verifyIdToken: (token) => getAuth().verifyIdToken(token),
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
 * Use this function at account erasure: retire the uid from its person's
 * ledger, then drop its pointer. The person and email pointers stay, so a
 * new account with the same email inherits the limits. Idempotent.
 */
export async function retireUploadIdentity(
  bucketName: string,
  uid: string,
  sightingsDeleted: boolean,
): Promise<void> {
  const pointer = getStorage().bucket(bucketName).file(uidIndexPath(uid))
  let personId: string
  try {
    const [bytes] = await pointer.download()
    personId = (JSON.parse(bytes.toString()) as { personId: string }).personId
  } catch (error) {
    if (code(error) === 404) return
    throw error
  }
  const ledgers = ledgerStore(bucketName)
  for (let attempt = 0; ; attempt++) {
    const { value, generation } = await ledgers.read(personId)
    if (
      generation === 0 ||
      (await ledgers.write(
        personId,
        retireUid(value, uid, sightingsDeleted),
        generation,
      ))
    )
      break
    if (attempt + 1 >= LEDGER_WRITE_ATTEMPTS)
      throw new Error('Concurrent ledger update; retry')
  }
  await pointer.delete({ ignoreNotFound: true })
}
