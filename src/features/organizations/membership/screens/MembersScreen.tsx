import { ScrollView, Text } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { useOrganizationPager } from '@/src/features/organizations/hooks/useOrganizationPager'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useOrganizationPager<{ displayName: string }>({
    action: 'organizationMembers',
    organizationId: id,
    itemsKey: 'members',
  })
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: 'Members' }} />
      <Text style={styles.hint}>
        Only display names are shared in this list.
      </Text>
      {!query.uid && <Text style={styles.body}>Sign in to view members.</Text>}
      {!query.online && (
        <Text style={styles.body}>Connect to view members.</Text>
      )}
      {query.initialLoading && <OrganizationLoading label="Loading members…" />}
      {!!query.error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {query.error}
        </Text>
      )}
      <AppButton
        disabled={!query.uid || !query.online}
        loading={query.busy}
        onPress={() => {
          void query.refresh()
        }}
      >
        Refresh members
      </AppButton>
      {query.items.map((member, index) => (
        <Text key={index} style={styles.body}>
          {member.displayName}
        </Text>
      ))}
      {query.loaded && !query.busy && !query.error && !query.items.length && (
        <Text style={styles.body}>
          {query.cursor
            ? 'No members on this page. Load more to continue.'
            : 'No members to display.'}
        </Text>
      )}
      {!!query.cursor && (
        <AppButton
          disabled={query.busy}
          onPress={() => {
            void query.loadMore()
          }}
        >
          Load more members
        </AppButton>
      )}
    </ScrollView>
  )
}
