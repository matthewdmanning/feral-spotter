import { createMachine } from 'xstate'
import { getFirestore } from 'firebase-admin/firestore'
import { createTestModel } from '@xstate/graph'
import { createInvite, moderateMembership } from '../membership/service'
import { DEFAULT_SHARING } from '../domain'
import type { MembershipList } from '../membership/domain'
import {
  call,
  catalog,
  createOrganizations,
  grant,
  signedInUser,
  serveEmulatorApi,
  bucket,
  save,
  withMembershipEndFailure,
} from './harness'

serveEmulatorApi()

/**
 * Leaving an organization is a durable saga (membership/service.ts): block
 * grants, revoke or replace shares, end membership, release the block. Each
 * state is what the member observes through the API for the organization
 * they leave; the bystander organization is one that leaving must never touch.
 */
const leaveMachine = createMachine({
  id: 'leaveOrganization',
  initial: 'sharingMember',
  states: {
    sharingMember: {
      on: {
        LEAVE_AND_UNSHARE: 'leftUnshared',
        LEAVE_KEEPING_WITH_STALE_REVIEW: 'sharingMember',
        LEAVE_KEEPING_SHARES: 'leftKeepingShares',
        RETRY_CORRECTED_REVIEW: 'leftKeepingShares',
        LEAVE_INTERRUPTED: 'leavingIncomplete',
        LEAVE_DURING_DIRECTORY_UPDATE: 'leavingIncomplete',
      },
    },
    leavingIncomplete: {
      on: {
        RESUME_LEAVING: 'leftUnshared',
        OPERATOR_REMOVES_DURING_DIRECTORY_UPDATE: 'removed',
      },
    },
    leftUnshared: { on: { REJOIN_APPROVED: 'rejoinedMember' } },
    leftKeepingShares: { on: { OPERATOR_REMOVES: 'removed' } },
    rejoinedMember: {},
    removed: { on: { REJOIN_APPROVED: 'rejoinedMember' } },
  },
})

let organization: string
let bystander: string
let member: Awaited<ReturnType<typeof signedInUser>>
let invite: string
let attempt = 0

async function joinApproved() {
  await call(
    { action: 'joinOrganization', code: invite, displayName: 'Leaving member' },
    member.token,
  )
  await moderateMembership(member.uid, organization, 'approve')
}
async function observe() {
  const { memberships } = (await call({ action: 'memberships' }, member.token))
    .body as unknown as MembershipList
  const { permissions, epochs } = (await call({ action: 'list' }, member.token))
    .body!
  const roster = await call(
    { action: 'organizationMembers', organizationId: organization },
    member.token,
  )
  return {
    membership: memberships.find((m) => m.organizationId === organization),
    share: permissions.find((p) => p.organizationId === organization),
    bystander: permissions.find((p) => p.organizationId === bystander),
    epoch: epochs[organization] ?? 0,
    rosterStatus: roster.status,
  }
}
/** A new grant must be refused whenever leaving has started or finished. */
async function grantStatus() {
  return (
    await call(grant(organization, {}, `late-${++attempt}`), member.token)
  ).status
}
const leave = (choice: Record<string, unknown>) =>
  call(
    { action: 'leaveOrganization', organizationId: organization, choice },
    member.token,
  )
/** Directory reads answer 503 while this runs; the published catalog is unchanged. */
async function duringDirectoryUpdate<T>(run: () => Promise<T>) {
  const directory = getFirestore().doc('organizationCatalog/current')
  await directory.update({ updating: true })
  try {
    return await run()
  } finally {
    await directory.update({ updating: false })
  }
}
const keepChoice = {
  mode: 'keep',
  epoch: 0,
  catalogVersion: catalog.version,
  anonymous: true,
  settings: DEFAULT_SHARING,
}

