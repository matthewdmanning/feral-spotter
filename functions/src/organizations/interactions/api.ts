import type { OrganizationExtension } from '../api'
import { validId } from '../domain'
import { RequestError } from '../errors'
import { requireOrganizationAccess } from '../permissions'
import { commentBody, isPinId, isReactionKey } from './domain'
import {
  addComment,
  commentPage,
  deleteComment,
  reactionCounts,
  setReaction,
  type AuthorNameResolver,
} from './store'

/** The one authorization question this feature asks: may this user view this pin? */
export type PinViewAuthorizer = (
  uid: string,
  organizationId: string,
  pinId: string,
) => Promise<boolean>

const ACTIONS = new Set([
  'pinComments',
  'pinReactions',
  'addPinComment',
  'deletePinComment',
  'setPinReaction',
])

export function createInteractionsExtension({
  canView,
  authorName,
}: {
  canView: PinViewAuthorizer
  authorName: AuthorNameResolver
}): OrganizationExtension {
  return async (identity, body, res) => {
    if (typeof body.action !== 'string' || !ACTIONS.has(body.action))
      return false
    const { organizationId, id: pinId } = body
    if (!validId(organizationId))
      throw new RequestError(400, 'Invalid organization')
    if (!isPinId(pinId)) throw new RequestError(400, 'Invalid pin')
    const uid = identity.uid
    const assertAccess = async () =>
      requireOrganizationAccess(await canView(uid, organizationId, pinId))
    await assertAccess()

    if (body.action === 'pinComments') {
      if (body.cursor !== undefined && !isPinId(body.cursor))
        throw new RequestError(400, 'Invalid cursor')
      const page = await commentPage(
        uid,
        organizationId,
        pinId,
        body.cursor as string | undefined,
        authorName,
      )
      // Access may end while reading; never return what was read after that.
      await assertAccess()
      res.json(page)
      return true
    }
    if (body.action === 'pinReactions') {
      const reactions = await reactionCounts(uid, pinId)
      await assertAccess()
      res.json({ reactions })
      return true
    }
    if (body.action === 'addPinComment') {
      if (!validId(body.mutationId))
        throw new RequestError(400, 'Invalid mutation')
      const text = commentBody(body.body)
      if (!text) throw new RequestError(400, 'Invalid comment')
      const comment = await addComment(
        uid,
        organizationId,
        pinId,
        body.mutationId,
        text,
      )
      res.json({
        comment: { ...comment, author: await authorName(uid, organizationId) },
      })
      return true
    }
    if (body.action === 'deletePinComment') {
      if (!isPinId(body.commentId))
        throw new RequestError(400, 'Invalid comment')
      await deleteComment(uid, pinId, body.commentId)
      res.json({ deleted: true })
      return true
    }
    if (!isReactionKey(body.reaction) || typeof body.active !== 'boolean')
      throw new RequestError(400, 'Invalid reaction')
    await setReaction(uid, organizationId, pinId, body.reaction, body.active)
    res.json({ reactions: await reactionCounts(uid, pinId) })
    return true
  }
}
