import { useState, type ReactNode } from 'react'
import { ScrollView, Text } from 'react-native'
import { router, Stack } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'
import { useMemberships } from '@/src/features/organizations/membership/hooks/useMemberships'
import { LeaveChoices } from '@/src/features/organizations/membership/components/LeaveChoices'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

function MemberCard({
  member,
  query,
  renderSharedAccess,
}: {
  member: MembershipSummary
  query: ReturnType<typeof useMemberships>
  renderSharedAccess?: (organizationId: string) => ReactNode
}) {
  const [name, setName] = useState(member.displayName)
  const [leaving, setLeaving] = useState(false)
  const active = member.status === 'active' && !member.leaving
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{member.organizationName}</Text>
      <Text style={styles.body}>
        {member.leaving
          ? 'Leaving incomplete — resume to finish'
          : member.status}
      </Text>
      {member.leaving ? (
        <AppButton
          disabled={query.busy}
          onPress={() => {
            void query.request({
              action: 'resumeLeaving',
              organizationId: member.organizationId,
            })
          }}
        >
          Resume leaving
        </AppButton>
      ) : (
        <>
          {['active', 'pending'].includes(member.status) && (
            <>
              <TextField
                label={`Display name for ${member.organizationName}`}
                value={name}
                maxLength={80}
                editable={!query.busy}
                onChangeText={setName}
              />
              <TextButton
                disabled={query.busy || !name.trim()}
                onPress={() => {
                  void query.request({
                    action: 'renameMember',
                    organizationId: member.organizationId,
                    displayName: name,
                  })
                }}
              >
                Save display name
              </TextButton>
              {active && (
                <>
                  <TextButton
                    onPress={() =>
                      router.push({
                        pathname: '/organizations/[id]/members',
                        params: { id: member.organizationId },
                      })
                    }
                  >
                    Members
                  </TextButton>
                  {renderSharedAccess?.(member.organizationId)}
                </>
              )}
              <TextButton
                disabled={query.busy}
                onPress={() => setLeaving(!leaving)}
              >
                {leaving
                  ? 'Cancel leaving'
                  : member.status === 'pending'
                    ? 'Cancel request'
                    : 'Leave organization'}
              </TextButton>
              {leaving && query.uid && (
                <LeaveChoices
                  uid={query.uid}
                  organizationId={member.organizationId}
                  busy={query.busy}
                  onLeave={(choice) =>
                    query.request({
                      action: 'leaveOrganization',
                      organizationId: member.organizationId,
                      choice,
                    })
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </GlassSurface>
  )
}

function MembershipsForm({
  renderSharedAccess,
}: {
  renderSharedAccess?: (organizationId: string) => ReactNode
}) {
  const query = useMemberships()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: 'Organizations' }} />
      {!query.uid ? (
        <Text style={styles.body}>Sign in to join an organization.</Text>
      ) : (
        <>
          {!query.online && (
            <Text style={styles.body}>Connect to manage memberships.</Text>
          )}
          {!!query.error && (
            <Text accessibilityRole="alert" style={styles.body}>
              {query.error}
            </Text>
          )}
          {query.initialLoading && (
            <OrganizationLoading label="Loading memberships…" />
          )}
          <AppButton
            disabled={!query.online}
            loading={query.busy}
            onPress={() => {
              void query.request()
            }}
          >
            Refresh memberships
          </AppButton>
          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.title}>Join an organization</Text>
            <Text style={styles.body}>
              Enter an invite code and request approval. Your display name will
              be visible to other members. Joining does not share your Sightings
              or contact details.
            </Text>
            <TextField
              label="Invite code"
              value={code}
              maxLength={32}
              editable={!query.busy}
              onChangeText={setCode}
              autoCorrect={false}
            />
            <TextField
              label="Display name"
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
              Request membership
            </AppButton>
          </GlassSurface>
          {query.online &&
            !query.error &&
            !query.busy &&
            !query.memberships.length && (
              <Text style={styles.hint}>
                No memberships or pending requests.
              </Text>
            )}
          {query.memberships.map((member) => (
            <MemberCard
              key={`${query.uid}-${member.organizationId}-${member.status}-${member.leaving}-${member.displayName}`}
              member={member}
              query={query}
              renderSharedAccess={renderSharedAccess}
            />
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
