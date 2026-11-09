import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useOrganizationPager } from '@/src/features/organizations/hooks/useOrganizationPager'
import type { SharedSighting } from '@/src/shared/types/Organizations'
export type { SharedSighting }

export function useSharedSightings(organizationId: string) {
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const query = useOrganizationPager<SharedSighting>({
    action: 'sharedSightings',
    organizationId,
    itemsKey: 'sightings',
    enabled,
  })
  return {
    ...query,
    sightings: [...new Map(query.items.map((s) => [s.id, s])).values()],
  }
}
