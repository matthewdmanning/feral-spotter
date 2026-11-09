/** Pin interactions: comments and fixed-set reactions on a shared Sighting pin. */

export const REACTIONS = [
  { key: 'thumbs_up', emoji: '👍', label: 'Thumbs up' },
  { key: 'heart', emoji: '❤️', label: 'Heart' },
  { key: 'eyes', emoji: '👀', label: 'Watching' },
  { key: 'sad_cat', emoji: '😿', label: 'Concerned' },
  { key: 'pray', emoji: '🙏', label: 'Thanks' },
  { key: 'check', emoji: '✅', label: 'Handled' },
] as const
export type ReactionKey = (typeof REACTIONS)[number]['key']

export const COMMENT_MAX_LENGTH = 500
export const COMMENT_PAGE_SIZE = 50

/**
 * What happens to a member's comments and reactions when they stop being a
 * member or erase their account. The owner of that lifecycle picks the policy.
 */
export type AuthorExitPolicy = 'retain' | 'delete'

export interface PinComment {
  id: string
  body: string
  createdAt: string
  /** Current display name; null when the author can no longer be named. */
  author: string | null
  mine: boolean
}
export interface PinCommentPage {
  comments: PinComment[]
  cursor: string | null
}
export interface PinReactionCount {
  key: ReactionKey
  count: number
  mine: boolean
}
export interface PinReactions {
  reactions: PinReactionCount[]
}

export function isReactionKey(value: unknown): value is ReactionKey {
  return REACTIONS.some((reaction) => reaction.key === value)
}

/** Returns the trimmed body, or null when it is empty or too long. */
export function commentBody(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const body = input.trim()
  return body && [...body].length <= COMMENT_MAX_LENGTH ? body : null
}

export const isPinId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
