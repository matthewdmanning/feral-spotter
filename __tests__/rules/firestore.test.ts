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
