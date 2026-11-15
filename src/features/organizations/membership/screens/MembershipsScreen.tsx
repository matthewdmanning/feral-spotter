import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { router, Stack } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { SortableList } from '@/src/shared/ui/molecules/SortableList'
import {
  commonCopy,
  formatCopy,
  organizationCopy,
} from '@/src/shared/config/text'
import { MemberCard } from '@/src/features/organizations/membership/components/MemberCard'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { OrganizationQueryStatus } from '@/src/features/organizations/components/OrganizationQueryStatus'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'
import { useMemberships } from '@/src/features/organizations/membership/hooks/useMemberships'
import { useMembershipOrderStore } from '@/src/features/organizations/membership/hooks/useMembershipOrderStore'
import { orderMemberships } from '@/src/features/organizations/membership/lib/summary'

function MembershipsForm() {
  const copy = organizationCopy.membership
  const query = useMemberships()
  const hasName = !!useAuthStore((s) => s.user?.displayName?.trim())
  const savedOrder = useMembershipOrderStore((s) =>
    query.uid ? s.orders[query.uid] : undefined,
  )
  const [code, setCode] = useState('')
  // Organization ids while Arrange is active; null otherwise.
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const arranging = draftOrder !== null
  const memberships = orderMemberships(
    query.memberships,
    draftOrder ?? savedOrder,
  )
  const canArrange = !arranging && !!query.uid && memberships.length > 1
  const stopArranging = () => {
    setDraftOrder(null)
    setDragging(false)
  }
  return (
    <View style={layout.screen}>
      <Stack.Screen
        options={{
          title: copy.title,
          headerRight: () =>
            canArrange ? (
              <TextButton
                onPress={() =>
                  setDraftOrder(memberships.map((m) => m.organizationId))
                }
              >
                {copy.arrange}
              </TextButton>
            ) : null,
        }}
      />
      <ScrollView
        contentContainerStyle={layout.content}
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled"
      >
        {arranging ? (
          <SortableList
            data={memberships}
            keyOf={(member) => member.organizationId}
            handleLabel={(member) =>
              formatCopy(copy.move, { name: member.organizationName })
            }
            onReorder={setDraftOrder}
            onDragActiveChange={setDragging}
            renderItem={(member) => (
              <GlassSurface kind="card" style={styles.card}>
                <Text accessibilityRole="header" style={styles.title}>
                  {member.organizationName}
                </Text>
              </GlassSurface>
            )}
          />
        ) : (
          <>
            <OrganizationQueryStatus
              query={query}
              copy={copy}
              onRefresh={() => {
                void query.request()
              }}
            />
            {!!query.uid && (
              <GlassSurface kind="card" style={styles.card}>
                <Text accessibilityRole="header" style={styles.title}>
                  {copy.join}
                </Text>
                <Text style={styles.body}>{copy.disclosure}</Text>
                {!hasName && (
                  <Text style={styles.hint}>{copy.nameRequired}</Text>
                )}
                <TextField
                  label={copy.inviteCode}
                  value={code}
                  maxLength={32}
                  editable={!query.busy}
                  onChangeText={setCode}
                  autoCorrect={false}
                />
                <AppButton
                  disabled={
                    !query.online || query.busy || !hasName || !code.trim()
                  }
                  onPress={() => {
                    void query
                      .request({
                        action: 'joinOrganization',
                        code: code.trim(),
                      })
                      .then((ok) => {
                        if (ok) setCode('')
                      })
                  }}
                >
                  {copy.request}
                </AppButton>
              </GlassSurface>
            )}
            {!!query.uid &&
              query.online &&
              !query.error &&
              !query.busy &&
              !memberships.length && (
                <Text style={styles.hint}>{copy.empty}</Text>
              )}
            {memberships.map((member) => (
              <MemberCard
                key={member.organizationId}
                member={member}
                query={query}
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
      {arranging && (
        <View style={layout.footer}>
          <ButtonRow>
            <AppButton
              key="cancel"
              variant="secondary"
              disabled={dragging}
              onPress={stopArranging}
            >
              {commonCopy.cancel}
            </AppButton>
            <AppButton
              key="save"
              disabled={dragging}
              onPress={() => {
                if (query.uid && draftOrder)
                  useMembershipOrderStore
                    .getState()
                    .setOrder(query.uid, draftOrder)
                stopArranging()
              }}
            >
              {copy.saveOrder}
            </AppButton>
          </ButtonRow>
        </View>
      )}
    </View>
  )
}

export default function MembershipsScreen() {
  const uid = useAuthStore((s) => s.user?.uid)
  return <MembershipsForm key={uid ?? 'signed-out'} />
}
