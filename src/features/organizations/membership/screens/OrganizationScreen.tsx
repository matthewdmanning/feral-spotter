import { useState } from 'react'
import { ScrollView } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Text } from '@/src/shared/ui/atoms/Text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { organizationCopy } from '@/src/shared/config/text'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
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
      {!query.uid ? (
        <Text style={styles.body}>{copy.signIn}</Text>
      ) : (
        <>
          {!query.online && <Text style={styles.body}>{copy.offline}</Text>}
          {query.initialLoading && <OrganizationLoading label={copy.loading} />}
          {!!query.error && <Text style={styles.body}>{query.error}</Text>}
          <AppButton
            disabled={!query.online}
            loading={query.busy}
            onPress={() => {
              void query.request()
            }}
          >
            {copy.refresh}
          </AppButton>
          {member ? (
            <>
              <MemberCard
                key={`${query.uid}-${member.organizationId}-${member.status}-${member.leaving}-${member.displayName}`}
                member={member}
                query={query}
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
                          {copy.sharedSightings}
                        </TextButton>
                      )
                    : undefined
                }
              />
            </>
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
