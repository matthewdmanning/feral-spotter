import { createHash } from 'node:crypto'
import { FieldPath, type Query } from 'firebase-admin/firestore'
import { checkedAccount, db } from '../store'
import { RequestError } from '../errors'
import {
  COMMENT_PAGE_SIZE,
  REACTIONS,
  type AuthorExitPolicy,
  type PinComment,
  type PinCommentPage,
  type PinReactionCount,
  type ReactionKey,
} from './domain'

/** Stored records carry the author uid; responses never do. */
interface StoredComment {
  pinId: string
  organizationId: string
  authorUid: string
  body: string
  createdAt: string
}
interface StoredReaction {
  pinId: string
  organizationId: string
  authorUid: string
  key: ReactionKey
}

/** Resolves a commenter's current display name; null hides it. */
export type AuthorNameResolver = (
  uid: string,
  organizationId: string,
) => Promise<string | null>

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const comments = () => db().collection('pinComments')
const reactions = () => db().collection('pinReactions')
const reactionRef = (pinId: string, uid: string, key: ReactionKey) =>
  reactions().doc(hash(`${pinId}/${uid}/${key}`))

/** Idempotent: retrying one mutationId returns the comment it created. */
export async function addComment(
  uid: string,
  organizationId: string,
  pinId: string,
  mutationId: string,
  body: string,
): Promise<Omit<PinComment, 'author'>> {
  const reference = comments().doc(hash(`${uid}/${mutationId}`))
  return db().runTransaction(async (transaction) => {
    await checkedAccount(transaction, uid)
    const existing = await transaction.get(reference)
    const stored = existing.data() as StoredComment | undefined
    if (stored) {
      if (stored.authorUid !== uid || stored.pinId !== pinId)
        throw new RequestError(400, 'Invalid mutation')
      return {
        id: reference.id,
        body: stored.body,
        createdAt: stored.createdAt,
        mine: true,
      }
    }
    const comment: StoredComment = {
      pinId,
      organizationId,
      authorUid: uid,
      body,
      createdAt: new Date().toISOString(),
    }
    transaction.create(reference, comment)
    return { id: reference.id, body, createdAt: comment.createdAt, mine: true }
  })
}

/** Only the author may delete; deleting an already-deleted comment succeeds. */
export async function deleteComment(
  uid: string,
  pinId: string,
  commentId: string,
): Promise<void> {
  const reference = comments().doc(commentId)
  await db().runTransaction(async (transaction) => {
    await checkedAccount(transaction, uid)
    const stored = (await transaction.get(reference)).data() as
      StoredComment | undefined
    if (!stored) return
    if (stored.authorUid !== uid || stored.pinId !== pinId)
      throw new RequestError(404, 'Comment unavailable')
    transaction.delete(reference)
  })
}

/** Oldest first, with an opaque document-key cursor. */
export async function commentPage(
  uid: string,
  organizationId: string,
  pinId: string,
  cursor: string | undefined,
  authorName: AuthorNameResolver,
): Promise<PinCommentPage> {
  let query: Query = comments()
    .where('pinId', '==', pinId)
    .orderBy('createdAt')
    .orderBy(FieldPath.documentId())
    .limit(COMMENT_PAGE_SIZE)
  if (cursor) {
    const after = await comments().doc(cursor).get()
    if (!after.exists || after.get('pinId') !== pinId)
      throw new RequestError(400, 'Invalid cursor')
    query = query.startAfter(after)
  }
  const page = await query.get()
  const stored = page.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as StoredComment) }))
    .filter((comment) => comment.organizationId === organizationId)
  const authors = [...new Set(stored.map((comment) => comment.authorUid))]
  const names = new Map(
    await Promise.all(
      authors.map(
        async (author) =>
          [author, await authorName(author, organizationId)] as const,
      ),
    ),
  )
  return {
    comments: stored.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: names.get(comment.authorUid) ?? null,
      mine: comment.authorUid === uid,
    })),
    cursor:
      page.size === COMMENT_PAGE_SIZE ? page.docs[page.size - 1].id : null,
  }
}

/** Idempotent toggle: the request states the desired end state. */
export async function setReaction(
  uid: string,
  organizationId: string,
  pinId: string,
  key: ReactionKey,
  active: boolean,
): Promise<void> {
  const reference = reactionRef(pinId, uid, key)
  await db().runTransaction(async (transaction) => {
    await checkedAccount(transaction, uid)
    const existing = await transaction.get(reference)
    if (!active) {
      if (existing.exists) transaction.delete(reference)
      return
    }
    if (existing.exists) return
    const reaction: StoredReaction = {
      pinId,
      organizationId,
      authorUid: uid,
      key,
    }
    transaction.create(reference, reaction)
  })
}

export async function reactionCounts(
  uid: string,
  pinId: string,
): Promise<PinReactionCount[]> {
  const [counts, mine] = await Promise.all([
    Promise.all(
      REACTIONS.map(({ key }) =>
        reactions()
          .where('pinId', '==', pinId)
          .where('key', '==', key)
          .count()
          .get(),
      ),
    ),
    db().getAll(...REACTIONS.map(({ key }) => reactionRef(pinId, uid, key))),
  ])
  return REACTIONS.map(({ key }, index) => ({
    key,
    count: counts[index].data().count,
    mine: mine[index].exists,
  }))
}

/** Removes everything one author wrote, in one organization or all of them. */
export async function removeAuthorInteractions(
  uid: string,
  organizationId?: string,
): Promise<void> {
  for (const collection of [comments(), reactions()]) {
    let query: Query = collection.where('authorUid', '==', uid)
    if (organizationId)
      query = query.where('organizationId', '==', organizationId)
    const docs = await query.get()
    const writer = db().bulkWriter()
    const deleted = Promise.all(docs.docs.map((doc) => writer.delete(doc.ref)))
    await Promise.all([writer.close(), deleted])
  }
}

/**
 * Entry point for whoever owns leaving and account erasure. `retain` keeps
 * the author's interactions; their name is then resolved (or hidden) on read.
 */
export async function applyAuthorExit(
  policy: AuthorExitPolicy,
  uid: string,
  organizationId?: string,
): Promise<void> {
  if (policy === 'delete') await removeAuthorInteractions(uid, organizationId)
}
