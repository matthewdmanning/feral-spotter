import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  organizationRequest,
  organizationErrorMessage,
  isAccessLost,
  OrganizationSyncError,
} from '@/src/features/organizations/lib/api'
import { usePinInteractionsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useOrganizationPager } from '@/src/features/organizations/hooks/useOrganizationPager'
import { useVisibleQueryScope } from '@/src/features/organizations/hooks/useVisibleQueryScope'
import { pinInteractionCopy } from '@/src/features/organizations/interactions/copy'
import {
  commentBody,
  type PinComment,
  type PinReactions,
  type ReactionKey,
} from '@/functions/src/organizations/interactions/domain'

type Write =
  | { action: 'addPinComment'; mutationId: string; body: string }
  | { action: 'deletePinComment'; commentId: string }
  | { action: 'setPinReaction'; reaction: ReactionKey; active: boolean }

interface Feedback {
  scope: string
  active: boolean
  loadedIds: string
  receipts: PinComment[]
  postError: string
  reactionError: string
  deleteError: { commentId: string; message: string } | null
}
const emptyFeedback = (
  scope: string,
  active = false,
  loadedIds = '',
): Feedback => ({
  scope,
  active,
  loadedIds,
  receipts: [],
  postError: '',
  reactionError: '',
  deleteError: null,
})

