import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  organizationRequest,
  organizationErrorMessage,
  isRequestCancelled,
  OrganizationSyncError,
} from '@/src/features/organizations/lib/api'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useVisibleQueryScope } from '@/src/features/organizations/hooks/useVisibleQueryScope'
import type { MembershipList } from '@/functions/src/organizations/membership/domain'

type Body = Record<string, unknown>

async function fetchMemberships(
  body: Body,
  uid: string | undefined,
  organizationId: unknown,
  signal?: AbortSignal,
) {
  const result = await organizationRequest<MembershipList>(body, uid, {
    signal,
  })
  if (!Array.isArray(result.memberships))
    throw new Error('Invalid membership response')
  // Apply acknowledged permission outcomes even if the user left this screen during the write.
  if (
    uid &&
    result.ledger &&
    typeof organizationId === 'string' &&
    result.memberships.some(
      (member) =>
        member.organizationId === organizationId &&
        ['left', 'removed'].includes(member.status) &&
        !member.leaving,
    )
  )
    useOrganizationSharingStore
      .getState()
      .acceptLedger(uid, organizationId, result.ledger)
  return result
}

export function useMemberships() {
  const queryClient = useQueryClient()
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const queryKey = ['organizations', uid, 'memberships']
  const visible = useVisibleQueryScope(queryKey, !!uid && online)
  // Writes are never cancelled: their idempotent server outcome must be applied.
  const mutation = useMutation({
    mutationFn: (body: Body) =>
      fetchMemberships(body, uid, body.organizationId),
    onSuccess: (result) => queryClient.setQueryData(queryKey, result),
    onError: async (error, body) => {
      if (isRequestCancelled(error)) return
      // A lost mutation response is ambiguous: reconcile the durable server checkpoint first.
      const reconciled = await fetchMemberships(
        {
          action: 'memberships',
          includePermissions: ['leaveOrganization', 'resumeLeaving'].includes(
            String(body.action),
          ),
        },
        uid,
        body.organizationId,
      ).catch(() => undefined)
      if (
        error instanceof OrganizationSyncError &&
        [401, 403].includes(error.status)
      )
        queryClient.setQueryData(queryKey, { memberships: [] })
      else if (reconciled) queryClient.setQueryData(queryKey, reconciled)
    },
  })
  const query = useQuery({
    queryKey,
    // A refresh during a write could replace its acknowledged result with an older read.
    enabled: visible && !mutation.isPending,
    gcTime: 0,
    staleTime: 30000,
    queryFn: ({ signal }) =>
      fetchMemberships({ action: 'memberships' }, uid, undefined, signal),
  })
  const failure = mutation.error ?? (query.isError ? query.error : null)
  return {
    memberships:
      visible && !query.isError ? (query.data?.memberships ?? []) : [],
    error: failure ? organizationErrorMessage(failure) : '',
    busy: query.isFetching || mutation.isPending,
    initialLoading: query.isLoading,
    uid,
    online,
    request: async (body?: Body) => {
      if (!uid || !online || mutation.isPending) return false
      if (!body) {
        mutation.reset()
        return (await query.refetch()).isSuccess
      }
      return mutation.mutateAsync(body).then(
        () => true,
        () => false,
      )
    },
  }
}
