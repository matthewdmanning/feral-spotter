import { useState, type ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { router, Stack } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { organizationCopy, formatCopy } from '@/src/shared/config/text'
import { MemberCard } from '@/src/features/organizations/membership/components/MemberCard'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'
import { useMemberships } from '@/src/features/organizations/membership/hooks/useMemberships'

function MembershipsForm({
  renderSharedAccess,
}: {
  renderSharedAccess?: (organizationId: string) => ReactNode
}) {
  const copy = organizationCopy.membership
  const query = useMemberships()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: copy.title }} />
      {!query.uid ? (
        <Text style={styles.body}>{copy.signIn}</Text>
      ) : (
        <>
          {!query.online && <Text style={styles.body}>{copy.offline}</Text>}
          {!!query.error && (
            <Text accessibilityRole="alert" style={styles.body}>
              {query.error}
            </Text>
          )}
          {query.initialLoading && <OrganizationLoading label={copy.loading} />}
          <AppButton
            disabled={!query.online}
            loading={query.busy}
            onPress={() => {
              void query.request()
            }}
          >
            {copy.refresh}
          </AppButton>
          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.title}>{copy.join}</Text>
            <Text style={styles.body}>{copy.disclosure}</Text>
            <TextField
              label={copy.inviteCode}
              value={code}
              maxLength={32}
              editable={!query.busy}
              onChangeText={setCode}
              autoCorrect={false}
            />
            <TextField
              label={copy.displayName}
              value={name}
              maxLength={80}
              editable={!query.busy}
              onChangeText={setName}
            />
            <AppButton
              disabled={
                !query.online || query.busy || !code.trim() || !name.trim()
              }
              onPress={() => {
                void query
                  .request({
                    action: 'joinOrganization',
                    code: code.trim(),
                    displayName: name,
                  })
                  .then((ok) => {
                    if (ok) {
                      setCode('')
                      setName('')
                    }
                  })
              }}
            >
              {copy.request}
            </AppButton>
          </GlassSurface>
          {query.online &&
            !query.error &&
            !query.busy &&
            !query.memberships.length && (
              <Text style={styles.hint}>{copy.empty}</Text>
            )}
          {query.memberships.map((member) => (
            <MemberCard
              key={`${query.uid}-${member.organizationId}-${member.status}-${member.leaving}-${member.displayName}`}
              member={member}
              query={query}
              renderSharedAccess={renderSharedAccess}
            >
              <TextButton
                onPress={() =>
                  router.push({
                    pathname: '/organizations/[id]',
                    params: { id: member.organizationId },
                  })
                }
              >
                {formatCopy(organizationCopy.overview.open, {
                  name: member.organizationName,
                })}
              </TextButton>
            </MemberCard>
          ))}
        </>
      )}
    </ScrollView>
  )
}

export default function MembershipsScreen(props: {
  renderSharedAccess?: (organizationId: string) => ReactNode
}) {
  const uid = useAuthStore((s) => s.user?.uid)
  return <MembershipsForm key={uid ?? 'signed-out'} {...props} />
}
