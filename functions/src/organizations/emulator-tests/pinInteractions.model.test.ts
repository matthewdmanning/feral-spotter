import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { getFirestore } from 'firebase-admin/firestore'
import { createInvite, moderateMembership } from '../membership/service'
import { applyAuthorExit } from '../interactions/store'
import { COMMENT_LIMIT, COMMENT_PAGE_SIZE } from '../interactions/domain'
import {
  call,
  createOrganizations,
  grant,
  signedInUser,
  serveEmulatorApi,
} from './harness'

serveEmulatorApi()

/**
 * One shared pin. The author comments and reacts; a reader in the same
 * organization watches; an outsider (member elsewhere) is always refused.
 * The only authorization is "may view this pin"; lifecycle owners decide
 * what happens to stored interactions, so revocation leaves them in place.
 */
type Account = Awaited<ReturnType<typeof signedInUser>>
interface Comment {
  id: string
  body: string
  createdAt: string
  author: string | null
  mine: boolean
}
interface Reaction {
  key: string
  count: number
  mine: boolean
}
let organizationId: string
let otherOrganization: string
let sharer: Account
let author: Account
let reader: Account
let outsider: Account
let pinId: string
let commentId: string

async function joinApproved(account: Account, organization: string) {
  const code = await createInvite(organization)
  const response = await call(
    {
      action: 'joinOrganization',
      code,
      displayName: `${account.uid.split('-').at(-2)} name`,
    },
    account.token,
  )
  expect(response.status).toBe(200)
  await moderateMembership(account.uid, organization, 'approve')
}
const request = (account: Account, body: Record<string, unknown>) =>
  call({ organizationId, id: pinId, ...body }, account.token)
async function commentsFor(account: Account) {
  const reply = await request(account, { action: 'pinComments' })
  const body = reply.body as unknown as { comments?: Comment[] } | null
  return { status: reply.status, comments: body?.comments }
}
async function reactionsFor(account: Account) {
  const reply = await request(account, { action: 'pinReactions' })
  const body = reply.body as unknown as { reactions?: Reaction[] } | null
  return { status: reply.status, reactions: body?.reactions }
}
const counts = (reactions: Reaction[] = []) =>
  Object.fromEntries(
    reactions.filter((r) => r.count).map((r) => [r.key, [r.count, r.mine]]),
  )
const addComment = (mutationId = 'comment-1') =>
  request(author, {
    action: 'addPinComment',
    mutationId,
    body: '  Fed two cats here.  ',
  })
const storedForPin = async (collection: string) =>
  (
    await getFirestore()
      .collection(collection)
      .where('pinId', '==', pinId)
      .get()
  ).size

const machine = createMachine({
  id: 'pinInteractions',
  initial: 'empty',
  states: {
    empty: { on: { COMMENT: 'commented' } },
    commented: {
      on: {
        RETRY_COMMENT: 'commented',
        REACT: 'reacted',
        DELETE_COMMENT: 'empty',
        AUTHOR_LEAVES: 'authorGone',
      },
    },
    reacted: { on: { UNREACT: 'commented', UNSHARE_PIN: 'unshared' } },
    unshared: {},
    authorGone: { on: { DELETE_POLICY_APPLIED: 'authorErased' } },
    authorErased: {},
  },
})
const model = createTestModel(machine)
const testParams = {
  states: {
    empty: async () => {
      expect(await commentsFor(reader)).toEqual({ status: 200, comments: [] })
      expect(counts((await reactionsFor(reader)).reactions)).toEqual({})
      // Membership elsewhere never opens this pin, even with its ID known.
      expect((await commentsFor(outsider)).status).toBe(403)
      const write = await call(
        {
          action: 'addPinComment',
          organizationId,
          id: pinId,
          mutationId: 'outsider',
          body: 'hi',
        },
        outsider.token,
      )
      expect(write.status).toBe(403)
    },
    commented: async () => {
      // Exact keys: the author's account identifier never reaches readers.
      expect(await commentsFor(reader)).toEqual({
        status: 200,
        comments: [
          {
            id: commentId,
            body: 'Fed two cats here.',
            createdAt: expect.any(String),
            author: 'author name',
            mine: false,
          },
        ],
      })
      expect((await commentsFor(author)).comments?.[0].mine).toBe(true)
      expect(counts((await reactionsFor(reader)).reactions)).toEqual({})
      const deleteOthers = await request(reader, {
        action: 'deletePinComment',
        commentId,
      })
      expect(deleteOthers.status).toBe(404)
    },
    reacted: async () => {
      expect(counts((await reactionsFor(reader)).reactions)).toEqual({
        heart: [1, false],
      })
      expect(counts((await reactionsFor(author)).reactions)).toEqual({
        heart: [1, true],
      })
    },
    unshared: async () => {
      expect((await commentsFor(reader)).status).toBe(403)
      expect((await reactionsFor(author)).status).toBe(403)
      const write = await request(author, {
        action: 'setPinReaction',
        reaction: 'eyes',
        active: true,
      })
      expect(write.status).toBe(403)
      // This feature does not own revocation: stored interactions stay.
      expect(await storedForPin('pinComments')).toBe(1)
      expect(await storedForPin('pinReactions')).toBe(1)
    },
    authorGone: async () => {
      expect((await commentsFor(reader)).comments).toEqual([
        expect.objectContaining({ id: commentId, author: null, mine: false }),
      ])
      expect((await commentsFor(author)).status).toBe(403)
    },
    authorErased: async () => {
      expect((await commentsFor(reader)).comments).toEqual([])
      expect(await storedForPin('pinComments')).toBe(0)
    },
  },
  events: {
    COMMENT: async () => {
      const reply = await addComment()
      expect(reply.status).toBe(200)
      commentId = (reply.body as unknown as { comment: Comment }).comment.id
    },
    RETRY_COMMENT: async () => {
      // A lost response is retried with the same mutation: still one comment.
      const reply = await addComment()
      expect((reply.body as unknown as { comment: Comment }).comment.id).toBe(
        commentId,
      )
    },
    DELETE_COMMENT: async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const reply = await request(author, {
          action: 'deletePinComment',
          commentId,
        })
        expect(reply.status).toBe(200)
      }
    },
    REACT: async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const reply = await request(author, {
          action: 'setPinReaction',
          reaction: 'heart',
          active: true,
        })
        expect(reply.status).toBe(200)
      }
    },
    UNREACT: async () => {
      const reply = await request(author, {
        action: 'setPinReaction',
        reaction: 'heart',
        active: false,
      })
      expect(reply.status).toBe(200)
    },
    UNSHARE_PIN: async () => {
      const reply = await call(
        {
          action: 'revoke',
          organizationId,
          submissionId: 'sighting',
          mutationId: 'unshare',
        },
        sharer.token,
      )
      expect(reply.status).toBe(200)
    },
    AUTHOR_LEAVES: () =>
      moderateMembership(author.uid, organizationId, 'remove'),
    DELETE_POLICY_APPLIED: () =>
      applyAuthorExit('delete', author.uid, organizationId),
  },
}

