import { getStorage } from 'firebase-admin/storage'
import { errorCode } from './errors'

/** Server-only JSON documents. CAS retries never overwrite concurrent updates. */
export async function readDocument<T>(
  path: string,
  empty: () => T,
): Promise<{ value: T; generation: number }> {
  const file = getStorage().bucket().file(path)
  try {
    const [metadata] = await file.getMetadata()
    const generation = Number(metadata.generation)
    const [bytes] = await getStorage()
      .bucket()
      .file(path, { generation })
      .download()
    return { value: JSON.parse(bytes.toString()) as T, generation }
  } catch (error) {
    if (errorCode(error) === 404) return { value: empty(), generation: 0 }
    throw error
  }
}

export async function changeDocument<T>(
  path: string,
  empty: () => T,
  change: (value: T) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { value, generation } = await readDocument(path, empty)
    const next = change(value)
    try {
      await getStorage()
        .bucket()
        .file(path)
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
