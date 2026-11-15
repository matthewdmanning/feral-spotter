import { useState, type ReactNode } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { router } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { styles } from '@/src/features/organizations/components/styles'
import type { useMemberships } from '@/src/features/organizations/membership/hooks/useMemberships'
import { LeaveChoices } from '@/src/features/organizations/membership/components/LeaveChoices'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

export function MemberCard({
  member,
  query,
  renderSharedAccess,
  children,
}: {
  children?: ReactNode
  member: MembershipSummary
  query: ReturnType<typeof useMemberships>
  renderSharedAccess?: (organizationId: string) => ReactNode
}) {
  const copy = organizationCopy.membership
  const [leaving, setLeaving] = useState(false)
  const active = member.status === 'active' && !member.leaving
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{member.organizationName}</Text>
      <Text style={styles.body}>
        {member.leaving ? copy.leavingIncomplete : copy.statuses[member.status]}
      </Text>
      {children}
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
          {copy.resumeLeaving}
        </AppButton>
      ) : (
        <>
          {['active', 'pending'].includes(member.status) && (
            <>
              <Text style={styles.body}>
                {formatCopy(organizationCopy.overview.displayName, {
                  name: member.displayName,
                })}
              </Text>
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
                    {copy.members}
                  </TextButton>
                  {renderSharedAccess?.(member.organizationId)}
                </>
              )}
              <TextButton
                disabled={query.busy}
                onPress={() => setLeaving(!leaving)}
              >
                {leaving
                  ? copy.cancelLeaving
                  : member.status === 'pending'
                    ? copy.cancelRequest
                    : copy.leave}
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