/** Comments and reactions for one pin; memory-only, like other shared views. */
export function usePinInteractions(organizationId: string, pinId: string) {
  const queryClient = useQueryClient()
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const enabled = usePinInteractionsFlag()
  const scope = JSON.stringify([uid, organizationId, pinId])
  const [feedback, setFeedback] = useState(() => emptyFeedback(scope))
  const lifecycle = useRef({ generation: 0, active: false })
  const inFlight = useRef(false)
  const isCurrent = (generation: number) =>
    lifecycle.current.active && lifecycle.current.generation === generation
  const comments = useOrganizationPager<PinComment>({
    action: 'pinComments',
    organizationId,
    itemsKey: 'comments',
    enabled,
    params: { id: pinId },
  })
  const reactionsKey = [
    'organizations',
    uid,
    organizationId,
    'pinReactions',
    pinId,
  ]
  const visible = useVisibleQueryScope(
    reactionsKey,
    !!uid && online && enabled && !!organizationId,
  )
  const reactions = useQuery({
    queryKey: reactionsKey,
    enabled: visible,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      const result = await organizationRequest<PinReactions>(
        { action: 'pinReactions', organizationId, id: pinId },
        uid,
        { signal },
      )
      if (!Array.isArray(result.reactions))
        throw new Error('Invalid reactions response')
      return result.reactions
    },
  })
  // Keep the retry identity through blur/background, including lost responses.
  const draft = useRef<{
    scope: string
    body: string
    mutationId: string
  } | null>(null)
  const mutation = useMutation({
    mutationFn: ({ write }: { write: Write; generation: number }) =>
      organizationRequest<Partial<PinReactions> & { comment?: PinComment }>(
        { ...write, organizationId, id: pinId },
        uid,
      ),
    onSuccess: (result, { write, generation }) => {
      // A completed write must not repopulate a hidden or changed pin.
      if (!isCurrent(generation)) return
      if (write.action === 'setPinReaction' && result.reactions) {
        queryClient.setQueryData(reactionsKey, result.reactions)
      } else {
        if (write.action === 'addPinComment' && result.comment) {
          const comment = result.comment
          setFeedback((current) => ({
            ...current,
            receipts: [
              ...current.receipts.filter((item) => item.id !== comment.id),
              comment,
            ],
          }))
        }
        if (write.action === 'deletePinComment')
          setFeedback((current) => ({
            ...current,
            receipts: current.receipts.filter(
              (item) => item.id !== write.commentId,
            ),
          }))
        void comments.refresh()
      }
    },
    onError: (error, { write, generation }) => {
      if (!isCurrent(generation)) return
      const message =
        write.action === 'addPinComment' &&
        error instanceof OrganizationSyncError &&
        error.status === 429
          ? pinInteractionCopy.commentLimit
          : organizationErrorMessage(error)
      setFeedback((current) => ({
        ...current,
        ...(write.action === 'addPinComment' ? { postError: message } : {}),
        ...(write.action === 'setPinReaction'
          ? { reactionError: message }
          : {}),
        ...(write.action === 'deletePinComment'
          ? { deleteError: { commentId: write.commentId, message } }
          : {}),
      }))
    },
  })
  const accessLost =
    comments.accessLost ||
    isAccessLost(reactions.error) ||
    isAccessLost(mutation.error)
  const active = visible && !accessLost
  const loadedIds = JSON.stringify(comments.items.map((comment) => comment.id))
  const loaded = new Set(comments.items.map((comment) => comment.id))
  // Adjust scoped local state before rendering, rather than clearing it after paint.
  if (feedback.scope !== scope || feedback.active !== active) {
    setFeedback(emptyFeedback(scope, active, loadedIds))
  } else if (feedback.loadedIds !== loadedIds) {
    setFeedback({
      ...feedback,
      loadedIds,
      receipts: feedback.receipts.filter((comment) => !loaded.has(comment.id)),
    })
  }
  useEffect(() => {
    lifecycle.current = { generation: lifecycle.current.generation + 1, active }
    return () => {
      lifecycle.current = {
        generation: lifecycle.current.generation + 1,
        active: false,
      }
    }
  }, [scope, active])
  const ready = active && !mutation.isPending
  const run = async (write: Write) => {
    if (!ready || !lifecycle.current.active || inFlight.current) return false
    inFlight.current = true
    const generation = lifecycle.current.generation
    setFeedback((current) => ({
      ...current,
      ...(write.action === 'addPinComment' ? { postError: '' } : {}),
      ...(write.action === 'setPinReaction' ? { reactionError: '' } : {}),
      ...(write.action === 'deletePinComment' ? { deleteError: null } : {}),
    }))
    try {
      await mutation.mutateAsync({ write, generation })
      return isCurrent(generation)
    } catch {
      return false
    } finally {
      inFlight.current = false
    }
  }
  const local =
    active && feedback.scope === scope ? feedback : emptyFeedback(scope)
  const accessError = [reactions.error, mutation.error].find(isAccessLost)
  return {
    comments: active ? comments.items : [],
    // Receipts stay outside cursor pages; there may be an unloaded gap.
    receipts: local.receipts.filter((comment) => !loaded.has(comment.id)),
    cursor: active ? comments.cursor : null,
    loadMore: () => (active ? comments.loadMore() : Promise.resolve(undefined)),
    refreshComments: () =>
      active ? comments.refresh() : Promise.resolve(undefined),
    commentsBusy: comments.busy,
    initialLoading: comments.initialLoading,
    threadError:
      comments.error ||
      (accessError ? organizationErrorMessage(accessError) : ''),
    reactions: active ? (reactions.data ?? []) : [],
    reactionsKnown: active && reactions.data !== undefined,
    reactionsLoading:
      !accessLost && reactions.data === undefined && !reactions.isError,
    reactionsReady: ready && reactions.data !== undefined,
    reactionError:
      local.reactionError ||
      (active && reactions.error
        ? organizationErrorMessage(reactions.error)
        : ''),
    retryReactions: () => {
      if (!active) return Promise.resolve(undefined)
      setFeedback((current) => ({ ...current, reactionError: '' }))
      return reactions.refetch()
    },
    reactionsBusy: reactions.isFetching,
    postError: local.postError,
    deleteError: local.deleteError,
    posting:
      mutation.isPending && mutation.variables.write.action === 'addPinComment',
    reacting:
      mutation.isPending &&
      mutation.variables.write.action === 'setPinReaction',
    deletingId:
      mutation.isPending &&
      mutation.variables.write.action === 'deletePinComment'
        ? mutation.variables.write.commentId
        : null,
    ready,
    addComment: async (input: string) => {
      const body = commentBody(input)
      if (!body || !ready) return false
      if (draft.current?.scope !== scope || draft.current.body !== body)
        draft.current = { scope, body, mutationId: randomUUID() }
      const posted = await run({
        action: 'addPinComment',
        mutationId: draft.current.mutationId,
        body,
      })
      if (posted) draft.current = null
      return posted
    },
    deleteComment: async (commentId: string) =>
      run({ action: 'deletePinComment', commentId }),
    toggleReaction: async (reaction: ReactionKey, selected: boolean) =>
      reactions.data !== undefined &&
      run({ action: 'setPinReaction', reaction, active: selected }),
  }
}
