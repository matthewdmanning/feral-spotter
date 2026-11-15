import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { organizationCopy } from '@/src/shared/config/text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { styles } from '@/src/features/organizations/components/styles'
import type { useMemberships } from '@/src/features/organizations/membership/hooks/useMemberships'
import { LeaveChoices } from '@/src/features/organizations/membership/components/LeaveChoices'
import {
  memberCountLabel,
  membershipLocationLabel,
} from '@/src/features/organizations/membership/lib/summary'
import type { MembershipSummary } from '@/functions/src/organizations/membership/domain'

/**
 * One membership: name, status, member count and location, then the caller's
 * navigation actions, then Leave or Cancel request.
 */
export function MemberCard({
  member,
  query,
  children,
}: {
  member: MembershipSummary
  query: ReturnType<typeof useMemberships>
  /** Navigation actions, such as View or Members. */
  children?: ReactNode
}) {
  const copy = organizationCopy.membership
  // Leave choices belong to one membership state: a status change closes them.
  const state = `${member.status}-${member.leaving}`
  const [choices, setChoices] = useState({ state, open: false })
  const leaving = choices.state === state && choices.open
  const setLeaving = (open: boolean) => setChoices({ state, open })
  const canLeave =
    !member.leaving && ['active', 'pending'].includes(member.status)
  return (
    <GlassSurface kind="card" style={styles.card}>
      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          {member.organizationName}
        </Text>
        <Text style={styles.body}>
          {member.leaving
            ? copy.leavingIncomplete
            : copy.statuses[member.status]}
        </Text>
        {member.memberCount !== null && (
          <Text style={styles.hint}>
            {memberCountLabel(member.memberCount)}
          </Text>
        )}
        {member.location && (
          <Text style={styles.hint}>
            {membershipLocationLabel(member.location)}
          </Text>
        )}
      </View>
      {children}
      {member.leaving && (
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
      )}
      {canLeave && (
        <TextButton
          tone={leaving ? 'accent' : 'danger'}
          disabled={query.busy}
          onPress={() => setLeaving(!leaving)}
        >
          {leaving
            ? copy.cancelLeaving
            : member.status === 'pending'
              ? copy.cancelRequest
              : copy.leave}
        </TextButton>
      )}
      {canLeave && leaving && query.uid && (
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
    </GlassSurface>
  )
}
