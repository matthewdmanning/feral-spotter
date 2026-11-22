/**
 * Admin SDK adapters for the upload admission (#486). Kept apart from
 * index.ts so tests can run them against a fake bucket or the emulators.
 */
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import {
  UPLOAD_GRANTS_CLAIM,
  uploadQuotaLedgerPath,
  userPrefix,
} from '../submissionLayout'
import type { AdmissionPorts, QuotaLedger, UploadGrants } from './admission'

const code = (error: unknown) => (error as { code?: unknown } | null)?.code

/** Use this function to copy the live grants into the uid's custom claims. */
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

/** Use this function to build the admission's ports over one bucket. */
export function createUploadAdmissionPorts(bucketName: string): AdmissionPorts {
  const bucket = () => getStorage().bucket(bucketName)
  return {
    verifyIdToken: (token) => getAuth().verifyIdToken(token),
    readLedger: async (uid) => {
      const path = uploadQuotaLedgerPath(uid)
      try {
        const [metadata] = await bucket().file(path).getMetadata()
        const generation = Number(metadata.generation)
        // Read the generation just checked, so the precondition matches it.
        const [bytes] = await bucket().file(path, { generation }).download()
        return {
          value: JSON.parse(bytes.toString()) as QuotaLedger,
          generation,
        }
      } catch (error) {
        if (code(error) === 404) return { value: { grants: {} }, generation: 0 }
        throw error
      }
    },
    writeLedger: async (uid, value, generation) => {
      try {
        // ifGenerationMatch 0 means "only if absent".
        await bucket()
          .file(uploadQuotaLedgerPath(uid))
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
    listStored: async (uid) => {
      const [files] = await bucket().getFiles({ prefix: userPrefix(uid) })
      return new Map(
        files.map((file) => [file.name, Number(file.metadata?.size ?? 0)]),
      )
    },
    publishGrants: publishUploadGrants,
    now: () => Date.now(),
  }
}
