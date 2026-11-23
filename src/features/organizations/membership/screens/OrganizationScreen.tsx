import { useState } from 'react'
import { ScrollView } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Text } from '@/src/shared/ui/atoms/Text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { organizationCopy } from '@/src/shared/config/text'
import { OrganizationQueryStatus } from '@/src/features/organizations/components/OrganizationQueryStatus'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'
import { OrganizationPermissions } from '@/src/features/organizations/sharing/components/OrganizationPermissions'
import { MemberCard } from '@/src/features/organizations/membership/components/MemberCard'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useMemberships } from '@/src/features/organizations/membership/hooks/useMemberships'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'

export default function OrganizationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const uid = useAuthStore((state) => state.user?.uid)
  return <OrganizationContent key={`${uid}-${id}`} />
}

function OrganizationContent() {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useMemberships()
  const sharingEnabled = useOrganizationsFlag((state) => state.enabled)
  const member = query.memberships.find((item) => item.organizationId === id)
  const copy = organizationCopy.overview
  return (
    <ScrollView
      contentContainerStyle={layout.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{ title: member?.organizationName ?? copy.title }}
      />
      <OrganizationQueryStatus
        query={query}
        copy={copy}
        onRefresh={() => {
          void query.request()
        }}
      />
      {!!query.uid && (
        <>
          {member ? (
            <MemberCard member={member} query={query}>
              {member.status === 'active' && !member.leaving && (
                <>
                  <TextButton
                    onPress={() =>
                      router.push({
                        pathname: '/organizations/[id]/members',
                        params: { id: member.organizationId },
                      })
                    }
                  >
                    {organizationCopy.membership.members}
                  </TextButton>
                  {sharingEnabled && (
                    <TextButton
                      onPress={() =>
                        router.push({
                          pathname: '/organizations/[id]/sightings',
                          params: { id: member.organizationId },
                        })
                      }
                    >
                      {copy.sharedSightings}
                    </TextButton>
                  )}
                </>
              )}
            </MemberCard>
          ) : query.online && !query.busy && !query.error ? (
            <Text style={styles.body}>{copy.unavailable}</Text>
          ) : null}
          <AppButton
            variant="secondary"
            onPress={() => setPrivacyOpen(!privacyOpen)}
          >
            {privacyOpen ? copy.closePrivacy : copy.privacy}
          </AppButton>
          {privacyOpen && (
            <>
              <Text style={styles.hint}>{copy.privacyDescription}</Text>
              <OrganizationPermissions organizationId={id} />
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}
