import { ActivityIndicator, View } from 'react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { organizationCopy } from '@/src/shared/config/text'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './styles'

export function OrganizationLoading({
  label = organizationCopy.loading,
}: {
  label?: string
}) {
  const { theme } = useUnistyles()
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={styles.card}
    >
      <ActivityIndicator color={theme.colors.text} accessibilityLabel={label} />
      <Text style={styles.body}>{label}</Text>
    </View>
  )
}
