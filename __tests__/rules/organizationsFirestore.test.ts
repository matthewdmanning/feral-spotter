import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore'

let environment: RulesTestEnvironment
beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-feral-spotter',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  })
})
afterAll(async () => {
  await environment?.cleanup()
})

test.each(['owner', 'other', null])(
  'organization documents cannot be accessed directly by %s',
  async (actor) => {
    const db = actor
      ? environment.authenticatedContext(actor).firestore()
      : environment.unauthenticatedContext().firestore()
    for (const path of [
      'organizations/org',
      'organizationCatalog/current',
      'organizationAccounts/owner',
      'organizationAccounts/owner/states/org',
      'organizationMemberships/member',
      'organizationPermissions/share',
      'organizationInvites/code',
    ]) {
      const reference = doc(db, path)
      await assertFails(getDoc(reference))
      await assertFails(
        setDoc(reference, { status: 'active', ownerUid: 'owner' }),
      )
      await assertFails(deleteDoc(reference))
    }
    await assertFails(getDocs(collection(db, 'organizationMemberships')))
  },
)
