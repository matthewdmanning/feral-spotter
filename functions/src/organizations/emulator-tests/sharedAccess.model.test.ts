import sharp from 'sharp'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { createInvite, moderateMembership } from '../membership/service'
import { DEFAULT_SHARING } from '../domain'
import {
  call,
  catalog,
  createOrganizations,
  grant,
  savePhoto,
  signedInUser,
  serveEmulatorApi,
  withMembershipEndFailure,
} from './harness'

serveEmulatorApi()

/**
 * Every path the app offers to Shared Sightings, the shared photo and the
 * roster: screen buttons for active members, and the feralspotter:// deep link
 * (organizations/[id]/sightings) for everyone else. Each journey starts from
 * fresh accounts and organizations: a sharer who shares one Sighting in full,
 * and a viewer who knows that Sighting's ID from when access was valid.
 */
type Account = Awaited<ReturnType<typeof signedInUser>>
type Sighting = Record<string, unknown>
let sharedOrganization: string
let otherOrganization: string
let sharer: Account
let viewer: Account
let photoPath: string
let sharedId: string
let attempt = 0

async function joinApproved(account: Account, organizationId: string) {
  await requestToJoin(account, organizationId)
  await moderateMembership(account.uid, organizationId, 'approve')
}
async function requestToJoin(account: Account, organizationId: string) {
  const code = await createInvite(organizationId)
  const response = await call(
    {
      action: 'joinOrganization',
      code,
      displayName: `${organizationId} member`,
    },
    account.token,
  )
  expect(response.status).toBe(200)
}
const leave = (account: Account, choice: Record<string, unknown>) =>
  call(
    { action: 'leaveOrganization', organizationId: sharedOrganization, choice },
    account.token,
  )
const revokeLeaving = () => ({
  mode: 'revoke',
  mutationId: `leave-${++attempt}`,
})
/** Reads every page, as the screen's Load more does. */
async function sharedSightings(
  token: string,
  organizationId = sharedOrganization,
) {
  const sightings: Sighting[] = []
  let cursor: unknown
  do {
    const reply = await call(
      {
        action: 'sharedSightings',
        organizationId,
        ...(cursor ? { cursor } : {}),
      },
      token,
    )
    if (reply.status !== 200) return { status: reply.status, sightings }
    const page = reply.body as unknown as {
      sightings: Sighting[]
      cursor: string | null
    }
    sightings.push(...page.sightings)
    cursor = page.cursor
  } while (cursor)
  return { status: 200, sightings }
}
async function photo(token: string) {
  const reply = await call(
    {
      action: 'sharedPhoto',
      organizationId: sharedOrganization,
      id: sharedId,
      index: 0,
    },
    token,
  )
  return {
    status: reply.status,
    image: (reply.body as unknown as { image?: string } | null)?.image,
  }
}
async function viewerSees() {
  const shared = await sharedSightings(viewer.token)
  const roster = await call(
    { action: 'organizationMembers', organizationId: sharedOrganization },
    viewer.token,
  )
  return {
    sightingsStatus: shared.status,
    sighting: shared.sightings.find((s) => s.id === sharedId),
    photo: await photo(viewer.token),
    rosterStatus: roster.status,
  }
}
/** Without access nothing is returned, even for an ID the viewer already knows. */
async function expectNoAccess() {
  expect(await viewerSees()).toEqual({
    sightingsStatus: 403,
    sighting: undefined,
    photo: { status: 403, image: undefined },
    rosterStatus: 403,
  })
}

/** The sharer is an active member who shares one Sighting with every field. */
async function shareInFull() {
  ;[sharedOrganization, otherOrganization] = await createOrganizations(2)
  sharer = await signedInUser('access-sharer')
  photoPath = await savePhoto(sharer.uid)
  await joinApproved(sharer, sharedOrganization)
  const fields = {
    ...DEFAULT_SHARING.fields,
    email: true,
    catDetails: true,
    preciseLocation: true,
    photos: true,
  }
  const named = {
    anonymous: false,
    contactEmail: sharer.email,
    settings: { ...DEFAULT_SHARING, fields },
  }
  expect(
    (await call(grant(sharedOrganization, named), sharer.token)).status,
  ).toBe(200)
  const { sightings } = await sharedSightings(sharer.token)
  expect(sightings).toHaveLength(1)
  sharedId = sightings[0].id as string
}

