import * as fs from 'fs'
import * as path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

const PROJECT_ID = 'project-e3d5659d-bc4f-438f-88c'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(
        path.resolve(__dirname, '../../firestore.rules'),
        'utf8',
      ),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

async function seedSubmission(submissionId: string, ownerUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'submissions', submissionId), {
      ownerUid,
      photoCount: 3,
    })
  })
}

describe('firestore.rules — /submissions/{submissionId}', () => {
  it('owner can read their own submission doc', async () => {
    await seedSubmission('sub-1', 'uid-owner')
    const owner = testEnv.authenticatedContext('uid-owner')
    await assertSucceeds(getDoc(doc(owner.firestore(), 'submissions', 'sub-1')))
  })

  it("a different authenticated user cannot read someone else's submission doc", async () => {
    await seedSubmission('sub-1', 'uid-owner')
    const other = testEnv.authenticatedContext('uid-other')
    await assertFails(getDoc(doc(other.firestore(), 'submissions', 'sub-1')))
  })

  it('unauthenticated read is denied', async () => {
    await seedSubmission('sub-1', 'uid-owner')
    const anon = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(anon.firestore(), 'submissions', 'sub-1')))
  })

  it('owner cannot write their own submission doc (Cloud-Function-only)', async () => {
    await seedSubmission('sub-1', 'uid-owner')
    const owner = testEnv.authenticatedContext('uid-owner')
    await assertFails(
      updateDoc(doc(owner.firestore(), 'submissions', 'sub-1'), {
        photoCount: 999,
      }),
    )
  })

  it('cannot create a new submission doc directly, even as its own owner', async () => {
    const owner = testEnv.authenticatedContext('uid-owner')
    await assertFails(
      setDoc(doc(owner.firestore(), 'submissions', 'sub-new'), {
        ownerUid: 'uid-owner',
        photoCount: 0,
      }),
    )
  })

  it('cannot delete a submission doc', async () => {
    await seedSubmission('sub-1', 'uid-owner')
    const owner = testEnv.authenticatedContext('uid-owner')
    await assertFails(deleteDoc(doc(owner.firestore(), 'submissions', 'sub-1')))
  })
})

describe('Firestore counter and retry-marker access', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'submissionCounts', 'uid-owner'), {
        count: 12,
      })
      await setDoc(
        doc(
          context.firestore(),
          'submissionCounts',
          'uid-owner',
          'items',
          'sub-1',
        ),
        {},
      )
    })
  })

  it.each([
    { actor: 'owner', uid: 'uid-owner', mayReadCount: true },
    { actor: 'another user', uid: 'uid-other', mayReadCount: false },
    { actor: 'anonymous', uid: null, mayReadCount: false },
  ])(
    'exposes only the permitted count data to $actor',
    async ({ uid, mayReadCount }) => {
      const context = uid
        ? testEnv.authenticatedContext(uid)
        : testEnv.unauthenticatedContext()
      const count = getDoc(
        doc(context.firestore(), 'submissionCounts', 'uid-owner'),
      )
      if (mayReadCount) {
        const result = await assertSucceeds(count)
        expect(result.data()).toEqual({ count: 12 })
      } else await assertFails(count)

      // Even the owner cannot inspect the internal deduplication markers.
      await assertFails(
        getDoc(
          doc(
            context.firestore(),
            'submissionCounts',
            'uid-owner',
            'items',
            'sub-1',
          ),
        ),
      )
    },
  )

  it.each([
    { kind: 'count', segments: ['submissionCounts', 'uid-owner'] },
    {
      kind: 'marker',
      segments: ['submissionCounts', 'uid-owner', 'items', 'sub-1'],
    },
  ])(
    'prevents the owner from changing or deleting a $kind',
    async ({ segments }) => {
      const owner = testEnv.authenticatedContext('uid-owner')
      const target = doc(owner.firestore(), segments.join('/'))
      await assertFails(updateDoc(target, { count: 999 }))
      await assertFails(deleteDoc(target))
    },
  )

  it('prevents an owner from creating a count or retry marker', async () => {
    const owner = testEnv.authenticatedContext('uid-new')
    await assertFails(
      setDoc(doc(owner.firestore(), 'submissionCounts', 'uid-new'), {
        count: 0,
      }),
    )
    await assertFails(
      setDoc(
        doc(
          owner.firestore(),
          'submissionCounts',
          'uid-new',
          'items',
          'sub-new',
        ),
        {},
      ),
    )
  })
})
