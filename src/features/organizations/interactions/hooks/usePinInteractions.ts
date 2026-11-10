import { useRef } from 'react'
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
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useOrganizationPager } from '@/src/features/organizations/hooks/useOrganizationPager'
import { useVisibleQueryScope } from '@/src/features/organizations/hooks/useVisibleQueryScope'
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

/** Comments and reactions for one pin; memory-only, like other shared views. */
export function usePinInteractions(organizationId: string, pinId: string) {
  const queryClient = useQueryClient()
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const enabled = useOrganizationsFlag((s) => s.enabled)
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
  // Writes are never cancelled; a retry of the same text reuses its mutation id.
  const draft = useRef<{ body: string; mutationId: string } | null>(null)
  const mutation = useMutation({
    mutationFn: (write: Write) =>
      organizationRequest<Partial<PinReactions>>(
        { ...write, organizationId, id: pinId },
        uid,
      ),
    onSuccess: (result, write) => {
      if (write.action === 'setPinReaction' && result.reactions)
        queryClient.setQueryData(reactionsKey, result.reactions)
      else void comments.refresh()
    },
  })
  const ready = !!uid && online && enabled && !mutation.isPending
  const run = (write: Write) =>
    mutation.mutateAsync(write).then(
      () => true,
      () => false,
    )
  const failure =
    mutation.error ??
    (comments.error ? null : reactions.isError ? reactions.error : null)
  return {
    comments: comments.items,
    cursor: comments.cursor,
    loadMore: comments.loadMore,
    initialLoading: comments.initialLoading,
    reactions:
      visible && !(reactions.isError && isAccessLost(reactions.error))
        ? (reactions.data ?? [])
        : [],
    error:
      comments.error ||
      (mutation.variables?.action === 'addPinComment' &&
      mutation.error instanceof OrganizationSyncError &&
      mutation.error.status === 429
        ? 'You reached the comment limit. Delete old comments to post more.'
        : failure
          ? organizationErrorMessage(failure)
          : ''),
    busy: mutation.isPending,
    ready,
    addComment: async (input: string) => {
      const body = commentBody(input)
      if (!body || !ready) return false
      if (draft.current?.body !== body)
        draft.current = { body, mutationId: randomUUID() }
      const posted = await run({
        action: 'addPinComment',
        mutationId: draft.current.mutationId,
        body,
      })
      if (posted) draft.current = null
      return posted
    },
    deleteComment: async (commentId: string) =>
      ready && run({ action: 'deletePinComment', commentId }),
    toggleReaction: async (reaction: ReactionKey, active: boolean) =>
      ready && run({ action: 'setPinReaction', reaction, active }),
  }
}
