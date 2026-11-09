import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { queryClient } from '@/src/shared/lib/queryClient'
import {
  organizationRequest,
  organizationErrorMessage,
} from '@/src/features/organizations/lib/api'
import { useVisibleQueryScope } from '@/src/features/organizations/hooks/useVisibleQueryScope'

interface Page<T> {
  items: T[]
  cursor: string | null
}

/** Common collection lifecycle; feature modules supply their endpoint and item shape. */
export function useOrganizationPager<T>({
  action,
  organizationId,
  itemsKey,
  enabled = true,
  params,
}: {
  action: string
  organizationId: string
  itemsKey: string
  enabled?: boolean
  /** Extra request fields that select the collection, such as a pin id. */
  params?: Record<string, string>
}) {
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const queryKey = ['organizations', uid, organizationId, action, params ?? {}]
  const visible = useVisibleQueryScope(
    queryKey,
    !!uid && online && enabled && !!organizationId,
  )
  const query = useInfiniteQuery(
    {
      queryKey,
      enabled: visible,
      gcTime: 0,
      refetchInterval: 30000,
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (page: Page<T>) => page.cursor ?? undefined,
      queryFn: async ({ pageParam, signal }): Promise<Page<T>> => {
        const response = await organizationRequest<Record<string, unknown>>(
          {
            action,
            organizationId,
            ...params,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
          uid,
          { signal },
        )
        if (
          !Array.isArray(response[itemsKey]) ||
          (response.cursor != null && typeof response.cursor !== 'string')
        )
          throw new Error('Invalid collection response')
        return {
          items: response[itemsKey] as T[],
          cursor: (response.cursor as string | null | undefined) ?? null,
        }
      },
    },
    queryClient,
  )
  // Denied access clears loaded pages instead of showing them beside the error.
  const pages = visible && !query.isError ? (query.data?.pages ?? []) : []
  return {
    items: pages.flatMap((page) => page.items),
    cursor: pages.at(-1)?.cursor ?? null,
    error: query.error ? organizationErrorMessage(query.error) : '',
    busy: query.isFetching,
    initialLoading: query.isLoading,
    loaded: query.isFetched,
    online,
    uid,
    enabled,
    refresh: () => query.refetch(),
    loadMore: () => query.fetchNextPage(),
  }
}