const model = createTestModel(leaveMachine)
const testParams = {
  states: {
    sharingMember: async () => {
      const seen = await observe()
      expect(seen.membership).toMatchObject({
        status: 'active',
        leaving: false,
      })
      expect(seen.share?.revokedAt).toBeUndefined()
      expect(seen.share?.data.contact).toBeDefined()
      expect(seen.rosterStatus).toBe(200)
    },
    leavingIncomplete: async () => {
      const seen = await observe()
      expect(seen.membership).toMatchObject({ leaving: true })
      expect(seen.rosterStatus).toBe(403)
      expect(await grantStatus()).toBe(409)
    },
    leftUnshared: async () => {
      const seen = await observe()
      expect(seen.membership).toMatchObject({ status: 'left', leaving: false })
      expect(seen.share?.revokedAt).toBeDefined()
      expect(seen.bystander?.revokedAt).toBeUndefined()
      expect(seen.rosterStatus).toBe(403)
      expect(await grantStatus()).toBe(409)
    },
    leftKeepingShares: async () => {
      const seen = await observe()
      expect(seen.membership).toMatchObject({ status: 'left', leaving: false })
      // The retained share is re-consented with the reviewed, narrower fields.
      expect(seen.share?.revokedAt).toBeUndefined()
      expect(seen.share?.data.contact).toBeUndefined()
      expect(seen.share?.data.cats).toBeUndefined()
      expect(seen.epoch).toBe(1)
      expect(seen.rosterStatus).toBe(403)
    },
    rejoinedMember: async () => {
      const seen = await observe()
      expect(seen.membership).toMatchObject({ status: 'active' })
      // Rejoining restores membership, never the shares revoked on leaving.
      expect(seen.share?.revokedAt).toBeDefined()
      expect(seen.rosterStatus).toBe(200)
      // No leftover leaving block: a new Sighting can be shared again.
      const fresh = await call(
        grant(
          organization,
          { submissionId: 'other', epoch: seen.epoch },
          `fresh-${++attempt}`,
        ),
        member.token,
      )
      expect(fresh.status).toBe(200)
    },
    removed: async () => {
      const seen = await observe()
      expect(seen.membership).toMatchObject({ status: 'removed' })
      expect(seen.share?.revokedAt).toBeDefined()
      expect(seen.bystander?.revokedAt).toBeUndefined()
    },
  },
  events: {
    LEAVE_AND_UNSHARE: async () => {
      const choice = { mode: 'revoke', mutationId: 'leave-unshare' }
      expect((await leave(choice)).status).toBe(200)
      // A replayed request finishes the same operation, not a second one.
      expect((await leave(choice)).status).toBe(200)
    },
    LEAVE_KEEPING_WITH_STALE_REVIEW: async () => {
      const choice = {
        ...keepChoice,
        mutationId: 'stale-review',
        catalogVersion: 'stale',
      }
      expect((await leave(choice)).status).toBe(409)
    },
    RETRY_CORRECTED_REVIEW: async () => {
      // The client may reuse the rejected attempt's mutation id.
      const choice = { ...keepChoice, mutationId: 'stale-review' }
      expect((await leave(choice)).status).toBe(200)
    },
    LEAVE_DURING_DIRECTORY_UPDATE: async () => {
      const choice = { ...keepChoice, mutationId: 'directory-update' }
      const response = await duringDirectoryUpdate(() => leave(choice))
      expect(response.status).toBe(503)
    },
    OPERATOR_REMOVES_DURING_DIRECTORY_UPDATE: () =>
      duringDirectoryUpdate(() =>
        moderateMembership(member.uid, organization, 'remove'),
      ),
    LEAVE_KEEPING_SHARES: async () => {
      const choice = { ...keepChoice, mutationId: 'keep-review' }
      expect((await leave(choice)).status).toBe(200)
    },
    LEAVE_INTERRUPTED: async () => {
      const choice = { mode: 'revoke', mutationId: 'interrupted-leave' }
      const response = await withMembershipEndFailure(member.uid, () =>
        leave(choice),
      )
      expect(response.status).toBe(503)
    },
    RESUME_LEAVING: async () => {
      const response = await call(
        { action: 'resumeLeaving', organizationId: organization },
        member.token,
      )
      expect(response.status).toBe(200)
    },
    REJOIN_APPROVED: joinApproved,
    OPERATOR_REMOVES: () =>
      moderateMembership(member.uid, organization, 'remove'),
  },
}

// Member journeys as explicit event sequences; each starts from fresh accounts and organizations.
const journeys = [
  {
    name: 'leaving by default unshares everything with that organization only',
    events: [{ type: 'LEAVE_AND_UNSHARE' }],
  },
  {
    name: 'a stale sharing review keeps membership until the member leaves',
    events: [
      { type: 'LEAVE_KEEPING_WITH_STALE_REVIEW' },
      { type: 'LEAVE_AND_UNSHARE' },
    ],
  },
  {
    name: 'kept shares are narrowed, then revoked when an operator removes the member',
    events: [{ type: 'LEAVE_KEEPING_SHARES' }, { type: 'OPERATOR_REMOVES' }],
  },
  {
    name: 'an interrupted leave blocks grants until resuming finishes unsharing',
    events: [{ type: 'LEAVE_INTERRUPTED' }, { type: 'RESUME_LEAVING' }],
  },
  {
    name: 'rejoining after leaving restores no shares',
    events: [{ type: 'LEAVE_AND_UNSHARE' }, { type: 'REJOIN_APPROVED' }],
  },
  {
    name: 'a corrected review succeeds when it reuses the rejected mutation id',
    events: [
      { type: 'LEAVE_KEEPING_WITH_STALE_REVIEW' },
      { type: 'RETRY_CORRECTED_REVIEW' },
    ],
  },
  {
    name: 'removal during a stuck leave releases its block for a later rejoin',
    events: [
      { type: 'LEAVE_DURING_DIRECTORY_UPDATE' },
      { type: 'OPERATOR_REMOVES_DURING_DIRECTORY_UPDATE' },
      { type: 'REJOIN_APPROVED' },
    ],
  },
]

journeys.forEach(({ name, events }) => {
  test(name, async () => {
    ;[organization, bystander] = await createOrganizations(2)
    member = await signedInUser('leave-model')
    const [sighting] = await bucket()
      .file(`submissions/${member.uid}/sighting/metadata.json`)
      .download()
    // A second Sighting at the same point, without photos.
    await save(`submissions/${member.uid}/other/metadata.json`, {
      ...JSON.parse(sighting.toString()),
      photo_paths: [],
    })
    invite = await createInvite(organization)
    await joinApproved()
    const fields = { ...DEFAULT_SHARING.fields, email: true, catDetails: true }
    const named = {
      anonymous: false,
      contactEmail: member.email,
      settings: { ...DEFAULT_SHARING, fields },
    }
    expect((await call(grant(organization, named), member.token)).status).toBe(
      200,
    )
    expect((await call(grant(bystander), member.token)).status).toBe(200)
    const [path] = model.getPathsFromEvents(events)
    await path.test(testParams)
  })
})
