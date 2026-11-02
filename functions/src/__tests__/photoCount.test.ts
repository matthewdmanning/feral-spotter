import type { StorageEvent } from 'firebase-functions/v2/storage'

/**
 * photoCount gates the 10-photo cap in storage.rules, so it must equal the
 * number of live photo objects. Storage delivers events at least once and
 * in any order, and an overwrite emits a finalize for the new generation
 * and a delete for the old one. Each scenario below replays such a
 * sequence against an in-memory Firestore and checks the final count.
 */

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }))
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }))
jest.mock('firebase-admin/storage', () => ({ getStorage: jest.fn() }))

const mockDocs = new Map<string, Record<string, unknown>>()
const INCREMENT = Symbol('increment')

jest.mock('firebase-admin/firestore', () => {
  type Ref = { path: string; collection: (name: string) => Col }
  type Col = { doc: (id: string) => Ref }
  const doc = (path: string): Ref => ({
    path,
    collection: (name) => col(`${path}/${name}`),
  })
  const col = (path: string): Col => ({ doc: (id) => doc(`${path}/${id}`) })
  const apply = (
    path: string,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ) => {
    const base = options?.merge ? { ...(mockDocs.get(path) ?? {}) } : {}
    for (const [key, value] of Object.entries(data)) {
      const inc = (value as { [INCREMENT]?: number } | null)?.[INCREMENT]
      base[key] = inc === undefined ? value : ((base[key] as number) ?? 0) + inc
    }
    mockDocs.set(path, base)
  }
  const snapshot = (path: string) => {
    const data = mockDocs.get(path)
    return {
      exists: data !== undefined,
      data: () => data,
      get: (field: string) => data?.[field],
    }
  }
  return {
    getFirestore: () => ({
      collection: col,
      runTransaction: async (
        fn: (tx: {
          get: (ref: Ref) => Promise<ReturnType<typeof snapshot>>
          set: (ref: Ref, data: Record<string, unknown>, o?: object) => void
        }) => Promise<void>,
      ) => {
        const writes: [string, Record<string, unknown>, object?][] = []
        await fn({
          get: async (ref) => snapshot(ref.path),
          set: (ref, data, o) => writes.push([ref.path, data, o]),
        })
        for (const [path, data, o] of writes) apply(path, data, o)
      },
    }),
    FieldValue: { increment: (n: number) => ({ [INCREMENT]: n }) },
  }
})

import { onSubmissionPhotoDeleted, onSubmissionPhotoUploaded } from '../index'

const BUCKET = 'project-e3d5659d-bc4f-438f-88c.firebasestorage.app'
const storageEvent = (name: string, generation: number) =>
  ({
    bucket: BUCKET,
    data: { name, bucket: BUCKET, generation },
  }) as unknown as StorageEvent

type Step = ['finalize' | 'delete', string, number]
const photo = (n: number) => `submissions/uid-owner/sub-1/photo-${n}.jpg`
const count = () => mockDocs.get('submissions/sub-1')?.photoCount ?? 0

async function replay(steps: Step[]) {
  for (const [kind, name, generation] of steps) {
    const handler =
      kind === 'finalize' ? onSubmissionPhotoUploaded : onSubmissionPhotoDeleted
    await handler.run(storageEvent(name, generation))
  }
}

beforeEach(() => mockDocs.clear())

it.each<[string, Step[], number]>([
  [
    'two uploads',
    [
      ['finalize', photo(1), 1],
      ['finalize', photo(2), 1],
    ],
    2,
  ],
  [
    'a duplicate finalize',
    [
      ['finalize', photo(1), 1],
      ['finalize', photo(1), 1],
    ],
    1,
  ],
  [
    'an overwrite, finalize first',
    [
      ['finalize', photo(1), 1],
      ['finalize', photo(1), 2],
      ['delete', photo(1), 1],
    ],
    1,
  ],
  [
    'an overwrite, old delete first',
    [
      ['finalize', photo(1), 1],
      ['delete', photo(1), 1],
      ['finalize', photo(1), 2],
    ],
    1,
  ],
  [
    'a delete before its finalize',
    [
      ['delete', photo(1), 1],
      ['finalize', photo(1), 1],
    ],
    0,
  ],
  [
    'a duplicate delete',
    [
      ['finalize', photo(1), 1],
      ['finalize', photo(2), 1],
      ['delete', photo(1), 1],
      ['delete', photo(1), 1],
    ],
    1,
  ],
  [
    'metadata.json',
    [['finalize', 'submissions/uid-owner/sub-1/metadata.json', 1]],
    0,
  ],
  ['a malformed path', [['finalize', 'not-a-submission.jpg', 1]], 0],
])('counts live photos through %s', async (_label, steps, expected) => {
  await replay(steps)
  expect(count()).toBe(expected)
})

it('#268: a colliding uid neither counts nor un-counts the owner’s photos', async () => {
  await replay([['finalize', photo(1), 1]])
  const other = 'submissions/uid-other/sub-1/photo-9.jpg'
  await replay([
    ['finalize', other, 1],
    ['delete', other, 1],
  ])
  expect(count()).toBe(1)
  expect(mockDocs.get('submissions/sub-1')?.ownerUid).toBe('uid-owner')
})
