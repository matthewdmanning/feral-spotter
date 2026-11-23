import { ScrollView } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Text } from '@/src/shared/ui/atoms/Text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { organizationCopy } from '@/src/shared/config/text'
import { useOrganizationPager } from '@/src/features/organizations/hooks/useOrganizationPager'
import { OrganizationQueryStatus } from '@/src/features/organizations/components/OrganizationQueryStatus'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'

const copy = organizationCopy.members

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useOrganizationPager<{ displayName: string }>({
    action: 'organizationMembers',
    organizationId: id,
    itemsKey: 'members',
  })
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: copy.title }} />
      <Text style={styles.hint}>{copy.notice}</Text>
      <OrganizationQueryStatus
        query={query}
        copy={copy}
        onRefresh={() => {
          void query.refresh()
        }}
      />
      {query.items.map((member, index) => (
        // Names are not unique and the roster exposes no ids.
        <Text key={index} style={styles.body}>
          {member.displayName}
        </Text>
      ))}
      {query.loaded && !query.busy && !query.error && !query.items.length && (
        <Text style={styles.body}>
          {query.cursor ? copy.emptyPage : copy.empty}
        </Text>
      )}
      {!!query.cursor && (
        <AppButton
          disabled={query.busy}
          onPress={() => {
            void query.loadMore()
          }}
        >
          {copy.loadMore}
        </AppButton>
      )}
    </ScrollView>
  )
}