describe('viewer access', () => {
  const accessMachine = createMachine({
    id: 'viewerAccess',
    initial: 'outsider',
    states: {
      outsider: { on: { REQUEST_TO_JOIN: 'pending' } },
      pending: {
        on: { APPROVE: 'member', REJECT: 'rejected', CANCEL_REQUEST: 'left' },
      },
      rejected: { on: { REQUEST_TO_JOIN: 'pending' } },
      member: {
        on: {
          LEAVE: 'left',
          LEAVE_INTERRUPTED: 'leaving',
          OPERATOR_REMOVES: 'removed',
        },
      },
      leaving: {
        on: { RESUME_LEAVING: 'left', OPERATOR_REMOVES: 'removed' },
      },
      left: { on: { REQUEST_TO_JOIN: 'pending' } },
      removed: { on: { REQUEST_TO_JOIN: 'pending' } },
    },
  })
  const model = createTestModel(accessMachine)
  const testParams = {
    states: {
      outsider: async () => {
        await expectNoAccess()
        // Membership of another organization never opens this one's shares.
        const other = await sharedSightings(viewer.token, otherOrganization)
        expect(other.status).toBe(200)
        expect(other.sightings.some((s) => s.id === sharedId)).toBe(false)
      },
      pending: expectNoAccess,
      rejected: expectNoAccess,
      member: async () => {
        const seen = await viewerSees()
        expect(seen.sightingsStatus).toBe(200)
        expect(seen.sighting).toBeDefined()
        expect(seen.photo.status).toBe(200)
        expect(seen.rosterStatus).toBe(200)
      },
      leaving: expectNoAccess,
      left: expectNoAccess,
      removed: expectNoAccess,
    },
    events: {
      REQUEST_TO_JOIN: () => requestToJoin(viewer, sharedOrganization),
      APPROVE: () =>
        moderateMembership(viewer.uid, sharedOrganization, 'approve'),
      REJECT: () =>
        moderateMembership(viewer.uid, sharedOrganization, 'reject'),
      CANCEL_REQUEST: async () => {
        expect((await leave(viewer, revokeLeaving())).status).toBe(200)
      },
      LEAVE: async () => {
        expect((await leave(viewer, revokeLeaving())).status).toBe(200)
      },
      LEAVE_INTERRUPTED: async () => {
        const response = await withMembershipEndFailure(viewer.uid, () =>
          leave(viewer, revokeLeaving()),
        )
        expect(response.status).toBe(503)
      },
      RESUME_LEAVING: async () => {
        const response = await call(
          { action: 'resumeLeaving', organizationId: sharedOrganization },
          viewer.token,
        )
        expect(response.status).toBe(200)
      },
      OPERATOR_REMOVES: () =>
        moderateMembership(viewer.uid, sharedOrganization, 'remove'),
    },
  }

  const journeys = [
    {
      name: 'a deep link shows nothing until the request is approved',
      events: [{ type: 'REQUEST_TO_JOIN' }, { type: 'APPROVE' }],
    },
    {
      name: 'a rejected request grants nothing, even when asked again',
      events: [
        { type: 'REQUEST_TO_JOIN' },
        { type: 'REJECT' },
        { type: 'REQUEST_TO_JOIN' },
      ],
    },
    {
      name: 'a cancelled request grants nothing, even when asked again',
      events: [
        { type: 'REQUEST_TO_JOIN' },
        { type: 'CANCEL_REQUEST' },
        { type: 'REQUEST_TO_JOIN' },
      ],
    },
    {
      name: 'leaving ends access, including to a photo already listed, until approved again',
      events: [
        { type: 'REQUEST_TO_JOIN' },
        { type: 'APPROVE' },
        { type: 'LEAVE' },
        { type: 'REQUEST_TO_JOIN' },
        { type: 'APPROVE' },
      ],
    },
    {
      name: 'an interrupted leave ends access before it finishes',
      events: [
        { type: 'REQUEST_TO_JOIN' },
        { type: 'APPROVE' },
        { type: 'LEAVE_INTERRUPTED' },
        { type: 'RESUME_LEAVING' },
      ],
    },
    {
      name: 'removal during an interrupted leave keeps access closed',
      events: [
        { type: 'REQUEST_TO_JOIN' },
        { type: 'APPROVE' },
        { type: 'LEAVE_INTERRUPTED' },
        { type: 'OPERATOR_REMOVES' },
      ],
    },
    {
      name: 'a removed member who asks again waits for approval',
      events: [
        { type: 'REQUEST_TO_JOIN' },
        { type: 'APPROVE' },
        { type: 'OPERATOR_REMOVES' },
        { type: 'REQUEST_TO_JOIN' },
      ],
    },
  ]

  journeys.forEach(({ name, events }) => {
    test(name, async () => {
      await shareInFull()
      viewer = await signedInUser('access-viewer')
      await joinApproved(viewer, otherOrganization)
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})

describe('sharer consent', () => {
  const consentMachine = createMachine({
    id: 'sharerConsent',
    initial: 'sharedInFull',
    states: {
      sharedInFull: {
        on: {
          SHARER_LEAVES_KEEPING_LESS: 'narrowed',
          SHARER_UNSHARES_SIGHTING: 'unshared',
          SHARER_STOPS_ALL_SHARING: 'unshared',
          SHARER_LEAVES: 'unshared',
          SHARER_REMOVED: 'unshared',
        },
      },
      narrowed: { on: { SHARER_REMOVED: 'unshared' } },
      unshared: {},
    },
  })
  const model = createTestModel(consentMachine)
  const generalLocation = expect.objectContaining({
    south: expect.any(Number),
    north: expect.any(Number),
  })
  const testParams = {
    states: {
      sharedInFull: async () => {
        const seen = await viewerSees()
        // Exact keys: contact details and private identifiers never reach viewers.
        expect(seen.sighting).toEqual({
          id: sharedId,
          catCount: 1,
          generalLocation,
          preciseLocation: expect.any(Object),
          cats: [{ health_label: 'poor' }],
          photoCount: 1,
        })
        expect(seen.photo.status).toBe(200)
        const image = seen.photo.image!
        expect(image).not.toContain(photoPath)
        const bytes = Buffer.from(image.split(',')[1], 'base64')
        expect((await sharp(bytes).metadata()).exif).toBeUndefined()
      },
      narrowed: async () => {
        const seen = await viewerSees()
        expect(seen.sighting).toEqual({
          id: sharedId,
          catCount: 1,
          generalLocation,
          photoCount: 0,
        })
        expect(seen.photo).toEqual({ status: 404, image: undefined })
      },
      unshared: async () => {
        const seen = await viewerSees()
        expect(seen.sightingsStatus).toBe(200)
        expect(seen.sighting).toBeUndefined()
        expect(seen.photo).toEqual({ status: 404, image: undefined })
      },
    },
    events: {
      SHARER_LEAVES_KEEPING_LESS: async () => {
        const choice = {
          mode: 'keep',
          mutationId: 'keep-less',
          epoch: 0,
          catalogVersion: catalog.version,
          anonymous: true,
          settings: DEFAULT_SHARING,
        }
        expect((await leave(sharer, choice)).status).toBe(200)
      },
      SHARER_UNSHARES_SIGHTING: async () => {
        const body = {
          action: 'revoke',
          organizationId: sharedOrganization,
          submissionId: 'sighting',
          mutationId: 'unshare-sighting',
        }
        expect((await call(body, sharer.token)).status).toBe(200)
      },
      SHARER_STOPS_ALL_SHARING: async () => {
        const body = {
          action: 'revokeOrganization',
          organizationId: sharedOrganization,
          mutationId: 'stop-all-sharing',
        }
        expect((await call(body, sharer.token)).status).toBe(200)
      },
      SHARER_LEAVES: async () => {
        expect((await leave(sharer, revokeLeaving())).status).toBe(200)
      },
      SHARER_REMOVED: () =>
        moderateMembership(sharer.uid, sharedOrganization, 'remove'),
    },
  }

  const journeys = [
    {
      name: 'keeping less on leaving hides fields and photos; removal hides the rest',
      events: [
        { type: 'SHARER_LEAVES_KEEPING_LESS' },
        { type: 'SHARER_REMOVED' },
      ],
    },
    {
      name: 'unsharing one Sighting hides it and its photo',
      events: [{ type: 'SHARER_UNSHARES_SIGHTING' }],
    },
    {
      name: 'stopping all sharing hides every shared Sighting',
      events: [{ type: 'SHARER_STOPS_ALL_SHARING' }],
    },
    {
      name: 'the sharer leaving by default hides their Sightings',
      events: [{ type: 'SHARER_LEAVES' }],
    },
    {
      name: 'removal of the sharer hides their Sightings',
      events: [{ type: 'SHARER_REMOVED' }],
    },
  ]

  journeys.forEach(({ name, events }) => {
    test(name, async () => {
      await shareInFull()
      viewer = await signedInUser('consent-viewer')
      await joinApproved(viewer, sharedOrganization)
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