const journeys = [
  {
    name: 'a retried comment appears once; its author can delete it twice safely',
    events: ['COMMENT', 'RETRY_COMMENT', 'DELETE_COMMENT'],
  },
  {
    name: 'repeated reactions count once; unsharing refuses access but keeps data',
    events: ['COMMENT', 'REACT', 'UNREACT', 'REACT', 'UNSHARE_PIN'],
  },
  {
    name: 'a departed author stays unnamed until the delete policy is applied',
    events: ['COMMENT', 'AUTHOR_LEAVES', 'DELETE_POLICY_APPLIED'],
  },
]

async function sharePin() {
  ;[organizationId, otherOrganization] = await createOrganizations(2)
  sharer = await signedInUser('pin-sharer')
  author = await signedInUser('pin-author')
  reader = await signedInUser('pin-reader')
  outsider = await signedInUser('pin-outsider')
  await joinApproved(sharer, organizationId)
  await joinApproved(author, organizationId)
  await joinApproved(reader, organizationId)
  await joinApproved(outsider, otherOrganization)
  expect((await call(grant(organizationId), sharer.token)).status).toBe(200)
  const shared = await call(
    { action: 'sharedSightings', organizationId },
    reader.token,
  )
  pinId = (shared.body as unknown as { sightings: { id: string }[] })
    .sightings[0].id
}

journeys.forEach(({ name, events }) => {
  test(name, async () => {
    await sharePin()
    const [path] = model.getPathsFromEvents(events.map((type) => ({ type })))
    await path.test(testParams)
  })
})

const post = (index: number) =>
  request(author, {
    action: 'addPinComment',
    mutationId: `comment-${index}`,
    body: `Comment ${index}`,
  })
const commentOf = (reply: Awaited<ReturnType<typeof call>>) =>
  (reply.body as unknown as { comment: Comment }).comment

test('deleting the comment a page ended on keeps the next page reachable', async () => {
  await sharePin()
  for (let index = 1; index <= COMMENT_PAGE_SIZE + 1; index++)
    expect((await post(index)).status).toBe(200)
  const first = await request(reader, { action: 'pinComments' })
  const { comments, cursor } = first.body as unknown as {
    comments: Comment[]
    cursor: string
  }
  expect(comments).toHaveLength(COMMENT_PAGE_SIZE)
  const deleted = await request(author, {
    action: 'deletePinComment',
    commentId: comments.at(-1)!.id,
  })
  expect(deleted.status).toBe(200)
  const next = await request(reader, { action: 'pinComments', cursor })
  expect(next.status).toBe(200)
  expect(
    (next.body as unknown as { comments: Comment[] }).comments.map(
      (c) => c.body,
    ),
  ).toEqual([`Comment ${COMMENT_PAGE_SIZE + 1}`])
})

test('each account stores a bounded number of comments; deleting frees room', async () => {
  await sharePin()
  const kept = commentOf(await post(1))
  await getFirestore()
    .collection('organizationAccounts')
    .doc(author.uid)
    .update({ commentCount: COMMENT_LIMIT })
  expect((await post(2)).status).toBe(429)
  // A retry of an already-stored comment is not a new one.
  expect((await post(1)).status).toBe(200)
  await request(author, { action: 'deletePinComment', commentId: kept.id })
  expect((await post(2)).status).toBe(200)
})
