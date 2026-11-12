import { router } from 'expo-router'
import MembershipsScreen from '@/src/features/organizations/membership/screens/MembershipsScreen'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'

export default function OrganizationsRoute() {
  const sharingEnabled = useOrganizationsFlag((s) => s.enabled)
  return (
    <MembershipsScreen
      renderSharedAccess={
        sharingEnabled
          ? (organizationId) => (
              <TextButton
                onPress={() =>
                  router.push({
                    pathname: '/organizations/[id]/sightings',
                    params: { id: organizationId },
                  })
                }
              >
                Shared Sightings
              </TextButton>
            )
          : undefined
      }
    />
  )
}
